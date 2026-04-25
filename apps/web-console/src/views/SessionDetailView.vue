<template>
  <div>
    <div class="page-header">
      <h1>
        <RouterLink to="/sessions" class="back-link">← 会话</RouterLink>
        <span class="mono session-id">{{ sessionTitle }}</span>
      </h1>
      <div class="actions">
        <button @click="load" :disabled="loading">🔄 刷新</button>
      </div>
    </div>

    <ErrorBanner :message="error" @dismiss="error = ''" />

    <div v-if="sessionMeta" class="session-meta card">
      <div class="meta-row">
        <span class="text-muted">展示名</span>
        <input v-model="editDisplayName" class="display-input" type="text" maxlength="256" />
        <button type="button" :disabled="savingName" @click="saveDisplayName">保存</button>
      </div>
    </div>

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

      <!-- Runs column -->
      <div>
        <div class="section-label">Runs（046）</div>
        <div v-if="runs.length > 0" class="trace-list">
          <div v-for="r in runs" :key="r.traceId" class="trace-row card">
            <div class="trace-row-header">
              <RouterLink :to="`/traces/${encodeURIComponent(r.traceId)}`" class="mono trace-id">
                {{ r.traceId.slice(-12) }}
              </RouterLink>
              <span class="badge" :class="statusClass(r.status)">{{ r.status }}</span>
            </div>
            <div class="trace-meta text-muted">
              {{ r.stepCount }} 步 · {{ r.durationMs != null ? `${r.durationMs}ms` : '—' }} · {{ formatTs(r.createdAt) }}
            </div>
          </div>
        </div>
        <EmptyState v-else-if="!loading" icon="▶" title="暂无 Runs" />
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
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import type { MessageDto, SessionDto, TraceSummaryDto } from '@theworld/shared-contracts'
import ErrorBanner from '../components/ErrorBanner.vue'
import EmptyState from '../components/EmptyState.vue'
import { getSession, getSessionMessages, getSessionRuns, getSessionTraces, patchSession } from '../api/operator'

const route = useRoute()
const sessionId = route.params.id as string

const messages = ref<MessageDto[]>([])
const traces = ref<TraceSummaryDto[]>([])
const runs = ref<TraceSummaryDto[]>([])
const sessionMeta = ref<SessionDto | null>(null)
const editDisplayName = ref('')
const savingName = ref(false)
const loading = ref(false)
const error = ref('')
const hasMoreMessages = ref(false)

const sessionTitle = computed(() => {
  const dn = sessionMeta.value?.displayName?.trim()
  return dn ? `${dn} · ${sessionId}` : sessionId
})

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
    try {
      sessionMeta.value = await getSession(sessionId)
      editDisplayName.value = sessionMeta.value.displayName ?? ''
    } catch {
      sessionMeta.value = { id: sessionId, kind: 'chat' }
      editDisplayName.value = ''
    }
    try {
      const rr = await getSessionRuns(sessionId, { limit: 50 })
      runs.value = rr.runs
    } catch {
      runs.value = []
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function saveDisplayName() {
  const trimmed = editDisplayName.value.trim()
  if (!trimmed) {
    error.value = '展示名不能为空'
    return
  }
  savingName.value = true
  error.value = ''
  try {
    const next = await patchSession(sessionId, { displayName: trimmed })
    sessionMeta.value = next
    editDisplayName.value = next.displayName ?? ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    savingName.value = false
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
.msg--system { border-color: rgba(250, 204, 21, 0.25); }

.session-meta {
  margin-bottom: var(--sp-4);
  padding: var(--sp-3);
}
.meta-row {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  flex-wrap: wrap;
}
.display-input {
  flex: 1;
  min-width: 160px;
  max-width: 420px;
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface-1);
  color: var(--color-text);
}

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
