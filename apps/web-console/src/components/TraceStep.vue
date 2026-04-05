<template>
  <div class="trace-step">
    <div class="step-header" @click="open = !open">
      <span class="step-num">Step {{ step.stepIndex + 1 }}</span>
      <span v-if="step.thought" class="step-thought-preview">{{ truncate(step.thought, 100) }}</span>
      <span v-if="step.toolCalls?.length" class="step-tools-preview text-muted">
        🔧 {{ step.toolCalls.map(tc => tc.name).join(', ') }}
      </span>
      <span v-if="step.finalAnswer" class="badge badge--success">Final</span>
      <span class="chevron">{{ open ? '▲' : '▼' }}</span>
    </div>

    <div v-if="open" class="step-body">
      <div v-if="step.thought" class="thought-block">
        <div class="section-label">Thought</div>
        <p class="thought-text">{{ step.thought }}</p>
      </div>

      <div v-if="step.toolCalls?.length" class="calls-block">
        <div class="section-label">Tool Calls</div>
        <div v-for="tc in step.toolCalls" :key="tc.id" class="tool-call-row">
          <span class="tool-name">{{ tc.name }}</span>
          <details class="tool-input-details">
            <summary class="text-muted">params</summary>
            <pre>{{ JSON.stringify(tc.input, null, 2) }}</pre>
          </details>
        </div>
      </div>

      <div v-if="step.toolResults?.length" class="results-block">
        <div class="section-label">Tool Results</div>
        <div v-for="tr in step.toolResults" :key="tr.toolCallId" class="tool-result-row">
          <span class="result-icon">{{ tr.isError ? '❌' : '✅' }}</span>
          <span class="tool-name">{{ tr.name }}</span>
          <span class="result-summary text-muted">{{ tr.outputSummary }}</span>
        </div>
      </div>

      <div v-if="step.finalAnswer" class="answer-block">
        <div class="section-label">Final Answer</div>
        <p class="answer-text">{{ step.finalAnswer }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { RunStepDto } from '@openkin/shared-contracts'

defineProps<{ step: RunStepDto }>()

const open = ref(false)

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}
</script>

<style scoped>
.trace-step {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-bottom: var(--sp-3);
}

.step-header {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  background: var(--color-surface-2);
  cursor: pointer;
  user-select: none;
}

.step-header:hover { background: var(--color-surface); }

.step-num {
  font-weight: 600;
  font-size: 13px;
  color: var(--color-primary);
  flex-shrink: 0;
}

.step-thought-preview {
  flex: 1;
  font-size: 12px;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.step-tools-preview {
  font-size: 12px;
  flex-shrink: 0;
}

.chevron {
  color: var(--color-text-subtle);
  font-size: 10px;
  flex-shrink: 0;
}

.step-body {
  padding: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  border-top: 1px solid var(--color-border);
}

.thought-text {
  font-style: italic;
  color: #c084fc;
  font-size: 13px;
  line-height: 1.7;
}

.tool-call-row,
.tool-result-row {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-3);
  padding: var(--sp-2) 0;
  border-bottom: 1px solid rgba(46, 49, 72, 0.4);
  font-size: 13px;
}

.tool-name {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-info);
  white-space: nowrap;
}

.tool-input-details summary {
  cursor: pointer;
  font-size: 12px;
}

.result-icon { flex-shrink: 0; }
.result-summary { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.answer-text {
  color: var(--color-success);
  font-size: 13px;
  line-height: 1.7;
}
</style>
