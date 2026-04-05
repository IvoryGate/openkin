<template>
  <div>
    <div class="page-header">
      <h1>设置</h1>
    </div>

    <!-- ── 本地控制台设置 ──────────────────────────────────── -->
    <section class="settings-section">
      <h2 class="section-title">控制台连接</h2>
      <div class="card settings-card">
        <div class="form-group">
          <label>Server URL</label>
          <p class="form-hint">开发时留空（走 Vite proxy）；生产直连时填写完整地址，如 <code>http://127.0.0.1:3333</code></p>
          <div class="input-row">
            <input v-model="consoleBaseUrl" placeholder="留空则通过代理自动连接" />
            <button @click="testConnection" :disabled="testing">{{ testing ? '测试中…' : '测试连接' }}</button>
          </div>
          <div v-if="testResult" :class="testOk ? 'text-success' : 'text-error'" class="test-result">
            {{ testResult }}
          </div>
        </div>
        <div class="form-group">
          <label>Console API Key</label>
          <div class="input-row">
            <input :type="showConsoleKey ? 'text' : 'password'" v-model="consoleApiKey" placeholder="留空则不使用 API Key" />
            <button @click="showConsoleKey = !showConsoleKey">{{ showConsoleKey ? '隐藏' : '显示' }}</button>
          </div>
        </div>
        <div class="save-actions">
          <button class="primary" @click="saveConsole">保存</button>
          <span v-if="consoleSaved" class="text-success">✓ 已保存</span>
        </div>
      </div>
    </section>

    <!-- ── 服务器运行时配置 ────────────────────────────────── -->
    <section class="settings-section">
      <h2 class="section-title">
        服务器配置
        <span v-if="configLoading" class="loading-dot">…</span>
        <span v-if="configError" class="text-error" style="font-size:12px;font-weight:normal">{{ configError }}</span>
      </h2>

      <template v-if="config">
        <!-- LLM -->
        <div class="config-group card">
          <h3 class="group-title">🤖 LLM 配置</h3>
          <div class="form-group">
            <label>API Key <span class="badge" :class="config.llm.hasApiKey ? 'badge-ok' : 'badge-warn'">{{ config.llm.hasApiKey ? '已设置' : '未设置' }}</span></label>
            <div class="input-row">
              <input :type="showLlmKey ? 'text' : 'password'" v-model="draft.llmApiKey" placeholder="留空则保留现有值" />
              <button @click="showLlmKey = !showLlmKey">{{ showLlmKey ? '隐藏' : '显示' }}</button>
            </div>
          </div>
          <div class="form-group">
            <label>Base URL</label>
            <input v-model="draft.llmBaseUrl" placeholder="https://api.openai.com/v1" />
          </div>
          <div class="form-group">
            <label>Model</label>
            <input v-model="draft.llmModel" placeholder="gpt-4o-mini" />
          </div>
          <div class="form-group">
            <label>Max Steps（Agent 单次运行最大步骤数）</label>
            <input type="number" v-model.number="draft.llmMaxSteps" min="1" max="100" />
          </div>
        </div>

        <!-- 服务器 -->
        <div class="config-group card">
          <h3 class="group-title">🌐 服务器</h3>
          <div class="form-group">
            <label>HTTP API Key <span class="badge" :class="config.server.hasApiKey ? 'badge-ok' : 'badge-warn'">{{ config.server.hasApiKey ? '已设置' : '未设置' }}</span></label>
            <div class="input-row">
              <input :type="showServerKey ? 'text' : 'password'" v-model="draft.serverApiKey" placeholder="留空则保留现有值" />
              <button @click="showServerKey = !showServerKey">{{ showServerKey ? '隐藏' : '显示' }}</button>
            </div>
          </div>
          <div class="form-group">
            <label>最大请求体（字节）</label>
            <input type="number" v-model.number="draft.serverMaxBodyBytes" min="1024" />
          </div>
        </div>

        <!-- 任务调度 -->
        <div class="config-group card">
          <h3 class="group-title">⏱ 任务调度</h3>
          <div class="form-row">
            <div class="form-group">
              <label>最大并发数</label>
              <input type="number" v-model.number="draft.schedulerMaxConcurrent" min="1" max="20" />
            </div>
            <div class="form-group">
              <label>失败重试次数</label>
              <input type="number" v-model.number="draft.schedulerMaxRetries" min="0" max="10" />
            </div>
            <div class="form-group">
              <label>慢任务阈值（毫秒）</label>
              <input type="number" v-model.number="draft.schedulerSlowThreshold" min="1000" />
            </div>
          </div>
        </div>

        <!-- 沙箱 -->
        <div class="config-group card">
          <h3 class="group-title">🔒 Skill 沙箱</h3>
          <div class="form-group toggle-group">
            <label>启用 Deno 沙箱</label>
            <label class="toggle">
              <input type="checkbox" v-model="draft.sandboxEnabled" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>脚本超时（毫秒）</label>
              <input type="number" v-model.number="draft.sandboxScriptTimeout" min="1000" />
            </div>
            <div class="form-group">
              <label>最大输出（字节）</label>
              <input type="number" v-model.number="draft.sandboxMaxOutput" min="4096" />
            </div>
          </div>
        </div>

        <!-- 运行时 -->
        <div class="config-group card">
          <h3 class="group-title">⚙️ 运行时</h3>
          <div class="form-group">
            <label>Shell 命令超时（毫秒）</label>
            <input type="number" v-model.number="draft.runtimeCmdTimeout" min="1000" />
          </div>
        </div>

        <!-- 保存区 -->
        <div class="config-save-bar card">
          <div class="form-group">
            <label>变更备注（可选）</label>
            <input v-model="saveNote" placeholder="如：更换 LLM 模型" />
          </div>
          <div class="save-actions">
            <button class="primary" @click="saveConfig" :disabled="saving">{{ saving ? '保存中…' : '保存服务器配置' }}</button>
            <button @click="resetDraft" :disabled="saving">重置</button>
            <span v-if="saveFeedback" :class="saveOk ? 'text-success' : 'text-error'">{{ saveFeedback }}</span>
          </div>
          <p class="form-hint">⚠ 部分配置（如 LLM API Key、Max Steps）需要重启服务才能完全生效。</p>
        </div>

        <!-- 变更历史 -->
        <div class="card">
          <div class="history-header" @click="showHistory = !showHistory">
            <h3 class="group-title" style="margin:0">🕓 变更历史</h3>
            <span class="toggle-btn">{{ showHistory ? '▲ 收起' : '▼ 展开' }}</span>
          </div>
          <template v-if="showHistory">
            <div v-if="historyLoading" class="empty-state">加载中…</div>
            <div v-else-if="history.length === 0" class="empty-state">暂无变更记录</div>
            <table v-else class="history-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>操作者</th>
                  <th>备注</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in history" :key="entry.id">
                  <td class="mono">{{ formatTs(entry.createdAt) }}</td>
                  <td>{{ entry.changedBy }}</td>
                  <td class="note-cell">{{ entry.note ?? '—' }}</td>
                  <td>
                    <button class="btn-sm btn-warning" @click="doRestore(entry.id)" :disabled="restoring === entry.id">
                      {{ restoring === entry.id ? '还原中…' : '还原到此版本' }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </template>
        </div>
      </template>

      <div v-else-if="!configLoading && configError" class="card empty-state">
        无法连接到服务器，请先配置并测试连接。
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import {
  getHealth,
  getServerConfig,
  patchServerConfig,
  listConfigHistory,
  restoreConfig,
} from '../api/operator'
import type { ServerConfigDto, ConfigHistoryEntryDto } from '@openkin/shared-contracts'

// ── Console local settings ────────────────────────────────────────────────────
const consoleBaseUrl = ref('')
const consoleApiKey = ref('')
const showConsoleKey = ref(false)
const consoleSaved = ref(false)
const testing = ref(false)
const testResult = ref('')
const testOk = ref(false)

function loadConsole() {
  consoleBaseUrl.value = localStorage.getItem('openkin_console_base_url') ?? ''
  consoleApiKey.value = localStorage.getItem('openkin_console_api_key') ?? ''
}

function saveConsole() {
  const url = consoleBaseUrl.value.trim().replace(/\/+$/, '')
  localStorage.setItem('openkin_console_base_url', url)
  localStorage.setItem('openkin_console_api_key', consoleApiKey.value.trim())
  consoleSaved.value = true
  setTimeout(() => { consoleSaved.value = false }, 2000)
}

async function testConnection() {
  const url = consoleBaseUrl.value.trim().replace(/\/+$/, '')
  const prevUrl = localStorage.getItem('openkin_console_base_url')
  const prevKey = localStorage.getItem('openkin_console_api_key')
  localStorage.setItem('openkin_console_base_url', url)
  localStorage.setItem('openkin_console_api_key', consoleApiKey.value.trim())
  testing.value = true
  testResult.value = ''
  try {
    const h = await getHealth()
    testResult.value = `✓ 已连接 (v${h.version})`
    testOk.value = true
  } catch (e) {
    testResult.value = e instanceof Error ? `✗ ${e.message}` : '连接失败'
    testOk.value = false
  } finally {
    testing.value = false
    if (prevUrl !== null) localStorage.setItem('openkin_console_base_url', prevUrl)
    else localStorage.removeItem('openkin_console_base_url')
    if (prevKey !== null) localStorage.setItem('openkin_console_api_key', prevKey)
    else localStorage.removeItem('openkin_console_api_key')
  }
}

// ── Server config ─────────────────────────────────────────────────────────────
const config = ref<ServerConfigDto | null>(null)
const configLoading = ref(false)
const configError = ref('')

interface Draft {
  llmApiKey: string
  llmBaseUrl: string
  llmModel: string
  llmMaxSteps: number
  serverApiKey: string
  serverMaxBodyBytes: number
  schedulerMaxConcurrent: number
  schedulerMaxRetries: number
  schedulerSlowThreshold: number
  sandboxEnabled: boolean
  sandboxScriptTimeout: number
  sandboxMaxOutput: number
  runtimeCmdTimeout: number
}

const draft = reactive<Draft>({
  llmApiKey: '',
  llmBaseUrl: '',
  llmModel: '',
  llmMaxSteps: 12,
  serverApiKey: '',
  serverMaxBodyBytes: 1048576,
  schedulerMaxConcurrent: 3,
  schedulerMaxRetries: 2,
  schedulerSlowThreshold: 30000,
  sandboxEnabled: true,
  sandboxScriptTimeout: 30000,
  sandboxMaxOutput: 65536,
  runtimeCmdTimeout: 30000,
})

function applyConfigToDraft(c: ServerConfigDto) {
  draft.llmApiKey = ''  // always blank — user must re-enter to change
  draft.llmBaseUrl = c.llm.baseUrl
  draft.llmModel = c.llm.model
  draft.llmMaxSteps = c.llm.maxSteps
  draft.serverApiKey = ''  // same
  draft.serverMaxBodyBytes = c.server.maxBodyBytes
  draft.schedulerMaxConcurrent = c.scheduler.maxConcurrent
  draft.schedulerMaxRetries = c.scheduler.maxRetries
  draft.schedulerSlowThreshold = c.scheduler.slowRunThresholdMs
  draft.sandboxEnabled = c.sandbox.enabled
  draft.sandboxScriptTimeout = c.sandbox.scriptTimeoutMs
  draft.sandboxMaxOutput = c.sandbox.maxOutputBytes
  draft.runtimeCmdTimeout = c.runtime.commandTimeoutMs
}

function resetDraft() {
  if (config.value) applyConfigToDraft(config.value)
}

async function loadConfig() {
  configLoading.value = true
  configError.value = ''
  try {
    const c = await getServerConfig()
    config.value = c
    applyConfigToDraft(c)
  } catch (e) {
    configError.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    configLoading.value = false
  }
}

const saving = ref(false)
const saveFeedback = ref('')
const saveOk = ref(false)
const saveNote = ref('')

async function saveConfig() {
  saving.value = true
  saveFeedback.value = ''
  try {
    const patch: Record<string, unknown> = {
      llm: {
        baseUrl: draft.llmBaseUrl,
        model: draft.llmModel,
        maxSteps: draft.llmMaxSteps,
        ...(draft.llmApiKey ? { apiKey: draft.llmApiKey } : {}),
      },
      server: {
        maxBodyBytes: draft.serverMaxBodyBytes,
        ...(draft.serverApiKey ? { apiKey: draft.serverApiKey } : {}),
      },
      scheduler: {
        maxConcurrent: draft.schedulerMaxConcurrent,
        maxRetries: draft.schedulerMaxRetries,
        slowRunThresholdMs: draft.schedulerSlowThreshold,
      },
      sandbox: {
        enabled: draft.sandboxEnabled,
        scriptTimeoutMs: draft.sandboxScriptTimeout,
        maxOutputBytes: draft.sandboxMaxOutput,
      },
      runtime: { commandTimeoutMs: draft.runtimeCmdTimeout },
    }
    if (saveNote.value.trim()) patch._note = saveNote.value.trim()

    const updated = await patchServerConfig(patch as Parameters<typeof patchServerConfig>[0])
    config.value = updated
    applyConfigToDraft(updated)
    saveNote.value = ''
    saveFeedback.value = '✓ 已保存'
    saveOk.value = true
    await loadHistory()
  } catch (e) {
    saveFeedback.value = e instanceof Error ? `✗ ${e.message}` : '保存失败'
    saveOk.value = false
  } finally {
    saving.value = false
    setTimeout(() => { saveFeedback.value = '' }, 3000)
  }
}

// ── History ───────────────────────────────────────────────────────────────────
const showHistory = ref(false)
const history = ref<ConfigHistoryEntryDto[]>([])
const historyLoading = ref(false)
const restoring = ref('')

watch(showHistory, (val) => { if (val && history.value.length === 0) loadHistory() })

async function loadHistory() {
  historyLoading.value = true
  try {
    const res = await listConfigHistory(30)
    history.value = res.history
  } catch { /* ignore */ } finally {
    historyLoading.value = false
  }
}

async function doRestore(id: string) {
  if (!confirm('确认将配置还原到此版本？当前配置的 API Key 将被清空，需要重新输入。')) return
  restoring.value = id
  try {
    const res = await restoreConfig(id)
    config.value = res.config
    applyConfigToDraft(res.config)
    await loadHistory()
    saveFeedback.value = '✓ 已还原'
    saveOk.value = true
    setTimeout(() => { saveFeedback.value = '' }, 3000)
  } catch (e) {
    alert(e instanceof Error ? e.message : '还原失败')
  } finally {
    restoring.value = ''
  }
}

function formatTs(ms: number): string {
  return new Date(ms).toLocaleString('zh-CN', { hour12: false })
}

onMounted(() => {
  loadConsole()
  loadConfig()
})
</script>

<style scoped>
.settings-section {
  margin-bottom: var(--sp-6);
}

.section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0 0 var(--sp-3) 0;
}

