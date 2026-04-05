<template>
  <div>
    <div class="page-header">
      <h1>工具 & Skill</h1>
      <div class="actions">
        <button @click="load" :disabled="loading">{{ loading ? '加载中…' : '🔄 刷新' }}</button>
      </div>
    </div>

    <ErrorBanner :message="error" @dismiss="error = ''" />

    <div class="tabs">
      <div class="tab" :class="{ active: activeTab === 'tools' }" @click="activeTab = 'tools'">
        工具 ({{ tools.length }})
      </div>
      <div class="tab" :class="{ active: activeTab === 'skills' }" @click="activeTab = 'skills'">
        Skill ({{ skills.length }})
      </div>
    </div>

    <!-- Tools tab -->
    <div v-if="activeTab === 'tools'">
      <div v-for="source in toolSources" :key="source" class="source-group">
        <div class="section-label" style="margin-bottom: 8px;">{{ source }}</div>
        <table>
          <thead>
            <tr>
              <th>名称</th>
              <th>描述</th>
              <th>Provider</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in toolsBySource(source)" :key="t.name">
              <td><code>{{ t.name }}</code></td>
              <td class="text-muted">{{ t.description }}</td>
              <td class="mono text-muted">{{ t.providerId ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
        <hr class="divider" />
      </div>

      <EmptyState v-if="tools.length === 0 && !loading" icon="🔧" title="暂无工具" />
    </div>

    <!-- Skills tab -->
    <div v-else>
      <div v-if="skills.length > 0" class="skill-grid">
        <div v-for="s in skills" :key="s.id" class="skill-card card">
          <div class="skill-header">
            <span class="skill-id mono">{{ s.id }}</span>
            <span v-if="s.hasScript" class="badge badge--info">script</span>
          </div>
          <div class="skill-title">{{ s.title }}</div>
          <div v-if="s.description" class="skill-desc text-muted">{{ s.description }}</div>
        </div>
      </div>
      <EmptyState v-else-if="!loading" icon="📦" title="暂无 Skill" subtitle="在 workspace/skills/ 目录下创建 Skill" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import type { ToolEntryDto, SkillEntryDto } from '@openkin/shared-contracts'
import ErrorBanner from '../components/ErrorBanner.vue'
import EmptyState from '../components/EmptyState.vue'
import { getTools, getSkills } from '../api/operator'

const activeTab = ref<'tools' | 'skills'>('tools')
const tools = ref<ToolEntryDto[]>([])
const skills = ref<SkillEntryDto[]>([])
const loading = ref(false)
const error = ref('')

const toolSources = computed(() => {
  return [...new Set(tools.value.map((t) => t.source))]
})

function toolsBySource(source: string) {
  return tools.value.filter((t) => t.source === source)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [tr, sr] = await Promise.all([getTools(), getSkills()])
    tools.value = tr.tools
    skills.value = sr.skills
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.source-group {
  margin-bottom: var(--sp-4);
}

.skill-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--sp-4);
}

.skill-card {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.skill-header {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.skill-id { color: var(--color-info); }
.skill-title { font-weight: 600; font-size: 14px; }
.skill-desc { font-size: 12px; }
</style>
