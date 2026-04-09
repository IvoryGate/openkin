<template>
  <div>
    <div class="page-header">
      <h1>
        <RouterLink to="/tasks" class="back-link">← 任务</RouterLink>
        {{ task?.name ?? taskId }}
      </h1>
      <div class="actions">
        <span v-if="autoRefresh" class="auto-refresh-badge">🔄 每 {{ autoRefreshSec }}s 自动刷新</span>
        <button @click="toggleAutoRefresh" :class="autoRefresh ? 'btn-active' : ''">
          {{ autoRefresh ? '⏸ 停止刷新' : '▶ 自动刷新' }}
        </button>
        <button @click="load" :disabled="loading">🔄 刷新</button>
      </div>
    </div>

    <ErrorBanner :message="error" @dismiss="error = ''" />

    <template v-if="task">
      <!-- 任务元信息 + 调度控制 -->
      <div class="card" style="margin-bottom:16px">
        <div class="meta-header">
          <div class="task-meta-grid">
            <div>
              <div class="section-label">触发类型</div>
              <span class="badge badge--muted">{{ task.triggerType }}</span>
            </div>
            <div>
              <div class="section-label">Agent</div>
              <span class="mono">{{ task.agentId }}</span>
            </div>
            <div>
              <div class="section-label">下次执行</div>
              <span>{{ task.nextRunAt ? new Date(task.nextRunAt).toLocaleString() : '—' }}</span>
            </div>
            <div>
              <div class="section-label">触发配置</div>
              <code class="mono">{{ JSON.stringify(task.triggerConfig) }}</code>
            </div>
            <div>
              <div class="section-label">Webhook</div>
              <span class="mono text-muted" style="font-size:12px">{{ task.webhookUrl ?? '—' }}</span>
            </div>
          </div>

          <!-- 调度系统注册状态 + 操作 -->
          <div class="schedule-panel">
            <div class="schedule-status">
              <span class="status-dot" :class="task.enabled ? 'dot-on' : 'dot-off'"></span>
              <span class="status-label">{{ task.enabled ? '已注册到调度系统' : '未注册（已暂停）' }}</span>
            </div>
            <div class="schedule-actions">
              <button v-if="!task.enabled" class="btn-register" @click="doRegister" :disabled="toggling">
                {{ toggling ? '…' : '✓ 注册' }}
              </button>
              <button v-else class="btn-unregister" @click="doUnregister" :disabled="toggling">
                {{ toggling ? '…' : '○ 注销' }}
              </button>
              <button @click="doTrigger" :disabled="triggering">
                {{ triggering ? '触发中…' : '▶ 立即触发' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 编辑面板 -->
      <div class="card" style="margin-bottom:16px">
        <div class="edit-header" @click="showEdit = !showEdit">
          <span class="section-label" style="margin:0">✏️ 编辑任务</span>
          <span class="toggle-btn">{{ showEdit ? '▲ 收起' : '▼ 展开' }}</span>
        </div>

        <template v-if="showEdit">
          <div class="edit-form">
            <div class="form-row">
              <div class="form-group">
                <label>任务名称</label>
                <input v-model="edit.name" />
              </div>
              <div class="form-group">
                <label>Agent ID</label>
                <input v-model="edit.agentId" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>触发类型</label>
                <select v-model="edit.triggerType">
                  <option value="cron">cron</option>
                  <option value="interval">interval</option>
                  <option value="once">once</option>
                </select>
              </div>
              <div class="form-group">
                <label>触发配置（JSON）</label>
                <input v-model="edit.triggerConfigRaw" placeholder='{"cron":"0 9 * * *"}' class="mono" />
                <p class="form-hint" :class="triggerConfigError ? 'text-error' : ''">
                  {{ triggerConfigError || 'JSON 格式' }}
                </p>
              </div>
            </div>

            <div class="form-group">
              <label>触发文本（input.text）</label>
              <textarea v-model="edit.inputText" rows="3" />
            </div>

            <div class="form-group">
              <label>Webhook URL（留空则清除）</label>
              <input v-model="edit.webhookUrl" placeholder="https://…" />
            </div>

            <div class="form-actions">
              <button class="primary" @click="doUpdate" :disabled="updating">
                {{ updating ? '保存中…' : '保存修改' }}
              </button>
              <button @click="resetEdit">重置</button>
              <span v-if="editFeedback" :class="editOk ? 'text-success' : 'text-error'">{{ editFeedback }}</span>
            </div>
          </div>
        </template>
      </div>

      <!-- 执行历史 -->
      <div class="runs-header">
        <div class="section-label" style="margin:0">
          执行历史
          <span class="runs-count" v-if="runs.length > 0">{{ runs.length }} 条</span>
        </div>
        <div class="runs-stats" v-if="runs.length > 0">
          <span class="stat-pill stat-ok">✓ {{ completedCount }}</span>
          <span class="stat-pill stat-fail">✗ {{ failedCount }}</span>
          <span class="stat-pill stat-running" v-if="runningCount > 0">⟳ {{ runningCount }}</span>
          <span v-if="avgDuration" class="stat-text">均耗时 {{ avgDuration }}</span>
        </div>
      </div>

      <div v-if="runs.length > 0" class="card" style="padding:0;overflow:hidden;margin-top:8px">
        <table>
          <thead>
            <tr>
              <th style="width:28px"></th>
              <th>Run ID</th>
              <th>状态</th>
              <th>开始时间</th>
              <th>耗时</th>
              <th>重试</th>
              <th>Trace / Session</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="r in runs" :key="r.id">
              <!-- 主行 -->
              <tr
                class="run-row"
                :class="{ 'run-row--expanded': expandedRuns.has(r.id), 'run-row--running': r.status === 'running' }"
                @click="toggleRun(r.id)"
              >
                <td class="expand-cell">
                  <span class="expand-icon">{{ expandedRuns.has(r.id) ? '▼' : '▶' }}</span>
                </td>
                <td class="mono text-muted">{{ r.id.slice(-8) }}</td>
                <td>
                  <span class="badge" :class="runStatusClass(r.status)">
                    {{ r.status === 'running' ? '⟳ 运行中' : r.status === 'completed' ? '✓ 成功' : '✗ 失败' }}
                  </span>
                </td>
                <td class="text-muted">{{ new Date(r.startedAt).toLocaleString() }}</td>
                <td class="text-muted">
                  {{ r.completedAt ? formatDuration(r.completedAt - r.startedAt) : r.status === 'running' ? '进行中…' : '—' }}
                </td>
                <td class="text-muted">{{ r.retryCount > 0 ? `×${r.retryCount}` : '—' }}</td>
                <td>
                  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                    <RouterLink
                      v-if="r.traceId"
                      :to="`/traces/${encodeURIComponent(r.traceId)}`"
                      class="mono link-sm"
                      @click.stop
                    >Trace {{ r.traceId.slice(-8) }}</RouterLink>
                    <RouterLink
                      v-if="r.sessionId"
                      :to="`/sessions/${encodeURIComponent(r.sessionId)}`"
                      class="mono link-sm"
                      @click.stop
                    >Session {{ r.sessionId.slice(-8) }}</RouterLink>
                    <span v-if="!r.traceId && !r.sessionId" class="text-muted">—</span>
                  </div>
                </td>
              </tr>

              <!-- 展开详情行 -->
              <tr v-if="expandedRuns.has(r.id)" class="detail-row">
                <td></td>
                <td colspan="6">
                  <div class="detail-panel">
                    <!-- output -->
                    <template v-if="r.output != null">
                      <div class="detail-label">输出（Agent 回复）</div>
                      <!-- Mock LLM 提示 -->
                      <div v-if="isMockOutput(r.output)" class="mock-warning">
                        ⚠️ 当前使用 <strong>MockLLMProvider</strong>（未配置 LLM API Key），输出仅为 Echo 回显，不是真实 AI 响应。
                        请前往 <RouterLink to="/settings">Settings → LLM</RouterLink> 配置 API Key。
                      </div>
                      <div class="detail-output">
                        <pre v-if="typeof r.output === 'object'">{{ JSON.stringify(r.output, null, 2) }}</pre>
                        <pre v-else>{{ r.output }}</pre>
                      </div>
                    </template>
                    <template v-else-if="r.status === 'completed'">
                      <div class="detail-output text-muted" style="font-style:italic">（无输出内容）</div>
                    </template>

                    <!-- error -->
                    <template v-if="r.error != null">
                      <div class="detail-label text-error">错误信息</div>
                      <div class="detail-error">
                        <pre v-if="typeof r.error === 'object'">{{ JSON.stringify(r.error, null, 2) }}</pre>
                        <pre v-else>{{ r.error }}</pre>
                      </div>
                    </template>

                    <!-- running state -->
                    <template v-if="r.status === 'running'">
                      <div class="detail-label">进度</div>
                      <div class="detail-progress">
                        <div v-if="r.progress != null" class="progress-bar-wrap">
                          <div class="progress-bar" :style="{ width: `${r.progress}%` }"></div>
                          <span>{{ r.progress }}%</span>
                        </div>
                        <div v-if="r.progressMsg" class="text-muted" style="font-size:12px;margin-top:4px">{{ r.progressMsg }}</div>
                        <div v-if="r.progress == null && !r.progressMsg" class="text-muted" style="font-style:italic">运行中，暂无进度信息…</div>
                      </div>
                    </template>

                    <!-- meta info -->
                    <div class="detail-meta">
                      <span>Run ID: <code>{{ r.id }}</code></span>
                      <span>开始: {{ new Date(r.startedAt).toLocaleString() }}</span>
                      <span v-if="r.completedAt">完成: {{ new Date(r.completedAt).toLocaleString() }}</span>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <EmptyState v-else-if="!loading" icon="📊" title="暂无执行记录" description="任务触发执行后，每次运行的状态和结果会在此显示" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import type { TaskDto, TaskRunDto } from '@theworld/shared-contracts'
import ErrorBanner from '../components/ErrorBanner.vue'
import EmptyState from '../components/EmptyState.vue'
import { getTask, listTaskRuns, enableTask, disableTask, triggerTask, updateTask } from '../api/operator'

const route = useRoute()
const taskId = route.params.id as string

const task = ref<TaskDto | null>(null)
const runs = ref<TaskRunDto[]>([])
const loading = ref(false)
const error = ref('')

// ── 自动刷新 ──────────────────────────────────────────────────────────────────
const autoRefresh = ref(false)
const autoRefreshSec = 10
let refreshTimer: ReturnType<typeof setInterval> | null = null

function toggleAutoRefresh() {
  autoRefresh.value = !autoRefresh.value
  if (autoRefresh.value) {
    refreshTimer = setInterval(() => { void loadRuns() }, autoRefreshSec * 1000)
  } else {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null }
  }
}

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})

