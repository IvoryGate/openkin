<template>
  <div>
    <div class="page-header">
      <h1>Agent 管理</h1>
      <div class="actions">
        <button @click="load" :disabled="loading">🔄 刷新</button>
        <button class="primary" @click="openCreate">+ 新建 Agent</button>
      </div>
    </div>

    <ErrorBanner :message="error" @dismiss="error = ''" />

    <div class="layout-wrap">
      <!-- Agent list -->
      <div class="list-col">
        <div v-if="agents.length > 0" class="card" style="padding: 0; overflow: hidden;">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>Model</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="a in agents"
                :key="a.id"
                :class="{ selected: selectedAgent?.id === a.id }"
                @click="selectAgent(a)"
                style="cursor: pointer;"
              >
                <td>
                  <span>{{ a.name }}</span>
                  <span v-if="a.isBuiltin" class="badge badge--info" style="margin-left: 6px; font-size: 10px;">built-in</span>
                </td>
                <td class="mono text-muted">{{ a.model ?? 'default' }}</td>
                <td>
                  <label class="toggle" @click.stop>
                    <input
                      type="checkbox"
                      :checked="a.enabled"
                      @change="toggleAgent(a)"
                    />
                    <span class="toggle-slider"></span>
                  </label>
                </td>
                <td @click.stop>
                  <button
                    class="danger"
                    :disabled="a.isBuiltin"
                    @click="confirmDelete(a.id)"
                  >删除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <EmptyState v-else-if="!loading" icon="🤖" title="暂无 Agent" />
      </div>

      <!-- Detail / Form panel -->
      <div class="detail-col card" v-if="showForm || selectedAgent">
        <div class="panel-header">
          <span>{{ showForm && !editingAgent ? '新建 Agent' : (editingAgent ? '编辑 Agent' : '查看 Agent') }}</span>
          <button @click="closePanel">✕</button>
        </div>
        <div v-if="showForm">
          <AgentForm
            :agent="editingAgent ?? undefined"
            @saved="onSaved"
            @cancel="closePanel"
          />
        </div>
        <div v-else-if="selectedAgent" class="agent-detail">
          <div class="detail-field">
            <div class="section-label">ID</div>
            <div class="mono">{{ selectedAgent.id }}</div>
          </div>
          <div class="detail-field">
            <div class="section-label">System Prompt</div>
            <pre>{{ selectedAgent.systemPrompt }}</pre>
          </div>
          <div style="display: flex; gap: 8px; margin-top: 12px;">
            <button class="primary" @click="openEdit(selectedAgent)">编辑</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { AgentDto } from '@openkin/shared-contracts'
import ErrorBanner from '../components/ErrorBanner.vue'
import EmptyState from '../components/EmptyState.vue'
import AgentForm from '../components/AgentForm.vue'
import { listAgents, deleteAgent, enableAgent, disableAgent } from '../api/operator'

const agents = ref<AgentDto[]>([])
const loading = ref(false)
const error = ref('')
const selectedAgent = ref<AgentDto | null>(null)
const showForm = ref(false)
const editingAgent = ref<AgentDto | null>(null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const result = await listAgents()
    agents.value = result.agents
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function selectAgent(a: AgentDto) {
  selectedAgent.value = a
  showForm.value = false
  editingAgent.value = null
}

function openCreate() {
  selectedAgent.value = null
  editingAgent.value = null
  showForm.value = true
}

function openEdit(a: AgentDto) {
  editingAgent.value = a
  showForm.value = true
}

function closePanel() {
  showForm.value = false
  editingAgent.value = null
  selectedAgent.value = null
}

function onSaved(a: AgentDto) {
  void load()
  selectedAgent.value = a
  showForm.value = false
  editingAgent.value = null
}

async function toggleAgent(a: AgentDto) {
  try {
    if (a.enabled) {
      await disableAgent(a.id)
    } else {
      await enableAgent(a.id)
    }
    void load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function confirmDelete(id: string) {
  if (!confirm(`删除 Agent ${id}？`)) return
  try {
    await deleteAgent(id)
    void load()
    if (selectedAgent.value?.id === id) selectedAgent.value = null
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

onMounted(load)
</script>

<style scoped>
.layout-wrap {
  display: grid;
  grid-template-columns: 1fr 420px;
  gap: var(--sp-4);
}

.list-col {}

.detail-col {
  align-self: start;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--sp-4);
  font-weight: 600;
}

.detail-field {
  margin-bottom: var(--sp-4);
}

.agent-detail pre {
  max-height: 300px;
}

tr.selected td {
  background: rgba(108, 142, 247, 0.08);
}

/* Toggle switch */
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
