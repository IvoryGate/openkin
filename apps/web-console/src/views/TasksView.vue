<template>
  <div>
    <div class="page-header">
      <h1>定时任务</h1>
      <div class="actions">
        <button @click="load" :disabled="loading">🔄 刷新</button>
      </div>
    </div>

    <ErrorBanner :message="error" @dismiss="error = ''" />

    <div v-if="tasks.length > 0" class="card" style="padding: 0; overflow: hidden;">
      <table>
        <thead>
          <tr>
            <th>名称</th>
            <th>触发类型</th>
            <th>Agent</th>
            <th>下次执行</th>
            <th>状态</th>
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
              <label class="toggle" @click.stop>
                <input type="checkbox" :checked="t.enabled" @change="toggleTask(t)" />
                <span class="toggle-slider"></span>
              </label>
            </td>
            <td>
              <div style="display: flex; gap: 4px;">
                <button @click="triggerNow(t.id)">立即触发</button>
                <button class="danger" @click="confirmDelete(t.id)">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <EmptyState v-else-if="!loading" icon="⏰" title="暂无定时任务" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { TaskDto } from '@openkin/shared-contracts'
import ErrorBanner from '../components/ErrorBanner.vue'
import EmptyState from '../components/EmptyState.vue'
import { listTasks, enableTask, disableTask, triggerTask, deleteTask } from '../api/operator'

const tasks = ref<TaskDto[]>([])
const loading = ref(false)
const error = ref('')

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

async function toggleTask(t: TaskDto) {
  try {
    if (t.enabled) {
      await disableTask(t.id)
    } else {
      await enableTask(t.id)
    }
    void load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function triggerNow(id: string) {
  try {
    await triggerTask(id)
    alert('已触发任务执行')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function confirmDelete(id: string) {
  if (!confirm(`删除任务 ${id}？`)) return
  try {
    await deleteTask(id)
    void load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

onMounted(load)
</script>

<style scoped>
/* Toggle reuse */
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
  width: 32px;
  height: 18px;
  background: var(--color-border);
  border-radius: 9px;
  transition: background var(--transition);
  position: relative;
}

.toggle-slider::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: white;
  transition: transform var(--transition);
}

.toggle input:checked + .toggle-slider {
  background: var(--color-success);
}

.toggle input:checked + .toggle-slider::after {
  transform: translateX(14px);
}
</style>
