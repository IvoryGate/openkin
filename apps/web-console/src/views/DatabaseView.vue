<template>
  <div>
    <div class="page-header">
      <h1>数据库</h1>
      <div class="actions">
        <button @click="loadTables" :disabled="loadingTables">{{ loadingTables ? '加载中…' : '🔄 刷新' }}</button>
      </div>
    </div>

    <ErrorBanner :message="error" @dismiss="error = ''" />

    <div class="db-layout">
      <!-- 左侧：表列表 -->
      <div class="tables-panel card">
        <div class="section-label" style="margin-bottom: 8px;">表</div>
        <div v-if="loadingTables" class="text-muted" style="font-size: 13px;">加载中…</div>
        <div v-else-if="tables.length === 0" class="text-muted" style="font-size: 13px;">无表</div>
        <div
          v-for="t in tables"
          :key="t.name"
          class="table-item"
          :class="{ 'table-item--active': selectedTable === t.name }"
          @click="selectTable(t)"
        >
          <div class="table-item-name mono">{{ t.name }}</div>
          <div class="table-item-meta text-muted">{{ t.rowCount }} 行 · {{ t.columns.length }} 列</div>
        </div>
      </div>

      <!-- 右侧：查询区 + 结果 -->
      <div class="query-panel">
        <!-- SQL 编辑器 -->
        <div class="card query-editor-card">
          <div class="editor-header">
            <div class="section-label">SQL 查询（只读，SELECT / WITH）</div>
            <button class="primary" @click="runQuery" :disabled="running || !sql.trim()">
              {{ running ? '执行中…' : '▶ 执行' }}
            </button>
          </div>
          <textarea
            v-model="sql"
            class="sql-editor mono"
            rows="5"
            placeholder="SELECT * FROM sessions LIMIT 20"
            @keydown.ctrl.enter.prevent="runQuery"
            @keydown.meta.enter.prevent="runQuery"
          />
          <div class="editor-hint text-muted">Ctrl+Enter / Cmd+Enter 执行</div>
        </div>

        <!-- 表结构 -->
        <div v-if="selectedTableInfo" class="card schema-card">
          <div class="section-label" style="margin-bottom: 8px;">
            {{ selectedTableInfo.name }} — 表结构
          </div>
          <table class="schema-table">
            <thead>
              <tr>
                <th>列名</th>
                <th>类型</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="col in selectedTableInfo.columns" :key="col.name">
                <td class="mono">{{ col.name }}</td>
                <td class="mono text-muted">{{ col.type }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 查询结果 -->
        <div v-if="queryResult" class="card result-card">
          <div class="result-header">
            <div class="section-label">
              查询结果
              <span class="text-muted" style="font-weight: normal; font-size: 12px;">
                {{ queryResult.rowCount }} 行{{ queryResult.truncated ? '（已截断）' : '' }}
              </span>
            </div>
            <button @click="queryResult = null">✕ 清除</button>
          </div>
          <div v-if="queryResult.columns.length === 0" class="text-muted" style="padding: 12px 0;">
            无结果
          </div>
          <div v-else class="result-table-wrap">
            <table class="result-table">
              <thead>
                <tr>
                  <th v-for="col in queryResult.columns" :key="col">{{ col }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in queryResult.rows" :key="i">
                  <td v-for="(cell, j) in row" :key="j" class="mono">
                    {{ formatCell(cell) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="queryResult.truncated" class="truncated-hint text-muted">
            ⚠️ 结果已被截断，最多显示 {{ queryResult.rowCount }} 行
          </div>
        </div>

        <ErrorBanner :message="queryError" @dismiss="queryError = ''" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { DbTableInfoDto, DbQueryResponseBody } from '@openkin/shared-contracts'
import ErrorBanner from '../components/ErrorBanner.vue'
import { getDbTables, runDbQuery } from '../api/operator'

const tables = ref<DbTableInfoDto[]>([])
const loadingTables = ref(false)
const error = ref('')
const selectedTable = ref<string | null>(null)
const selectedTableInfo = ref<DbTableInfoDto | null>(null)
const sql = ref('')
const running = ref(false)
const queryResult = ref<DbQueryResponseBody | null>(null)
const queryError = ref('')

async function loadTables() {
  loadingTables.value = true
  error.value = ''
  try {
    const res = await getDbTables()
    tables.value = res.tables
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loadingTables.value = false
  }
}

function selectTable(t: DbTableInfoDto) {
  selectedTable.value = t.name
  selectedTableInfo.value = t
  sql.value = `SELECT * FROM ${t.name} LIMIT 50`
}

async function runQuery() {
  if (!sql.value.trim() || running.value) return
  running.value = true
  queryError.value = ''
  queryResult.value = null
  try {
    const res = await runDbQuery(sql.value)
    queryResult.value = res
  } catch (e) {
    queryError.value = e instanceof Error ? e.message : String(e)
  } finally {
    running.value = false
  }
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'string' && v.length > 120) return v.slice(0, 120) + '…'
  return String(v)
}

onMounted(loadTables)
</script>

<style scoped>
.db-layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: var(--sp-4);
  align-items: start;
}

.tables-panel {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  min-height: 200px;
}

.table-item {
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition);
}

.table-item:hover {
  background: rgba(255,255,255,0.05);
}

.table-item--active {
  background: rgba(99, 179, 237, 0.15);
}

.table-item-name {
  font-size: 13px;
  color: var(--color-info);
}

.table-item-meta {
  font-size: 11px;
  margin-top: 2px;
}

.query-panel {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.query-editor-card {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sql-editor {
  width: 100%;
  min-height: 100px;
  resize: vertical;
  font-family: var(--font-mono);
  font-size: 13px;
  background: var(--color-bg);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--sp-2) var(--sp-3);
  outline: none;
  box-sizing: border-box;
}

.sql-editor:focus {
  border-color: var(--color-primary);
}

.editor-hint {
  font-size: 11px;
}

.schema-table {
  width: 100%;
}

.result-card {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}

.result-table-wrap {
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
}

.result-table {
  min-width: 100%;
  white-space: nowrap;
}

.result-table td {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
}

.truncated-hint {
  font-size: 12px;
}
</style>
