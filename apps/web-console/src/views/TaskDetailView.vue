<template>
  <div>
    <div class="page-header">
      <h1>
        <RouterLink to="/tasks" class="back-link">← 任务</RouterLink>
        {{ task?.name ?? taskId }}
      </h1>
      <div class="actions">
        <button @click="load" :disabled="loading">🔄 刷新</button>
      </div>
    </div>

    <ErrorBanner :message="error" @dismiss="error = ''" />

    <div v-if="task" class="card" style="margin-bottom: 24px;">
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
          <div class="section-label">状态</div>
          <span class="badge" :class="task.enabled ? 'badge--success' : 'badge--muted'">
            {{ task.enabled ? 'enabled' : 'disabled' }}
          </span>
        </div>
        <div>
          <div class="section-label">触发配置</div>
          <code>{{ JSON.stringify(task.triggerConfig) }}</code>
        </div>
      </div>
    </div>

    <div class="section-label">执行历史</div>
    <div v-if="runs.length > 0" class="card" style="padding: 0; overflow: hidden;">
      <table>
        <thead>
          <tr>
            <th>Run ID</th>
            <th>状态</th>
            <th>开始时间</th>
            <th>耗时</th>
            <th>Trace</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in runs" :key="r.id">
            <td class="mono text-muted">{{ r.id.slice(-8) }}</td>
            <td>
              <span class="badge" :class="runStatusClass(r.status)">{{ r.status }}</span>
            </td>
            <td class="text-muted">{{ new Date(r.startedAt).toLocaleString() }}</td>
            <td class="text-muted">
              {{ r.completedAt ? `${r.completedAt - r.startedAt}ms` : '—' }}
            </td>
            <td>
              <RouterLink
                v-if="r.traceId"
                :to="`/traces/${encodeURIComponent(r.traceId)}`"
                class="mono"
              >
                {{ r.traceId.slice(-12) }}
              </RouterLink>
              <span v-else class="text-muted">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <EmptyState v-else-if="!loading" icon="📊" title="暂无执行记录" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import type { TaskDto, TaskRunDto } from '@openkin/shared-contracts'
import ErrorBanner from '../components/ErrorBanner.vue'
import EmptyState from '../components/EmptyState.vue'
import { getTask, listTaskRuns } from '../api/operator'

const route = useRoute()
const taskId = route.params.id as string

const task = ref<TaskDto | null>(null)
const runs = ref<TaskRunDto[]>([])
const loading = ref(false)
const error = ref('')

function runStatusClass(status: string): string {
  switch (status) {
    case 'completed': return 'badge--success'
    case 'failed': return 'badge--error'
    case 'running': return 'badge--info'
    default: return 'badge--muted'
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [t, r] = await Promise.all([getTask(taskId), listTaskRuns(taskId)])
    task.value = t
    runs.value = r.runs
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

.task-meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--sp-4);
}
</style>
