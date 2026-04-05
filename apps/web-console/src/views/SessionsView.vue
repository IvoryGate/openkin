<template>
  <div>
    <div class="page-header">
      <h1>会话列表</h1>
      <div class="actions">
        <button @click="load" :disabled="loading">{{ loading ? '加载中…' : '🔄 刷新' }}</button>
      </div>
    </div>

    <ErrorBanner :message="error" @dismiss="error = ''" />

    <div v-if="sessions.length > 0" class="card" style="padding: 0; overflow: hidden;">
      <table>
        <thead>
          <tr>
            <th>Session ID</th>
            <th>Kind</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in sessions" :key="s.id">
            <td>
              <RouterLink :to="`/sessions/${encodeURIComponent(s.id)}`" class="mono">
                {{ s.id.length > 24 ? `...${s.id.slice(-20)}` : s.id }}
              </RouterLink>
            </td>
            <td><span class="badge badge--muted">{{ s.kind }}</span></td>
            <td>
              <button class="danger" @click="confirmDelete(s.id)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <EmptyState v-else-if="!loading" icon="💬" title="暂无会话" subtitle="通过 API 创建一个 Session 开始运行" />

    <!-- Pagination -->
    <div class="pagination" v-if="total > pageSize">
      <button :disabled="page === 0" @click="page--; load()">← 上一页</button>
      <span class="text-muted">{{ page + 1 }} / {{ Math.ceil(total / pageSize) }}</span>
      <button :disabled="(page + 1) * pageSize >= total" @click="page++; load()">下一页 →</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { SessionDto } from '@openkin/shared-contracts'
import ErrorBanner from '../components/ErrorBanner.vue'
import EmptyState from '../components/EmptyState.vue'
import { listSessions, deleteSession } from '../api/operator'

const sessions = ref<SessionDto[]>([])
const loading = ref(false)
const error = ref('')
const page = ref(0)
const pageSize = 20
const total = ref(0)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const result = await listSessions({ limit: pageSize, offset: page.value * pageSize })
    sessions.value = result.sessions
    total.value = result.total
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function confirmDelete(id: string) {
  if (!confirm(`删除会话 ${id}？此操作不可撤销。`)) return
  try {
    await deleteSession(id)
    void load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

onMounted(load)
</script>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  margin-top: var(--sp-4);
  justify-content: center;
}
</style>
