<template>
  <div>
    <div class="page-header">
      <h1>系统状态</h1>
      <div class="actions">
        <span class="auto-refresh-hint text-muted">{{ lastUpdated ? `上次更新: ${lastUpdated}` : '' }}</span>
        <label class="toggle-label">
          <input type="checkbox" v-model="autoRefresh" />
          自动刷新
        </label>
        <button @click="load" :disabled="loading">{{ loading ? '刷新中…' : '🔄 刷新' }}</button>
      </div>
    </div>

    <ErrorBanner :message="error" @dismiss="error = ''" />

    <div v-if="status" class="content">
      <!-- Summary cards -->
      <div class="card-grid" style="margin-bottom: 24px;">
        <StatusCard
          :value="status.activeSessions"
          label="活跃 Session"
          sub="内存中"
        />
        <StatusCard
          :value="status.tools.total"
          label="工具总数"
          :sub="`builtin: ${status.tools.builtin}  mcp: ${status.tools.mcp}`"
        />
        <StatusCard
          :value="status.skills.loaded"
          label="Skill 数"
          :sub="status.skills.list.slice(0, 3).join(', ') + (status.skills.list.length > 3 ? '…' : '')"
        />
        <StatusCard
          :value="status.db"
          label="数据库"
        />
        <StatusCard
          :value="formatUptime(status.uptime)"
          label="运行时长"
        />
        <StatusCard
          :value="status.version"
          label="版本"
        />
      </div>

      <!-- MCP Providers -->
      <div class="card">
        <div class="section-label">MCP Providers</div>
        <div v-if="status.mcpProviders.length === 0" class="empty-small">
          无 MCP Provider 已连接
        </div>
        <div v-for="p in status.mcpProviders" :key="p.id" class="mcp-row">
          <span class="dot" :class="p.status === 'connected' ? 'dot--green' : 'dot--red'"></span>
          <span class="mcp-id mono">{{ p.id }}</span>
          <span class="badge" :class="p.status === 'connected' ? 'badge--success' : 'badge--error'">{{ p.status }}</span>
          <span class="text-muted">{{ p.toolCount }} tools</span>
          <span v-if="p.error" class="text-error mono">{{ p.error }}</span>
        </div>
      </div>

      <!-- Health info -->
      <div v-if="health" class="card" style="margin-top: 16px;">
        <div class="section-label">Health</div>
        <div class="health-row">
          <span class="dot dot--green"></span>
          <span>Server v{{ health.version }} — uptime {{ formatUptime(health.uptime) }}</span>
        </div>
      </div>
    </div>

    <div v-else-if="!loading" class="card">
      <EmptyState icon="🔌" title="无法连接到 Server" subtitle="请确认 Server 正在运行，或在设置中修改 Server URL" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import type { SystemStatusResponseBody, HealthResponseBody } from '@theworld/shared-contracts'
import StatusCard from '../components/StatusCard.vue'
import ErrorBanner from '../components/ErrorBanner.vue'
import EmptyState from '../components/EmptyState.vue'
import { getSystemStatus, getHealth } from '../api/operator'

const loading = ref(false)
const error = ref('')
const status = ref<SystemStatusResponseBody | null>(null)
const health = ref<HealthResponseBody | null>(null)
const autoRefresh = ref(true)
const lastUpdated = ref('')
let timer: ReturnType<typeof setInterval> | null = null

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [s, h] = await Promise.all([getSystemStatus(), getHealth()])
    status.value = s
    health.value = h
    lastUpdated.value = new Date().toLocaleTimeString()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function startTimer() {
  stopTimer()
  timer = setInterval(() => { void load() }, 5000)
}

function stopTimer() {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

watch(autoRefresh, (val) => {
  if (val) startTimer()
  else stopTimer()
})

function formatUptime(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${m}m`
}

onMounted(() => {
  void load()
  startTimer()
})

onUnmounted(() => {
  stopTimer()
})
</script>

<style scoped>
.mcp-row {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-2) 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 13px;
}

.mcp-id { min-width: 140px; }

.health-row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: 13px;
}

.empty-small {
  color: var(--color-text-muted);
  font-size: 13px;
  padding: var(--sp-3) 0;
}

.auto-refresh-hint {
  font-size: 12px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  font-size: 13px;
  cursor: pointer;
  color: var(--color-text-muted);
}
</style>
