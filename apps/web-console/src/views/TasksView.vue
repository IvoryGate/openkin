<template>
  <div>
    <div class="page-header">
      <h1>定时任务</h1>
      <div class="actions">
        <button class="primary" @click="showCreate = !showCreate">
          {{ showCreate ? '✕ 取消' : '＋ 创建任务' }}
        </button>
        <button @click="load" :disabled="loading">🔄 刷新</button>
      </div>
    </div>

    <ErrorBanner :message="error" @dismiss="error = ''" />

    <!-- 创建表单 -->
    <div v-if="showCreate" class="card create-form">
      <h3 class="form-title">创建定时任务</h3>

      <div class="form-row">
        <div class="form-group">
          <label>任务名称 *</label>
          <input v-model="form.name" placeholder="每日报告" />
        </div>
        <div class="form-group">
          <label>Agent ID *</label>
          <input v-model="form.agentId" placeholder="default" />
          <p class="form-hint">使用 <code>default</code> 或已创建的 Agent ID</p>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>触发类型 *</label>
          <select v-model="form.triggerType">
            <option value="cron">cron（定时）</option>
            <option value="interval">interval（间隔）</option>
            <option value="once">once（单次）</option>
          </select>
        </div>
        <div class="form-group">
          <label>触发配置 *</label>
          <template v-if="form.triggerType === 'cron'">
            <input v-model="form.cronExpr" placeholder="0 9 * * *（每天9点）" />
            <p class="form-hint">标准 cron 表达式，UTC 时区</p>
          </template>
          <template v-else-if="form.triggerType === 'interval'">
            <div class="input-inline">
              <input type="number" v-model.number="form.intervalMs" placeholder="60000" min="1000" style="width:140px" />
              <span class="unit">毫秒</span>
            </div>
            <div class="input-inline" style="margin-top:6px">
              <label style="font-weight:normal;font-size:12px;text-transform:none;letter-spacing:0">最大次数（留空=无限）</label>
              <input type="number" v-model.number="form.intervalMaxRuns" placeholder="∞" min="1" style="width:80px;margin-left:8px" />
            </div>
          </template>
          <template v-else>
            <input v-model="form.onceAt" type="datetime-local" />
            <p class="form-hint">单次执行时间（本地时间）</p>
          </template>
        </div>
      </div>

      <div class="form-group">
        <label>触发文本（Agent 收到的 input.text）*</label>
        <textarea v-model="form.inputText" rows="3" placeholder="生成今日摘要并发送报告" />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Webhook URL（可选）</label>
          <input v-model="form.webhookUrl" placeholder="https://example.com/webhook" />
          <p class="form-hint">任务完成后 POST TaskRunEvent JSON 到此 URL</p>
        </div>
        <div class="form-group toggle-row">
          <label>创建后立即注册到调度系统</label>
          <label class="toggle">
            <input type="checkbox" v-model="form.enabled" />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div class="form-actions">
        <button class="primary" @click="doCreate" :disabled="creating">
          {{ creating ? '创建中…' : '✓ 创建并注册' }}
        </button>
        <button @click="resetForm">重置</button>
        <span v-if="createError" class="text-error">{{ createError }}</span>
      </div>
    </div>

    <!-- 任务列表 -->
    <div v-if="tasks.length > 0" class="card" style="padding: 0; overflow: hidden;">
      <table>
        <thead>
          <tr>
            <th>名称</th>
            <th>触发类型</th>
            <th>Agent</th>
            <th>下次执行</th>
            <th>调度状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in tasks" :key="t.id">
            <td>
              <RouterLink :to="`/tasks/${encodeURIComponent(t.id)}`">{{ t.name }}</RouterLink>
            </td>
            <td><span class="badge badge--muted">{{ t.triggerType }}</span></td>
            <td class="mono text-muted">{{ t.agentId }}</td>
            <td class="text-muted">{{ t.nextRunAt ? new Date(t.nextRunAt).toLocaleString() : '—' }}</td>
            <td>
              <span class="badge" :class="t.enabled ? 'badge--success' : 'badge--muted'">
                {{ t.enabled ? '✓ 已注册' : '○ 未注册' }}
              </span>
            </td>
            <td>
              <div class="btn-group">
                <button v-if="!t.enabled" class="btn-sm btn-ok" @click="registerTask(t.id)">注册</button>
                <button v-else class="btn-sm btn-warn" @click="unregisterTask(t.id)">注销</button>
                <button class="btn-sm" @click="triggerNow(t.id)">立即触发</button>
                <button class="btn-sm btn-danger" @click="confirmDelete(t.id)">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <EmptyState v-else-if="!loading" icon="⏰" title="暂无定时任务" description="点击右上角「创建任务」添加第一个定时任务" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import type { TaskDto } from '@openkin/shared-contracts'
import ErrorBanner from '../components/ErrorBanner.vue'
import EmptyState from '../components/EmptyState.vue'
import {
  listTasks, enableTask, disableTask, triggerTask, deleteTask, createTask,
} from '../api/operator'

const tasks = ref<TaskDto[]>([])
const loading = ref(false)
const error = ref('')

// ── 创建表单 state ────────────────────────────────────────────────────────────
const showCreate = ref(false)
const creating = ref(false)
const createError = ref('')

interface CreateForm {
  name: string
  agentId: string
  triggerType: 'cron' | 'interval' | 'once'
  cronExpr: string
  intervalMs: number
  intervalMaxRuns: number | null
  onceAt: string
  inputText: string
  webhookUrl: string
  enabled: boolean
}

