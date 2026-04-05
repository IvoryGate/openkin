<template>
  <div>
    <div class="page-header">
      <h1>Trace 列表</h1>
      <div class="actions">
        <button @click="load" :disabled="loading">🔄 刷新</button>
      </div>
    </div>

    <!-- 过滤栏 -->
    <div class="filter-bar">
      <select v-model="filterStatus" @change="resetAndLoad">
        <option value="">全部状态</option>
        <option value="completed">completed</option>
        <option value="failed">failed</option>
        <option value="aborted">aborted</option>
      </select>
      <span class="total-hint" v-if="total > 0">共 {{ total }} 条</span>
    </div>

    <ErrorBanner :message="error" @dismiss="error = ''" />

    <div v-if="traces.length > 0" class="card" style="padding:0;overflow:hidden">
      <table>
        <thead>
          <tr>
            <th>Trace ID</th>
            <th>Session</th>
            <th>Agent</th>
            <th>状态</th>
            <th>步骤</th>
            <th>耗时</th>
            <th>时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in traces" :key="t.traceId">
            <td>
              <RouterLink :to="`/traces/${encodeURIComponent(t.traceId)}`" class="mono link-pill">
                {{ t.traceId.slice(-14) }}
              </RouterLink>
            </td>
            <td>
              <RouterLink :to="`/sessions/${encodeURIComponent(t.sessionId)}`" class="mono text-muted link-sm">
                {{ t.sessionId.slice(-8) }}
              </RouterLink>
            </td>
            <td class="mono text-muted">{{ t.agentId ?? '—' }}</td>
            <td>
              <span class="badge" :class="statusClass(t.status)">{{ t.status }}</span>
            </td>
            <td class="text-muted">{{ t.stepCount }}</td>
            <td class="text-muted">{{ t.durationMs != null ? formatDuration(t.durationMs) : '—' }}</td>
            <td class="text-muted">{{ new Date(t.createdAt).toLocaleString() }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <EmptyState v-else-if="!loading" icon="🔍" title="暂无 Trace 记录" description="运行过的 Agent 请求会在此显示" />

    <!-- 分页 -->
    <div class="pagination" v-if="traces.length > 0 || offset > 0">
      <button @click="prevPage" :disabled="offset === 0 || loading">← 上一页</button>
      <span class="page-info">第 {{ Math.floor(offset / limit) + 1 }} 页，每页 {{ limit }} 条</span>
      <button @click="nextPage" :disabled="!hasMore || loading">下一页 →</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { TraceSummaryDto } from '@openkin/shared-contracts'
import ErrorBanner from '../components/ErrorBanner.vue'
import EmptyState from '../components/EmptyState.vue'
import { listTraces } from '../api/operator'

const LIMIT = 50

const filterStatus = ref('')
const traces = ref<TraceSummaryDto[]>([])
const total = ref(0)
const offset = ref(0)
const limit = ref(LIMIT)
const hasMore = ref(false)
const loading = ref(false)
const error = ref('')

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
    const result = await listTraces({
      limit: limit.value + 1,
      offset: offset.value,
      status: filterStatus.value || undefined,
    })
    hasMore.value = result.traces.length > limit.value
    traces.value = hasMore.value ? result.traces.slice(0, limit.value) : result.traces
    total.value = result.total
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function resetAndLoad() {
  offset.value = 0
  void load()
}

function prevPage() {
  offset.value = Math.max(0, offset.value - limit.value)
  void load()
}

function nextPage() {
  offset.value += limit.value
  void load()
}

onMounted(resetAndLoad)
</script>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  margin-bottom: var(--sp-4);
  flex-wrap: wrap;
}

.total-hint {
  font-size: 12px;
  color: var(--color-text-muted);
}

.link-pill {
  font-size: 12px;
  font-family: var(--font-mono);
  padding: 2px 8px;
  border-radius: 4px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  color: #0369a1;
  text-decoration: none;
  white-space: nowrap;
}
.link-pill:hover { background: #e0f2fe; }

.link-sm {
  font-size: 11px;
  font-family: var(--font-mono);
  padding: 1px 5px;
  border-radius: 3px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #475569;
  text-decoration: none;
}
.link-sm:hover { background: #f1f5f9; }

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-4);
  margin-top: var(--sp-4);
}

.page-info {
  font-size: 13px;
  color: var(--color-text-muted);
}

/* Badge variants */
.badge--success { background: #d1fae5; color: #065f46; }
.badge--error   { background: #fee2e2; color: #991b1b; }
.badge--warn    { background: #fef3c7; color: #92400e; }
.badge--muted   { background: #f3f4f6; color: #6b7280; }
</style>
