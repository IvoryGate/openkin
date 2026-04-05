<template>
  <div>
    <div class="page-header">
      <h1>
        <RouterLink to="/sessions" class="back-link">← 会话</RouterLink>
        Trace 详情
      </h1>
    </div>

    <ErrorBanner :message="error" @dismiss="error = ''" />

    <div v-if="trace" class="content">
      <!-- Trace header -->
      <div class="card trace-header-card">
        <div class="trace-header-grid">
          <div>
            <div class="section-label">Trace ID</div>
            <div class="mono">{{ trace.traceId }}</div>
          </div>
          <div>
            <div class="section-label">Session</div>
            <RouterLink :to="`/sessions/${encodeURIComponent(trace.sessionId)}`" class="mono">
              {{ trace.sessionId.slice(-12) }}
            </RouterLink>
          </div>
          <div>
            <div class="section-label">Status</div>
            <span class="badge" :class="statusClass(trace.status)">{{ trace.status }}</span>
          </div>
          <div>
            <div class="section-label">Duration</div>
            <div>{{ trace.durationMs != null ? `${trace.durationMs}ms` : '—' }}</div>
          </div>
          <div>
            <div class="section-label">Steps</div>
            <div>{{ trace.steps.length }}</div>
          </div>
          <div>
            <div class="section-label">Created</div>
            <div class="text-muted">{{ new Date(trace.createdAt).toLocaleString() }}</div>
          </div>
        </div>
      </div>

      <!-- Steps timeline -->
      <div style="margin-top: 24px;">
        <div class="section-label">推理步骤</div>
        <div v-if="trace.steps.length === 0" class="text-muted" style="padding: 16px;">无步骤记录</div>
        <TraceStep v-for="step in trace.steps" :key="step.stepIndex" :step="step" />
      </div>
    </div>

    <EmptyState v-else-if="!loading" icon="🔍" title="Trace 不存在" subtitle="该 Trace ID 未找到，可能已被删除" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import type { TraceDto } from '@openkin/shared-contracts'
import ErrorBanner from '../components/ErrorBanner.vue'
import EmptyState from '../components/EmptyState.vue'
import TraceStep from '../components/TraceStep.vue'
import { getTrace } from '../api/operator'

const route = useRoute()
const traceId = route.params.traceId as string

const trace = ref<TraceDto | null>(null)
const loading = ref(false)
const error = ref('')

function statusClass(status: string): string {
  switch (status) {
    case 'completed': return 'badge--success'
    case 'failed': return 'badge--error'
    case 'aborted': return 'badge--warn'
    default: return 'badge--muted'
  }
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
.back-link { margin-right: var(--sp-3); color: var(--color-text-muted); }

.trace-header-card {
  padding: var(--sp-5);
}

.trace-header-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--sp-5);
}
</style>