function makeDefaultForm(): CreateForm {
  return {
    name: '',
    agentId: 'default',
    triggerType: 'cron',
    cronExpr: '',
    intervalMs: 60000,
    intervalMaxRuns: null,
    onceAt: '',
    inputText: '',
    webhookUrl: '',
    enabled: true,
  }
}

const form = reactive<CreateForm>(makeDefaultForm())

function resetForm() {
  Object.assign(form, makeDefaultForm())
  createError.value = ''
}

function buildTriggerConfig(): Record<string, unknown> {
  if (form.triggerType === 'cron') {
    return { cron: form.cronExpr.trim() }
  }
  if (form.triggerType === 'interval') {
    const cfg: Record<string, unknown> = { intervalMs: form.intervalMs }
    if (form.intervalMaxRuns && form.intervalMaxRuns > 0) cfg.maxRuns = form.intervalMaxRuns
    return cfg
  }
  // once
  const ms = form.onceAt ? new Date(form.onceAt).getTime() : Date.now() + 60_000
  return { at: ms }
}

async function doCreate() {
  createError.value = ''
  if (!form.name.trim()) { createError.value = '任务名称不能为空'; return }
  if (!form.agentId.trim()) { createError.value = 'Agent ID 不能为空'; return }
  if (!form.inputText.trim()) { createError.value = '触发文本不能为空'; return }
  if (form.triggerType === 'cron' && !form.cronExpr.trim()) { createError.value = 'cron 表达式不能为空'; return }

  creating.value = true
  try {
    await createTask({
      name: form.name.trim(),
      agentId: form.agentId.trim(),
      triggerType: form.triggerType,
      triggerConfig: buildTriggerConfig(),
      input: { text: form.inputText.trim() },
      enabled: form.enabled,
      createdBy: 'user',
      ...(form.webhookUrl.trim() ? { webhookUrl: form.webhookUrl.trim() } : {}),
    })
    showCreate.value = false
    resetForm()
    void load()
  } catch (e) {
    createError.value = e instanceof Error ? e.message : '创建失败'
  } finally {
    creating.value = false
  }
}

// ── 列表操作 ──────────────────────────────────────────────────────────────────
async function load() {
  loading.value = true
  error.value = ''
  try {
    const result = await listTasks()
    tasks.value = result.tasks
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function registerTask(id: string) {
  try { await enableTask(id); void load() }
  catch (e) { error.value = e instanceof Error ? e.message : String(e) }
}

async function unregisterTask(id: string) {
  if (!confirm('注销后任务将不再被调度系统触发（数据保留，可重新注册）。确认？')) return
  try { await disableTask(id); void load() }
  catch (e) { error.value = e instanceof Error ? e.message : String(e) }
}

async function triggerNow(id: string) {
  try { await triggerTask(id); alert('已触发任务执行') }
  catch (e) { error.value = e instanceof Error ? e.message : String(e) }
}

async function confirmDelete(id: string) {
  if (!confirm(`永久删除任务 ${id}？同时删除所有执行记录。`)) return
  try { await deleteTask(id); void load() }
  catch (e) { error.value = e instanceof Error ? e.message : String(e) }
}

onMounted(load)
</script>

<style scoped>
/* ── 创建表单 ─────────────────────────────────────────────────────────────── */
.create-form {
  max-width: 820px;
  margin-bottom: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.form-title {
  font-size: 14px;
  font-weight: 700;
  margin: 0;
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

.form-hint code {
  font-family: var(--font-mono);
  background: var(--color-surface-alt, rgba(0,0,0,0.04));
  padding: 1px 4px;
  border-radius: 3px;
}

.input-inline {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.unit {
  font-size: 12px;
  color: var(--color-text-muted);
}

.toggle-row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding-top: 20px;  /* align with inputs */
}

.form-actions {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}

/* ── 调度状态 badge ───────────────────────────────────────────────────────── */
.badge--success { background: #d1fae5; color: #065f46; }
.badge--muted   { background: #f3f4f6; color: #6b7280; }

/* ── 按钮组 ──────────────────────────────────────────────────────────────── */
.btn-group {
  display: flex;
  gap: 4px;
}

.btn-sm {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  cursor: pointer;
  background: transparent;
  white-space: nowrap;
}

.btn-sm:hover:not(:disabled) { background: var(--color-surface-alt, #f9fafb); }
.btn-ok     { border-color: #10b981; color: #065f46; }
.btn-ok:hover:not(:disabled)   { background: #d1fae5; }
.btn-warn   { border-color: #f59e0b; color: #92400e; }
.btn-warn:hover:not(:disabled) { background: #fef3c7; }
.btn-danger { border-color: #ef4444; color: #991b1b; }
.btn-danger:hover:not(:disabled) { background: #fee2e2; }

/* ── Toggle ──────────────────────────────────────────────────────────────── */
.toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.toggle-slider {
  width: 36px;
  height: 20px;
  background: var(--color-border);
  border-radius: 10px;
  transition: background var(--transition);
  position: relative;
}

.toggle-slider::after {
  content: '';
  position: absolute;
  top: 4px;
  left: 4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: white;
  transition: transform var(--transition);
}

.toggle input:checked + .toggle-slider { background: var(--color-success, #10b981); }
.toggle input:checked + .toggle-slider::after { transform: translateX(16px); }
</style>