// ── 展开详情 ──────────────────────────────────────────────────────────────────
const expandedRuns = reactive(new Set<string>())

function toggleRun(id: string) {
  if (expandedRuns.has(id)) expandedRuns.delete(id)
  else expandedRuns.add(id)
}

// ── 统计 ──────────────────────────────────────────────────────────────────────
const completedCount = computed(() => runs.value.filter(r => r.status === 'completed').length)
const failedCount    = computed(() => runs.value.filter(r => r.status === 'failed').length)
const runningCount   = computed(() => runs.value.filter(r => r.status === 'running').length)

const avgDuration = computed(() => {
  const finished = runs.value.filter(r => r.completedAt != null)
  if (finished.length === 0) return null
  const avg = finished.reduce((s, r) => s + (r.completedAt! - r.startedAt), 0) / finished.length
  return formatDuration(avg)
})

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
}

// ── 调度注册 / 注销 ──────────────────────────────────────────────────────────
const toggling = ref(false)
const triggering = ref(false)

async function doRegister() {
  toggling.value = true
  try { await enableTask(taskId); await loadTask() }
  catch (e) { error.value = e instanceof Error ? e.message : String(e) }
  finally { toggling.value = false }
}

async function doUnregister() {
  if (!confirm('注销后任务不再被调度系统触发（数据保留，可重新注册）。确认？')) return
  toggling.value = true
  try { await disableTask(taskId); await loadTask() }
  catch (e) { error.value = e instanceof Error ? e.message : String(e) }
  finally { toggling.value = false }
}

