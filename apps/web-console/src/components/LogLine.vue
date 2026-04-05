<template>
  <div class="log-line" @click="expanded = !expanded">
    <span class="log-ts mono">{{ formatTs(entry.ts) }}</span>
    <span class="log-level badge" :class="`badge--${getLevelClass(entry)}`">{{ entry.level ?? entry.type ?? '?' }}</span>
    <span class="log-type text-muted mono">{{ entry.type }}</span>
    <span class="log-session mono text-muted">{{ shortId(entry.sessionId) }}</span>
    <span class="log-msg">{{ truncate(entry.message ?? JSON.stringify(entry), 200) }}</span>
    <span class="expand-icon">{{ expanded ? '▲' : '▼' }}</span>
  </div>
  <div v-if="expanded" class="log-detail">
    <pre>{{ JSON.stringify(entry, null, 2) }}</pre>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { LogEntryDto } from '@openkin/shared-contracts'

defineProps<{ entry: LogEntryDto }>()

const expanded = ref(false)

function formatTs(ts: number): string {
  if (!ts) return '--'
  const d = new Date(ts)
  return d.toISOString().replace('T', ' ').slice(0, 23)
}

function shortId(id?: string): string {
  if (!id) return '—'
  return id.length > 8 ? `...${id.slice(-8)}` : id
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}

function getLevelClass(entry: LogEntryDto): string {
  switch ((entry.level ?? '').toUpperCase()) {
    case 'ERROR': return 'error'
    case 'WARN': return 'warn'
    case 'INFO': return 'info'
    case 'DEBUG': return 'muted'
    default: return 'muted'
  }
}
</script>

<style scoped>
.log-line {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
  padding: var(--sp-2) var(--sp-3);
  border-bottom: 1px solid rgba(46, 49, 72, 0.4);
  cursor: pointer;
  font-size: 12px;
}

.log-line:hover { background: var(--color-surface-2); }

.log-ts { color: var(--color-text-subtle); width: 170px; flex-shrink: 0; }
.log-level { flex-shrink: 0; }
.log-type { width: 100px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.log-session { width: 90px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.log-msg { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.expand-icon { color: var(--color-text-subtle); font-size: 10px; flex-shrink: 0; }

.log-detail {
  padding: 0 var(--sp-3) var(--sp-3);
}

.log-detail pre {
  max-height: 300px;
}
</style>
