<template>
  <div>
    <div class="page-header">
      <h1>
        <button class="back-btn" @click="goBack">← 返回</button>
        Trace 详情
      </h1>
      <div class="actions">
        <button @click="load" :disabled="loading">🔄 刷新</button>
      </div>
    </div>

    <ErrorBanner :message="error" @dismiss="error = ''" />

    <div v-if="trace" class="content">
      <!-- Trace header -->
      <div class="card trace-header-card">
        <div class="trace-header-grid">
          <div>
            <div class="section-label">Trace ID</div>
            <div class="mono" style="font-size:12px;word-break:break-all">{{ trace.traceId }}</div>
          </div>
          <div>
            <div class="section-label">Session</div>
            <RouterLink :to="`/sessions/${encodeURIComponent(trace.sessionId)}`" class="mono link-pill">
              {{ trace.sessionId.slice(-12) }}
            </RouterLink>
          </div>
          <div>
            <div class="section-label">Agent</div>
            <div class="mono text-muted">{{ trace.agentId }}</div>
          </div>
          <div>
            <div class="section-label">Status</div>
            <span class="badge" :class="statusClass(trace.status)">{{ trace.status }}</span>
          </div>
          <div>
            <div class="section-label">耗时</div>
            <div>{{ trace.durationMs != null ? formatDuration(trace.durationMs) : '—' }}</div>
          </div>
          <div>
            <div class="section-label">步骤数</div>
            <div>{{ trace.steps.length }}</div>
          </div>
          <div>
            <div class="section-label">创建时间</div>
            <div class="text-muted">{{ new Date(trace.createdAt).toLocaleString() }}</div>
          </div>
        </div>
      </div>

      <!-- Steps timeline -->
      <div style="margin-top:24px">
        <div class="section-label" style="margin-bottom:8px">
          推理步骤
          <span v-if="trace.steps.length > 0" style="font-weight:normal;font-size:12px;text-transform:none;letter-spacing:0;color:var(--color-text-muted);margin-left:6px">
            {{ trace.steps.length }} 步
          </span>
        </div>
        <div v-if="trace.steps.length === 0" class="empty-steps">
          <span>无步骤记录</span>
          <span class="text-muted" style="font-size:12px;margin-top:4px">
            （旧 trace 可能在此功能更新前生成，不包含步骤数据）
          </span>
        </div>
        <TraceStep v-for="step in trace.steps" :key="step.stepIndex" :step="step" />
      </div>
    </div>

    <EmptyState v-else-if="!loading" icon="🔍" title="Trace 不存在" description="该 Trace ID 未找到，可能已被删除" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { TraceDto } from '@openkin/shared-contracts'
import ErrorBanner from '../components/ErrorBanner.vue'
import EmptyState from '../components/EmptyState.vue'
import TraceStep from '../components/TraceStep.vue'
import { getTrace } from '../api/operator'

const route = useRoute()
const router = useRouter()
const traceId = route.params.traceId as string

const trace = ref<TraceDto | null>(null)
const loading = ref(false)
const error = ref('')

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    void router.push('/sessions')
  }
}

function statusClass(status: string): string {
  switch (status) {
    case 'completed': return 'badge--success'
    case 'failed':    return 'badge--error'
    case 'aborted':   return 'badge--warn'
    default:          return 'badge--muted'
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    trace.value = await getTrace(traceId)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.back-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 14px;
  margin-right: var(--sp-3);
  padding: 0;
}
.back-btn:hover { color: var(--color-text); }

.trace-header-card {
  padding: var(--sp-5);
}

.trace-header-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--sp-5);
}

.link-pill {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  color: #0369a1;
  text-decoration: none;
}
.link-pill:hover { background: #e0f2fe; }

.empty-steps {
  display: flex;
  flex-direction: column;
  padding: 16px;
  color: var(--color-text-muted);
  background: var(--color-surface-alt, #f9fafb);
  border-radius: 6px;
  border: 1px dashed var(--color-border);
}

/* Badge variants */
.badge--success { background: #d1fae5; color: #065f46; }
.badge--error   { background: #fee2e2; color: #991b1b; }
.badge--warn    { background: #fef3c7; color: #92400e; }
.badge--muted   { background: #f3f4f6; color: #6b7280; }
</style>
