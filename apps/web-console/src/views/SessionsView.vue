<template>
  <div>
    <div class="page-header">
      <h1>会话列表</h1>
      <div class="actions">
        <button @click="resetAndLoad" :disabled="loading">🔄 刷新</button>
      </div>
    </div>

    <!-- 过滤栏 -->
    <div class="filter-bar">
      <select v-model="filterKind" @change="resetAndLoad" style="width:auto;max-width:160px;">
        <option value="">全部类型</option>
        <option value="chat">chat（对话）</option>
        <option value="task">task（任务）</option>
        <option value="channel">channel（通道）</option>
      </select>
      <span class="total-hint" v-if="total > 0">共 {{ total }} 条</span>
    </div>

    <ErrorBanner :message="error" @dismiss="error = ''" />

    <div v-if="sessions.length > 0" class="card" style="padding: 0; overflow: hidden;">
      <table>
        <thead>
          <tr>
            <th>Session ID</th>
            <th>类型</th>
            <th>Agent</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in sessions" :key="s.id">
            <td>
              <RouterLink :to="`/sessions/${encodeURIComponent(s.id)}`" class="mono session-link">
                {{ s.id.length > 24 ? `…${s.id.slice(-20)}` : s.id }}
              </RouterLink>
            </td>
            <td>
              <span class="badge" :class="kindClass(s.kind)">{{ s.kind }}</span>
            </td>
            <td class="text-muted mono" style="font-size:11px;">{{ s.agentId ?? '—' }}</td>
            <td class="text-muted" style="font-size:12px;">
              {{ s.createdAt ? new Date(s.createdAt).toLocaleString() : '—' }}
            </td>
            <td>
              <button class="danger" @click="confirmDelete(s.id)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <EmptyState v-else-if="!loading" icon="💬" title="暂无会话"
      :subtitle="filterKind ? `没有 ${filterKind} 类型的会话` : '通过 API 创建一个 Session 开始运行'" />

    <!-- 分页 -->
    <div class="pagination" v-if="total > pageSize || page > 0">
      <button :disabled="page === 0 || loading" @click="page--; load()">← 上一页</button>
      <span class="text-muted">第 {{ page + 1 }} 页，共 {{ Math.ceil(total / pageSize) || 1 }} 页</span>
      <button :disabled="(page + 1) * pageSize >= total || loading" @click="page++; load()">下一页 →</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { SessionDto } from '@openkin/shared-contracts'
import ErrorBanner from '../components/ErrorBanner.vue'
import EmptyState from '../components/EmptyState.vue'
import { listSessions, deleteSession } from '../api/operator'

const PAGE_SIZE = 20

const filterKind = ref('')
const sessions = ref<SessionDto[]>([])
const loading = ref(false)
const error = ref('')
const page = ref(0)
const pageSize = PAGE_SIZE
const total = ref(0)

function kindClass(kind: string): string {
  switch (kind) {
    case 'chat':    return 'badge--info'
    case 'task':    return 'badge--warn'
    case 'channel': return 'badge--success'
    default:        return 'badge--muted'
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const result = await listSessions({
      limit: pageSize,
      offset: page.value * pageSize,
      kind: filterKind.value || undefined,
    })
    sessions.value = result.sessions
    total.value = result.total
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function resetAndLoad() {
  page.value = 0
  void load()
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

onMounted(resetAndLoad)
</script>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  margin-bottom: var(--sp-4);
}

.total-hint {
  font-size: 12px;
  color: var(--color-text-muted);
}

.session-link {
  font-size: 12px;
  color: var(--color-primary);
}

.pagination {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  margin-top: var(--sp-4);
  justify-content: center;
}
</style>
