<template>
  <nav class="navbar">
    <div class="navbar-brand">
      <span class="brand-icon">🤖</span>
      <span class="brand-name">OpenKin Console</span>
    </div>

    <div class="navbar-links">
      <RouterLink to="/status">状态</RouterLink>
      <RouterLink to="/logs">日志</RouterLink>
      <RouterLink to="/server-logs">服务日志</RouterLink>
      <RouterLink to="/tools">工具</RouterLink>
      <RouterLink to="/db">数据库</RouterLink>
      <RouterLink to="/sessions">会话</RouterLink>
      <RouterLink to="/traces">Trace</RouterLink>
      <RouterLink to="/agents">Agent</RouterLink>
      <RouterLink to="/tasks">任务</RouterLink>
      <RouterLink to="/settings">设置</RouterLink>
    </div>

    <div class="navbar-status">
      <span class="dot" :class="connected ? 'dot--green' : 'dot--red'"></span>
      <span class="status-text">{{ connected ? 'Connected' : 'Disconnected' }}</span>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getHealth } from '../api/operator'

const connected = ref(false)

async function checkConnection() {
  try {
    await getHealth()
    connected.value = true
  } catch {
    connected.value = false
  }
}

onMounted(() => {
  void checkConnection()
})
</script>

<style scoped>
.navbar {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  padding: 0 var(--sp-6);
  height: 52px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  z-index: 100;
}

.navbar-brand {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-weight: 700;
  font-size: 15px;
  white-space: nowrap;
}

.brand-icon { font-size: 18px; }

.navbar-links {
  display: flex;
  gap: var(--sp-1);
  flex: 1;
}

.navbar-links a {
  padding: var(--sp-1) var(--sp-3);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  font-size: 13px;
  transition: color var(--transition), background var(--transition);
  text-decoration: none;
}

.navbar-links a:hover {
  color: var(--color-text);
  background: var(--color-surface-2);
}

.navbar-links a.router-link-active {
  color: var(--color-primary);
  background: rgba(79, 110, 247, 0.08);
  font-weight: 600;
}

.navbar-status {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: 12px;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.status-text { font-size: 12px; }
</style>
