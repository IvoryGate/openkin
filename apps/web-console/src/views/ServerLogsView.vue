<template>
  <div class="server-logs-page">
    <div class="page-header">
      <h1>服务日志</h1>
      <div class="actions">
        <button @click="clearLogs">🗑 清空</button>
        <button @click="autoScroll = !autoScroll" :class="{ active: autoScroll }">
          {{ autoScroll ? '⏸ 暂停滚动' : '▶ 自动滚动' }}
        </button>
        <span class="conn-dot" :class="connected ? 'conn-dot--on' : 'conn-dot--off'"></span>
        <span class="text-muted" style="font-size:12px;">{{ connected ? '已连接' : '未连接' }}</span>
      </div>
    </div>

    <!-- 过滤栏 -->
    <div class="filter-bar">
      <select v-model="filterLevel" style="width:auto;max-width:160px;">
        <option value="">全部级别</option>
        <option value="DEBUG">≥ DEBUG</option>
        <option value="INFO">≥ INFO</option>
        <option value="WARN">≥ WARN</option>
        <option value="ERROR">ERROR 仅</option>
      </select>
      <input v-model="filterText" placeholder="关键词过滤…" style="max-width:260px;" />
      <span class="text-muted" style="font-size:12px;">{{ filteredLines.length }} / {{ lines.length }} 条</span>
    </div>

    <!-- 日志面板 -->
    <div class="log-panel card" ref="panelRef">
      <div
        v-for="(line, i) in filteredLines"
        :key="i"
        class="log-row"
        :class="`log-row--${line.level?.toLowerCase() ?? 'info'}`"
      >
        <span class="log-ts">{{ formatTs(line.ts) }}</span>
        <span class="log-level" :class="`level--${line.level?.toLowerCase() ?? 'info'}`">
          {{ (line.level ?? 'INFO').padEnd(5) }}
        </span>
        <span class="log-source">{{ formatSource(line) }}</span>
        <span class="log-msg">{{ formatMsg(line) }}</span>
      </div>
      <div v-if="filteredLines.length === 0" class="empty-hint">
        {{ connected ? '等待日志中…' : '未连接到服务端，请确认服务已启动' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { getBaseUrl } from '../api/operator'

const MAX_LINES = 500

interface LogLine {
  type?: string
  level?: string
  source?: string
  message?: string
  ts?: number
  [key: string]: unknown
}

// 模块级缓存：切换页面后再回来仍保留历史日志
const _cachedLines = ref<LogLine[]>([])
let _globalEs: EventSource | null = null
let _refCount = 0

const lines = _cachedLines
const filterLevel = ref('')
const filterText = ref('')
const autoScroll = ref(true)
const connected = ref(_globalEs !== null && _globalEs.readyState === EventSource.OPEN)
const panelRef = ref<HTMLElement | null>(null)

const LEVEL_ORDER: Record<string, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 }

const filteredLines = computed(() => {
  const minOrder = filterLevel.value !== '' ? (LEVEL_ORDER[filterLevel.value] ?? 0) : -1
  return lines.value.filter((l) => {
    if (minOrder >= 0) {
      const lineOrder = LEVEL_ORDER[l.level ?? 'INFO'] ?? 1
      if (lineOrder < minOrder) return false
    }
    if (filterText.value) {
      const hay = JSON.stringify(l).toLowerCase()
      if (!hay.includes(filterText.value.toLowerCase())) return false
    }
    return true
  })
})

function formatTs(ts?: number): string {
  if (!ts) return '--'
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 23)
}

/** source 列：agent 类日志显示 traceId 后 6 位，http 日志显示 http，其他走 source/type */
function formatSource(line: LogLine): string {
  const agentTypes = new Set(['conversation', 'llm_request', 'llm_response', 'tool_call', 'tool_result', 'skill_run', 'mcp_call', 'error'])
  if (line.type && agentTypes.has(line.type)) {
    const tid = line.traceId as string | undefined
    return tid ? tid.slice(-6) : (line.type ?? '?')
  }
  return line.source ?? line.type ?? '?'
}

