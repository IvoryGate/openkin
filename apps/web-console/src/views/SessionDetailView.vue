<template>
  <div>
    <div class="page-header">
      <h1>
        <RouterLink to="/sessions" class="back-link">← 会话</RouterLink>
        <span class="mono session-id">{{ sessionId }}</span>
      </h1>
      <div class="actions">
        <button @click="load" :disabled="loading">🔄 刷新</button>
      </div>
    </div>

    <ErrorBanner :message="error" @dismiss="error = ''" />

    <div class="detail-layout">
      <!-- Messages column -->
      <div>
        <div class="section-label">消息历史</div>
        <div class="messages-list">
          <div v-for="msg in messages" :key="msg.id" class="msg" :class="`msg--${msg.role}`">
            <div class="msg-role">{{ msg.role }}</div>
            <div class="msg-content">{{ msg.content }}</div>
            <div class="msg-ts text-muted">{{ formatTs(msg.createdAt) }}</div>
          </div>
          <EmptyState v-if="messages.length === 0 && !loading" icon="💬" title="暂无消息" />
        </div>
        <div v-if="hasMoreMessages" class="load-more">
          <button @click="loadMoreMessages">加载更多消息</button>
        </div>
      </div>

      <!-- Traces column -->
      <div>
        <div class="section-label">推理轨迹 (Traces)</div>
        <div v-if="traces.length > 0" class="trace-list">
          <div v-for="t in traces" :key="t.traceId" class="trace-row card">
            <div class="trace-row-header">
              <RouterLink :to="`/traces/${encodeURIComponent(t.traceId)}`" class="mono trace-id">
                {{ t.traceId.slice(-12) }}
              </RouterLink>
              <span class="badge" :class="statusClass(t.status)">{{ t.status }}</span>
            </div>
            <div class="trace-meta text-muted">
              {{ t.stepCount }} 步 · {{ t.durationMs != null ? `${t.durationMs}ms` : '—' }} · {{ formatTs(t.createdAt) }}
            </div>
          </div>
        </div>
        <EmptyState v-else-if="!loading" icon="🔍" title="暂无 Trace" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import type { MessageDto, TraceSummaryDto } from '@theworld/shared-contracts'
import ErrorBanner from '../components/ErrorBanner.vue'
import EmptyState from '../components/EmptyState.vue'
import { getSessionMessages, getSessionTraces } from '../api/operator'

const route = useRoute()
const sessionId = route.params.id as string

const messages = ref<MessageDto[]>([])
const traces = ref<TraceSummaryDto[]>([])
const loading = ref(false)
const error = ref('')
const hasMoreMessages = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [mr, tr] = await Promise.all([
      getSessionMessages(sessionId, { limit: 50 }),
      getSessionTraces(sessionId),
    ])
    messages.value = mr.messages
    hasMoreMessages.value = mr.hasMore
    traces.value = tr.traces
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function loadMoreMessages() {
  const oldest = messages.value[messages.value.length - 1]?.createdAt
  try {
    const result = await getSessionMessages(sessionId, { limit: 50, before: oldest })
    messages.value.push(...result.messages)
    hasMoreMessages.value = result.hasMore
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function formatTs(ts: number): string {
  return new Date(ts).toLocaleString()
}

function statusClass(status: string): string {
  switch (status) {
    case 'completed': return 'badge--success'
    case 'failed': return 'badge--error'
    default: return 'badge--muted'
  }
}

onMounted(load)
</script>

<style scoped>
.back-link { margin-right: var(--sp-3); color: var(--color-text-muted); }
.session-id { font-size: 14px; }

.messages-list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  max-height: 60vh;
  overflow-y: auto;
}

.msg {
  padding: var(--sp-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface-2);
}

.msg--user { border-color: rgba(108, 142, 247, 0.3); }
.msg--assistant { border-color: rgba(86, 211, 100, 0.2); }
.msg--tool { border-color: rgba(56, 189, 248, 0.2); opacity: 0.85; }

.msg-role {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin-bottom: var(--sp-1);
}

.msg--user .msg-role { color: var(--color-primary); }
.msg--assistant .msg-role { color: var(--color-success); }
.msg--tool .msg-role { color: var(--color-info); }

.msg-content {
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-word;
}

.msg-ts { font-size: 11px; margin-top: var(--sp-1); }

.trace-list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.trace-row {
  padding: var(--sp-3);
}

.trace-row-header {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  margin-bottom: var(--sp-1);
}

.trace-id { font-size: 12px; color: var(--color-info); }
.trace-meta { font-size: 12px; }
</style>