.loading-dot {
  font-weight: normal;
  color: var(--color-text-muted);
  margin-left: var(--sp-2);
}

.settings-card,
.config-group,
.config-save-bar {
  max-width: 720px;
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  margin-bottom: var(--sp-3);
}

.group-title {
  font-size: 13px;
  font-weight: 700;
  margin: 0 0 var(--sp-2) 0;
  color: var(--color-text);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.form-row {
  display: flex;
  gap: var(--sp-4);
  flex-wrap: wrap;
}

.form-row .form-group {
  flex: 1;
  min-width: 180px;
}

.form-group label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.form-hint {
  font-size: 12px;
  color: var(--color-text-muted);
  margin: 0;
}

.form-hint code {
  font-family: var(--font-mono);
  background: var(--color-surface-alt, rgba(0,0,0,0.04));
  padding: 1px 4px;
  border-radius: 3px;
}

.input-row {
  display: flex;
  gap: var(--sp-2);
}

.input-row input { flex: 1; }

.test-result {
  font-size: 13px;
  margin-top: var(--sp-1);
}

.save-actions {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}

/* Badge */
.badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 10px;
  text-transform: none;
  letter-spacing: 0;
}

.badge-ok   { background: #d1fae5; color: #065f46; }
.badge-warn { background: #fef3c7; color: #92400e; }

/* Toggle switch */
.toggle-group {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.toggle { position: relative; display: inline-block; width: 40px; height: 22px; }
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute; cursor: pointer; inset: 0;
  background: var(--color-border, #d1d5db);
  border-radius: 22px; transition: background 0.2s;
}
.toggle-slider::before {
  content: ''; position: absolute;
  height: 16px; width: 16px; left: 3px; bottom: 3px;
  background: white; border-radius: 50%; transition: transform 0.2s;
}
.toggle input:checked + .toggle-slider { background: var(--color-primary, #3b82f6); }
.toggle input:checked + .toggle-slider::before { transform: translateX(18px); }

/* History */
.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.toggle-btn {
  font-size: 12px;
  color: var(--color-text-muted);
}

.history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin-top: var(--sp-3);
}

.history-table th,
.history-table td {
  text-align: left;
  padding: var(--sp-2) var(--sp-3);
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.history-table th {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.mono { font-family: var(--font-mono); }

.note-cell {
  color: var(--color-text-muted);
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-sm {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 4px;
  border: 1px solid;
  cursor: pointer;
  background: transparent;
}

.btn-warning {
  border-color: #f59e0b;
  color: #92400e;
}

.btn-warning:hover:not(:disabled) { background: #fef3c7; }

.empty-state {
  color: var(--color-text-muted);
  font-size: 13px;
  padding: var(--sp-4) 0;
  text-align: center;
}

.config-save-bar {
  background: var(--color-surface-alt, rgba(0,0,0,0.02));
  border: 1px solid var(--color-border, #e5e7eb);
  padding: var(--sp-4);
  border-radius: var(--radius);
}
</style>
