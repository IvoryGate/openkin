<template>
  <div>
    <div class="page-header">
      <h1>控制台设置</h1>
    </div>

    <div class="card settings-card">
      <div class="form-group">
        <label>Server URL</label>
        <p class="form-hint">开发时留空（走 Vite proxy）；生产直连时填写完整地址，如 <code>http://127.0.0.1:3333</code></p>
        <div class="input-row">
          <input v-model="baseUrl" placeholder="留空则通过代理自动连接" />
          <button @click="testConnection" :disabled="testing">
            {{ testing ? '测试中…' : '测试连接' }}
          </button>
        </div>
        <div v-if="testResult" :class="testOk ? 'text-success' : 'text-error'" class="test-result">
          {{ testResult }}
        </div>
      </div>

      <div class="form-group">
        <label>API Key</label>
        <div class="input-row">
          <input :type="showKey ? 'text' : 'password'" v-model="apiKey" placeholder="留空则不使用 API Key" />
          <button @click="showKey = !showKey">{{ showKey ? '隐藏' : '显示' }}</button>
        </div>
      </div>

      <div class="save-actions">
        <button class="primary" @click="save">保存设置</button>
        <span v-if="saved" class="text-success">✓ 已保存</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getHealth } from '../api/operator'

const baseUrl = ref('')
const apiKey = ref('')
const showKey = ref(false)
const testing = ref(false)
const testResult = ref('')
const testOk = ref(false)
const saved = ref(false)

function load() {
  baseUrl.value = localStorage.getItem('openkin_console_base_url') ?? ''
  apiKey.value = localStorage.getItem('openkin_console_api_key') ?? ''
}

function save() {
  const url = baseUrl.value.trim().replace(/\/+$/, '')
  localStorage.setItem('openkin_console_base_url', url)
  localStorage.setItem('openkin_console_api_key', apiKey.value.trim())
  saved.value = true
  setTimeout(() => { saved.value = false }, 2000)
}

async function testConnection() {
  // Temporarily apply settings so operator.ts reads them
  const url = baseUrl.value.trim().replace(/\/+$/, '')
  const prevUrl = localStorage.getItem('openkin_console_base_url')
  const prevKey = localStorage.getItem('openkin_console_api_key')
  localStorage.setItem('openkin_console_base_url', url)
  localStorage.setItem('openkin_console_api_key', apiKey.value.trim())

  testing.value = true
  testResult.value = ''
  try {
    const h = await getHealth()
    testResult.value = `✓ 已连接 (v${h.version})`
    testOk.value = true
  } catch (e) {
    testResult.value = e instanceof Error ? `✗ ${e.message}` : '连接失败'
    testOk.value = false
  } finally {
    testing.value = false
    // Restore previous if not yet saved
    if (prevUrl !== null) localStorage.setItem('openkin_console_base_url', prevUrl)
    else localStorage.removeItem('openkin_console_base_url')
    if (prevKey !== null) localStorage.setItem('openkin_console_api_key', prevKey)
    else localStorage.removeItem('openkin_console_api_key')
  }
}

onMounted(load)
</script>

<style scoped>
.settings-card {
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
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

.form-hint {
  font-size: 12px;
  color: var(--color-text-muted);
  margin: 0;
}

.form-hint code {
  font-family: var(--font-mono);
  background: var(--color-surface-alt, rgba(0,0,0,0.04));
  padding: 1px 4px;
  border-radius: 3px;
}

.input-row {
  display: flex;
  gap: var(--sp-2);
}

.input-row input {
  flex: 1;
}

.test-result {
  font-size: 13px;
  margin-top: var(--sp-1);
}

.save-actions {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  margin-top: var(--sp-2);
}
</style>