async function doTrigger() {
  triggering.value = true
  try {
    await triggerTask(taskId)
    // 触发后 2s 刷新执行记录，让新增的 running 行可见
    setTimeout(() => { void loadRuns() }, 2000)
    setTimeout(() => { void loadRuns() }, 6000)
  }
  catch (e) { error.value = e instanceof Error ? e.message : String(e) }
  finally { triggering.value = false }
}

// ── 编辑 ─────────────────────────────────────────────────────────────────────
const showEdit = ref(false)

interface EditForm {
  name: string
  agentId: string
  triggerType: 'cron' | 'interval' | 'once'
  triggerConfigRaw: string
  inputText: string
  webhookUrl: string
}

const edit = reactive<EditForm>({
  name: '', agentId: '', triggerType: 'cron',
  triggerConfigRaw: '{}', inputText: '', webhookUrl: '',
})

const triggerConfigError = ref('')
const updating = ref(false)
const editFeedback = ref('')
const editOk = ref(false)

function applyTaskToEdit(t: TaskDto) {
  edit.name = t.name
  edit.agentId = t.agentId
  edit.triggerType = t.triggerType
  edit.triggerConfigRaw = JSON.stringify(t.triggerConfig, null, 2)
  edit.inputText = (t.input as { text?: string }).text ?? ''
  edit.webhookUrl = t.webhookUrl ?? ''
}

