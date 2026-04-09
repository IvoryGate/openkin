<template>
  <div class="log-line" @click="expanded = !expanded">
    <span class="log-ts mono">{{ formatTs(entry.ts) }}</span>
    <!-- level badge：INFO/WARN/ERROR/DEBUG -->
    <span class="log-level badge" :class="`badge--${getLevelClass(entry)}`">
      {{ (entry.level ?? 'INFO').toUpperCase() }}
    </span>
    <!-- type：事件类型，独立一列，不与 level 重复 -->
    <span class="log-type text-muted mono">{{ entry.type }}</span>
    <span class="log-session mono text-muted">{{ shortId(entry.sessionId) }}</span>
    <!-- traceId 列：有则显示可点击链接 -->
    <span class="log-trace">
      <RouterLink
        v-if="entry.traceId"
        :to="`/traces/${encodeURIComponent(String(entry.traceId))}`"
        class="trace-link mono"
        @click.stop
      >{{ shortTrace(String(entry.traceId)) }}</RouterLink>
      <span v-else class="text-muted">—</span>
    </span>
    <span class="log-msg">{{ truncate(entry.message ?? summarize(entry), 120) }}</span>
    <span class="expand-icon">{{ expanded ? '▲' : '▼' }}</span>
  </div>
  <div v-if="expanded" class="log-detail">
    <!-- 仅展示关键字段，不展示全量 JSON -->
    <div class="detail-grid">
      <template v-for="[k, v] in keyFields" :key="k">
        <span class="detail-key">{{ k }}</span>
        <span class="detail-val mono">{{ renderVal(v) }}</span>
      </template>
    </div>
    <!-- 完整 JSON 可折叠 -->
    <details class="full-json">
      <summary class="text-muted">完整 JSON</summary>
      <pre>{{ JSON.stringify(entry, null, 2) }}</pre>
    </details>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { LogEntryDto } from '@theworld/shared-contracts'

const props = defineProps<{ entry: LogEntryDto }>()

const expanded = ref(false)

// 优先展示的字段（排除通用字段，只留有意义的）
const SKIP = new Set(['type', 'level', 'ts', 'sessionId', 'traceId', 'message'])

const keyFields = computed(() => {
  return Object.entries(props.entry)
    .filter(([k]) => !SKIP.has(k) && props.entry[k] != null)
    .slice(0, 12)
})

function formatTs(ts: number): string {
  if (!ts) return '--'
  const d = new Date(ts)
  return d.toISOString().replace('T', ' ').slice(0, 23)
}

function shortId(id?: string): string {
  if (!id) return '—'
  return id.length > 8 ? `…${id.slice(-8)}` : id
}

function shortTrace(id: string): string {
  // trace ids like "trace-1775369599735-kt74eb" → show last 14 chars
  return id.length > 14 ? `…${id.slice(-14)}` : id
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}

function summarize(entry: LogEntryDto): string {
  // Fallback: pick first interesting non-meta field
  const skip = new Set(['type', 'level', 'ts', 'sessionId', 'traceId'])
  for (const [k, v] of Object.entries(entry)) {
    if (!skip.has(k) && v != null) return `${k}: ${String(v)}`
  }
  return entry.type
}

function renderVal(v: unknown): string {
  if (typeof v === 'string') return v.length > 200 ? v.slice(0, 200) + '…' : v
  return JSON.stringify(v)
}

function getLevelClass(entry: LogEntryDto): string {
  switch ((entry.level ?? '').toUpperCase()) {
    case 'ERROR': return 'error'
    case 'WARN':  return 'warn'
    case 'INFO':  return 'info'
    case 'DEBUG': return 'muted'
    default:      return 'muted'
  }
}
</script>

<style scoped>
.log-line {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
  padding: var(--sp-2) var(--sp-3);
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  font-size: 12px;
}

.log-line:hover { background: var(--color-surface-2); }

.log-ts      { color: var(--color-text-subtle); width: 168px; flex-shrink: 0; }
.log-level   { flex-shrink: 0; min-width: 44px; text-align: center; }
.log-type    { width: 110px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.log-session { width: 80px;  flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.log-trace   { width: 120px; flex-shrink: 0; overflow: hidden; }
.log-msg     { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.expand-icon { color: var(--color-text-subtle); font-size: 10px; flex-shrink: 0; }

.trace-link {
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 3px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  color: #0369a1;
  text-decoration: none;
  white-space: nowrap;
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.trace-link:hover { background: #e0f2fe; }

/* 展开详情 */
.log-detail {
  padding: var(--sp-2) var(--sp-3) var(--sp-3);
  background: var(--color-surface-alt, #f9fafb);
  border-bottom: 1px solid var(--color-border);
}

.detail-grid {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 2px 12px;
  margin-bottom: var(--sp-3);
  font-size: 12px;
}

.detail-key {
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  padding-top: 2px;
}

.detail-val {
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
}

.full-json summary {
  cursor: pointer;
  font-size: 11px;
  margin-bottom: 4px;
}

.full-json pre {
  max-height: 240px;
  overflow-y: auto;
  font-size: 11px;
}
</style>
