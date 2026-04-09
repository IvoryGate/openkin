<template>
  <div>
    <div class="page-header">
      <h1>运行日志</h1>
    </div>

    <div class="filter-bar">
      <input type="date" v-model="filterDate" @change="resetAndLoad" />
      <select v-model="filterLevel" @change="resetAndLoad">
        <option value="">全部级别</option>
        <option value="INFO">INFO</option>
        <option value="WARN">WARN</option>
        <option value="ERROR">ERROR</option>
        <option value="DEBUG">DEBUG</option>
      </select>
      <input v-model="filterSearch" placeholder="关键词搜索…" @keyup.enter="resetAndLoad" style="max-width:260px;" />
      <button @click="resetAndLoad" :disabled="loading">{{ loading ? '加载中…' : '🔍 查询' }}</button>
    </div>

    <ErrorBanner :message="error" @dismiss="error = ''" />

    <div v-if="logs.length > 0" class="logs-list card" style="padding: 0;">
      <LogLine v-for="(entry, i) in logs" :key="i" :entry="entry" />
    </div>

    <EmptyState v-else-if="!loading" icon="📋" title="暂无日志" subtitle="日志文件不存在或该日期没有日志记录" />

    <div class="load-more">
      <button v-if="hasMore" @click="loadMore" :disabled="loading">
        {{ loading ? '加载中…' : '加载更多' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { LogEntryDto } from '@theworld/shared-contracts'
import LogLine from '../components/LogLine.vue'
import ErrorBanner from '../components/ErrorBanner.vue'
import EmptyState from '../components/EmptyState.vue'
import { getLogs } from '../api/operator'

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

const filterDate = ref(todayDate())
const filterLevel = ref('')
const filterSearch = ref('')

const logs = ref<LogEntryDto[]>([])
const hasMore = ref(false)
const loading = ref(false)
const error = ref('')

async function doLoad(append = false) {
  loading.value = true
  error.value = ''
  try {
    const oldest = append && logs.value.length > 0 ? logs.value[logs.value.length - 1].ts : undefined
    const result = await getLogs({
      date: filterDate.value,
      level: filterLevel.value || undefined,
      search: filterSearch.value || undefined,
      before: oldest,
      limit: 100,
    })
    if (append) {
      logs.value.push(...result.logs)
    } else {
      logs.value = result.logs
    }
    hasMore.value = result.hasMore
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function resetAndLoad() {
  logs.value = []
  void doLoad(false)
}

function loadMore() {
  void doLoad(true)
}

onMounted(resetAndLoad)
</script>

<style scoped>
.logs-list {
  overflow: hidden;
}
</style>
