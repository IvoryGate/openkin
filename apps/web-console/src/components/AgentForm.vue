<template>
  <div class="agent-form">
    <div class="form-group">
      <label>名称 *</label>
      <input v-model="form.name" placeholder="Agent name" />
    </div>

    <div class="form-group">
      <label>描述</label>
      <input v-model="form.description" placeholder="Optional description" />
    </div>

    <div class="form-group">
      <label>Model</label>
      <input v-model="form.model" placeholder="e.g. gpt-4o (leave empty for server default)" />
    </div>

    <div class="form-group">
      <label>System Prompt *</label>
      <textarea v-model="form.systemPrompt" rows="8" placeholder="You are a helpful assistant…" />
    </div>

    <ErrorBanner :message="error" @dismiss="error = ''" />

    <div class="form-actions">
      <button @click="$emit('cancel')">取消</button>
      <button class="primary" :disabled="loading" @click="submit">
        {{ loading ? '保存中…' : (isEdit ? '更新' : '创建') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import type { AgentDto } from '@openkin/shared-contracts'
import ErrorBanner from './ErrorBanner.vue'
import { createAgent, updateAgent } from '../api/operator'

const props = defineProps<{
  agent?: AgentDto
}>()

const emit = defineEmits<{
  (e: 'saved', agent: AgentDto): void
  (e: 'cancel'): void
}>()

const isEdit = !!props.agent

const form = reactive({
  name: props.agent?.name ?? '',
  description: props.agent?.description ?? '',
  model: props.agent?.model ?? '',
  systemPrompt: props.agent?.systemPrompt ?? '',
})

watch(() => props.agent, (a) => {
  if (!a) return
  form.name = a.name
  form.description = a.description ?? ''
  form.model = a.model ?? ''
  form.systemPrompt = a.systemPrompt
})

const loading = ref(false)
const error = ref('')

async function submit() {
  if (!form.name || !form.systemPrompt) {
    error.value = '名称和 System Prompt 为必填项'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const payload = {
      name: form.name,
      description: form.description || undefined,
      model: form.model || undefined,
      systemPrompt: form.systemPrompt,
    }
    let saved: AgentDto
    if (isEdit && props.agent) {
      saved = await updateAgent(props.agent.id, payload)
    } else {
      saved = await createAgent(payload)
    }
    emit('saved', saved)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.agent-form {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.form-group label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-3);
  margin-top: var(--sp-2);
}
</style>