function resetEdit() {
  if (task.value) applyTaskToEdit(task.value)
  triggerConfigError.value = ''
  editFeedback.value = ''
}

async function doUpdate() {
  triggerConfigError.value = ''
  let triggerConfig: Record<string, unknown>
  try {
    triggerConfig = JSON.parse(edit.triggerConfigRaw) as Record<string, unknown>
  } catch {
    triggerConfigError.value = 'JSON 格式错误'
    return
  }

  updating.value = true
  editFeedback.value = ''
  try {
    const updated = await updateTask(taskId, {
      name: edit.name,
      agentId: edit.agentId,
      triggerType: edit.triggerType,
      triggerConfig,
      input: { text: edit.inputText },
      webhookUrl: edit.webhookUrl.trim() || null,
    })
    task.value = updated
    applyTaskToEdit(updated)
    editFeedback.value = '✓ 已保存'
    editOk.value = true
  } catch (e) {
    editFeedback.value = e instanceof Error ? e.message : '保存失败'
    editOk.value = false
  } finally {
    updating.value = false
    setTimeout(() => { editFeedback.value = '' }, 3000)
  }
}

// ── Mock LLM 检测 ─────────────────────────────────────────────────────────────
/**
 * 检测输出是否来自 MockLLMProvider（输出文本以 "Echo: " 开头）
 * 如果是，说明服务器未配置真实 LLM API Key
 */
function isMockOutput(output: unknown): boolean {
  if (output == null) return false
  // output 格式: { status: 'completed', text: { role, content: [{type:'text', text:'Echo: ...'}] } }
  try {
    const o = output as Record<string, unknown>
    const textField = o.text
    if (textField && typeof textField === 'object') {
      const msg = textField as { content?: Array<{ type: string; text?: string }> }
      const firstPart = msg.content?.[0]
      if (firstPart?.type === 'text' && typeof firstPart.text === 'string') {
        return firstPart.text.startsWith('Echo: ') || firstPart.text.startsWith('Tool result received: ')
      }
    }
    // 字符串形式兜底
    if (typeof output === 'string') {
      return output.includes('"Echo: ') || output.includes('"Tool result received: ')
    }
  } catch {
    // ignore
  }
  return false
}

// ── 数据加载 ─────────────────────────────────────────────────────────────────
function runStatusClass(status: string): string {
  switch (status) {
    case 'completed': return 'badge--success'
    case 'failed':    return 'badge--error'
    case 'running':   return 'badge--info'
    default:          return 'badge--muted'
  }
}

async function loadTask() {
  task.value = await getTask(taskId)
  if (task.value) applyTaskToEdit(task.value)
}

async function loadRuns() {
  const r = await listTaskRuns(taskId)
  runs.value = r.runs
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [t, r] = await Promise.all([getTask(taskId), listTaskRuns(taskId)])
    task.value = t
    runs.value = r.runs
    applyTaskToEdit(t)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.back-link { margin-right: var(--sp-3); color: var(--color-text-muted); }

/* 自动刷新 */
.auto-refresh-badge {
  font-size: 12px;
  color: var(--color-text-muted);
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 4px;
  padding: 2px 8px;
}

.btn-active {
  background: #f0fdf4 !important;
  border-color: #10b981 !important;
  color: #065f46 !important;
}

/* 元信息 + 调度面板并排 */
.meta-header {
  display: flex;
  gap: var(--sp-6);
  flex-wrap: wrap;
  align-items: flex-start;
}

.task-meta-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--sp-4);
}

