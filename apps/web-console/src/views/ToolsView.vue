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
        工具 ({{ nonSkillTools.length }})
      </div>
      <div class="tab" :class="{ active: activeTab === 'skills' }" @click="activeTab = 'skills'">
        Skill ({{ skills.length }})
      </div>
    </div>

    <!-- Tools tab：不显示 skill 来源的工具 -->
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

      <EmptyState v-if="nonSkillTools.length === 0 && !loading" icon="🔧" title="暂无工具" />
    </div>

    <!-- Skills tab -->
    <div v-else>
      <div v-if="skills.length > 0" class="skill-list">
        <div
          v-for="s in skills"
          :key="s.id"
          class="skill-card card"
          :class="{ 'skill-card--open': expandedSkill === s.id }"
        >
          <div class="skill-header" @click="toggleSkill(s.id)">
            <div class="skill-header-left">
              <span class="skill-id mono">{{ s.id }}</span>
              <span v-if="s.hasScript" class="badge badge--info">script</span>
            </div>
            <div class="skill-header-right">
              <span class="skill-title">{{ s.title }}</span>
              <span class="chevron">{{ expandedSkill === s.id ? '▲' : '▼' }}</span>
            </div>
          </div>

          <div v-if="s.description && expandedSkill !== s.id" class="skill-desc text-muted">{{ s.description }}</div>

          <!-- 展开：SKILL.md 完整内容 -->
          <div v-if="expandedSkill === s.id" class="skill-detail">
            <div v-if="skillContents[s.id] === undefined" class="text-muted" style="padding: 8px 0;">加载中…</div>
            <div v-else-if="skillContents[s.id] === null" class="text-muted" style="padding: 8px 0;">无法读取 SKILL.md</div>
            <pre v-else class="skill-md">{{ skillContents[s.id] }}</pre>
          </div>
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
import { getTools, getSkills, getSkillContent } from '../api/operator'

const activeTab = ref<'tools' | 'skills'>('tools')
const tools = ref<ToolEntryDto[]>([])
const skills = ref<SkillEntryDto[]>([])
const loading = ref(false)
const error = ref('')
const expandedSkill = ref<string | null>(null)
const skillContents = ref<Record<string, string | null>>({})

/** 过滤掉 source === 'skill' 的工具，工具 tab 不显示 skill 工具 */
const nonSkillTools = computed(() => tools.value.filter((t) => t.source !== 'skill'))

const toolSources = computed(() => {
  return [...new Set(nonSkillTools.value.map((t) => t.source))]
})

function toolsBySource(source: string) {
  return nonSkillTools.value.filter((t) => t.source === source)
}

async function toggleSkill(id: string) {
  if (expandedSkill.value === id) {
    expandedSkill.value = null
    return
  }
  expandedSkill.value = id
  if (skillContents.value[id] === undefined) {
    try {
      const content = await getSkillContent(id)
      skillContents.value[id] = content
    } catch {
      skillContents.value[id] = null
    }
  }
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

.skill-list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.skill-card {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  cursor: pointer;
  transition: box-shadow var(--transition);
}

.skill-card--open {
  box-shadow: 0 0 0 2px var(--color-primary);
}

.skill-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}

.skill-header-left {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-shrink: 0;
}

.skill-header-right {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  flex: 1;
  justify-content: flex-end;
}

.skill-id { color: var(--color-info); }
.skill-title { font-weight: 600; font-size: 14px; }
.skill-desc { font-size: 12px; }

.chevron {
  font-size: 10px;
  color: var(--color-text-muted);
}

.skill-detail {
  border-top: 1px solid var(--color-border);
  padding-top: var(--sp-3);
}

.skill-md {
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--color-text);
  margin: 0;
  max-height: 400px;
  overflow-y: auto;
}
</style>