function formatMsg(line: LogLine): string {
  // message 字段可能是字符串也可能是 {role, content} 对象
  if (line.message != null) {
    if (typeof line.message === 'string') return line.message
    if (typeof line.message === 'object') {
      const m = line.message as Record<string, unknown>
      const role = m.role ?? ''
      const content = typeof m.content === 'string' ? m.content.slice(0, 200) : JSON.stringify(m.content ?? '').slice(0, 200)
      return role ? `[${role}] ${content}` : content
    }
  }
  // 各类型日志的语义化摘要
  switch (line.type) {
    case 'http_request': {
      const status = line.status as number | undefined
      const flag = status && status >= 400 ? '⚠ ' : ''
      return `${flag}${line.method ?? ''} ${line.path ?? ''} ${status ?? ''} ${line.durationMs ?? ''}ms`
    }
    case 'llm_request':
      return `LLM REQUEST step=${line.stepIndex ?? '?'} msgs=${line.messageCount ?? '?'} traceId=${line.traceId ?? ''}`
    case 'llm_response': {
      const calls = (line.toolCalls as string[] | undefined)
      return calls?.length
        ? `LLM RESP step=${line.stepIndex ?? '?'} ${line.durationMs ?? ''}ms → ${calls.join(', ')}`
        : `LLM RESP step=${line.stepIndex ?? '?'} ${line.durationMs ?? ''}ms → ${String(line.text ?? '').slice(0, 100)}`
    }
    case 'tool_call':
      return `TOOL ${line.toolName ?? ''} ${JSON.stringify(line.input ?? {}).slice(0, 100)}`
    case 'tool_result':
      return `TOOL_RESULT ${line.toolName ?? ''} ${line.durationMs ?? ''}ms ${line.isError ? '❌' : '✅'} ${String(line.outputSummary ?? '').slice(0, 100)}`
    case 'conversation': {
      const turn = line.turn as string | undefined
      const icon = turn === 'user_message' ? '👤' : '🤖'
      return `${icon} ${turn ?? ''}`
    }
    case 'skill_run':
      return `SKILL ${line.skillId ?? ''}/${line.script ?? ''} exit=${line.exitCode ?? '?'} ${line.durationMs ?? ''}ms`
    case 'mcp_call':
      return `MCP ${line.providerId ?? ''}/${line.toolName ?? ''} ${line.durationMs ?? ''}ms ${line.isError ? '❌' : '✅'}`
    case 'error':
      return `ERROR ${line['message'] ?? ''}`
  }
  // 最终 fallback
  const skip = new Set(['type', 'level', 'source', 'ts'])
  for (const [k, v] of Object.entries(line)) {
    if (!skip.has(k) && v != null && typeof v !== 'object') return `${k}: ${String(v)}`
  }
  return JSON.stringify(line)
}

function addLine(raw: string) {
  try {
    const parsed = JSON.parse(raw) as LogLine
    // Normalise: if no level, try to infer from type
    if (!parsed.level) {
      if (parsed.type === 'error') parsed.level = 'ERROR'
      else if (parsed.type === 'mcp_call' || parsed.type === 'llm_request') parsed.level = 'DEBUG'
      else parsed.level = 'INFO'
    }
    _cachedLines.value.push(parsed)
    if (_cachedLines.value.length > MAX_LINES) _cachedLines.value.splice(0, _cachedLines.value.length - MAX_LINES)
  } catch {
    // raw text fallback
    _cachedLines.value.push({ type: 'raw', level: 'INFO', message: raw, ts: Date.now() })
  }
}

function clearLogs() {
  _cachedLines.value = []
}

function scrollToBottom() {
  const el = panelRef.value
  if (el) el.scrollTop = el.scrollHeight
}

watch(filteredLines, async () => {
  if (autoScroll.value) {
    await nextTick()
    scrollToBottom()
  }
})

function connectGlobal() {
  if (_globalEs) return // 已经连接，无需重复
  const base = getBaseUrl()
  const url = `${base}/v1/logs/stream`
  const es = new EventSource(url)
  _globalEs = es

  es.onopen = () => { connected.value = true }
  es.onerror = () => {
    connected.value = false
    es.close()
    _globalEs = null
    // auto-reconnect after 3 s
    setTimeout(() => {
      connectGlobal()
    }, 3000)
  }
  es.onmessage = (evt) => {
    if (evt.data) addLine(evt.data)
  }
}

onMounted(() => {
  _refCount++
  // 同步当前连接状态
  connected.value = _globalEs !== null && _globalEs.readyState === EventSource.OPEN
  connectGlobal()
  // 回到页面时若有历史日志，滚到底部
  nextTick(scrollToBottom)
})

onUnmounted(() => {
  _refCount--
  // 只要还有组件实例引用则保持连接；全部卸载时关闭
  if (_refCount <= 0) {
    _globalEs?.close()
    _globalEs = null
    _refCount = 0
  }
})
</script>

<style scoped>
.server-logs-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.log-panel {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  font-family: var(--font-mono);
  font-size: 12px;
  background: #fafbfc;
  min-height: 0;
  /* occupy remaining page height */
  max-height: calc(100vh - 200px);
}

.log-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 3px 10px;
  border-bottom: 1px solid #f0f2f5;
  line-height: 1.5;
  white-space: nowrap;
}

.log-row:hover { background: #f5f7ff; }

.log-row--error   { background: #fff5f5; }
.log-row--warn    { background: #fffbeb; }
.log-row--debug   { opacity: 0.7; }

.log-ts {
  color: #94a3b8;
  width: 170px;
  flex-shrink: 0;
  font-size: 11px;
}

.log-level {
  width: 46px;
  flex-shrink: 0;
  font-weight: 700;
  font-size: 11px;
}
.level--info  { color: #0284c7; }
.level--warn  { color: #d97706; }
.level--error { color: #dc2626; }
.level--debug { color: #94a3b8; }

.log-source {
  color: #7c3aed;
  width: 100px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
}

.log-msg {
  flex: 1;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-row--error .log-msg { color: #dc2626; }
.log-row--warn  .log-msg { color: #92400e; }

.empty-hint {
  padding: 24px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
  font-family: var(--font-sans);
}

/* connected indicator dot */
.conn-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.conn-dot--on  { background: #16a34a; }
.conn-dot--off { background: #dc2626; }

/* active button variant */
button.active {
  background: #eff6ff;
  border-color: #3b82f6;
  color: #1d4ed8;
}
</style>