/* 调度状态面板 */
.schedule-panel {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  min-width: 180px;
  padding: var(--sp-4);
  border-left: 1px solid var(--color-border, #e5e7eb);
}

.schedule-status {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: 13px;
  font-weight: 600;
}

.status-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.dot-on  { background: #10b981; box-shadow: 0 0 0 2px #d1fae5; }
.dot-off { background: #9ca3af; }

.status-label { color: var(--color-text); }

.schedule-actions {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.btn-register, .btn-unregister {
  width: 100%;
  padding: 5px 12px;
  border-radius: 5px;
  border: 1px solid;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.btn-register   { border-color: #10b981; color: #065f46; background: #d1fae5; }
.btn-register:hover:not(:disabled)   { background: #a7f3d0; }
.btn-unregister { border-color: #f59e0b; color: #92400e; background: #fef3c7; }
.btn-unregister:hover:not(:disabled) { background: #fde68a; }

/* 编辑面板 */
.edit-header {
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

.edit-form {
  margin-top: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.form-row {
  display: flex;
  gap: var(--sp-4);
  flex-wrap: wrap;
}

.form-row .form-group { flex: 1; min-width: 200px; }

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.form-group label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-hint {
  font-size: 11px;
  color: var(--color-text-muted);
  margin: 0;
}

.form-actions {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}

/* 执行历史头部 */
.runs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0;
  flex-wrap: wrap;
  gap: var(--sp-3);
}

.runs-count {
  margin-left: var(--sp-2);
  font-size: 12px;
  font-weight: normal;
  color: var(--color-text-muted);
  text-transform: none;
  letter-spacing: 0;
}

.runs-stats {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.stat-pill {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
}

.stat-ok      { background: #d1fae5; color: #065f46; }
.stat-fail    { background: #fee2e2; color: #991b1b; }
.stat-running { background: #dbeafe; color: #1e40af; }
.stat-text    { font-size: 12px; color: var(--color-text-muted); }

/* 可展开行 */
.run-row {
  cursor: pointer;
  transition: background 0.1s;
}

.run-row:hover { background: var(--color-surface-alt, #f9fafb); }
.run-row--expanded { background: #f0f9ff; }
.run-row--running td { font-style: italic; }

.expand-cell { padding: 0 8px !important; text-align: center; }
.expand-icon { font-size: 10px; color: var(--color-text-muted); }

/* 详情面板 */
.detail-row { background: #f8fafc; }
.detail-row td { padding: 0 !important; }

.detail-panel {
  padding: 12px 16px 16px;
  border-top: 1px solid var(--color-border, #e5e7eb);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  margin-bottom: 2px;
}

.detail-output pre,
.detail-error pre {
  margin: 0;
  font-size: 12px;
  font-family: var(--font-mono, monospace);
  white-space: pre-wrap;
  word-break: break-all;
  padding: 10px 12px;
  border-radius: 6px;
  max-height: 300px;
  overflow-y: auto;
  line-height: 1.6;
}

.detail-output pre { background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; }
.detail-error  pre { background: #fff1f2; color: #9f1239; border: 1px solid #fecdd3; }

.detail-progress { padding: 4px 0; }

.progress-bar-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.progress-bar-wrap > .progress-bar {
  flex: 1;
  height: 6px;
  background: #3b82f6;
  border-radius: 3px;
  transition: width 0.3s;
}

.progress-bar-wrap > span {
  font-size: 12px;
  color: var(--color-text-muted);
  min-width: 36px;
  text-align: right;
}

.detail-meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--color-text-muted);
  border-top: 1px solid var(--color-border, #f0f0f0);
  padding-top: 8px;
  margin-top: 4px;
}

.detail-meta code {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  background: rgba(0,0,0,0.04);
  padding: 1px 4px;
  border-radius: 3px;
}

.link-sm {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  color: #0369a1;
  text-decoration: none;
}

.link-sm:hover { background: #e0f2fe; }

/* Mock LLM 警告 */
.mock-warning {
  font-size: 12px;
  padding: 8px 12px;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 6px;
  color: #92400e;
  line-height: 1.6;
}

.mock-warning a {
  color: #b45309;
  font-weight: 600;
  text-decoration: underline;
}

/* Badge variants */
.badge--success { background: #d1fae5; color: #065f46; }
.badge--error   { background: #fee2e2; color: #991b1b; }
.badge--info    { background: #dbeafe; color: #1e40af; }
.badge--muted   { background: #f3f4f6; color: #6b7280; }
</style>
