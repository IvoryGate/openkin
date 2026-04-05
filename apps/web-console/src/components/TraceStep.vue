<template>
  <div class="trace-step">
    <div class="step-header" @click="open = !open">
      <span class="step-num">Step {{ step.stepIndex + 1 }}</span>

      <!-- 预览：文本回复 -->
      <span v-if="step.outputText && !step.toolCalls?.length" class="step-text-preview text-muted">
        💬 {{ truncate(step.outputText, 80) }}
      </span>
      <!-- 预览：工具调用 -->
      <span v-else-if="step.toolCalls?.length" class="step-tools-preview text-muted">
        🔧 {{ step.toolCalls.map(tc => tc.name).join(', ') }}
      </span>
      <!-- 预览：thought -->
      <span v-else-if="step.thought" class="step-thought-preview text-muted">
        {{ truncate(step.thought, 80) }}
      </span>
      <span v-else class="step-thought-preview text-muted">（无输出）</span>

      <span v-if="step.finalAnswer" class="badge badge--success">Final</span>
      <span class="chevron">{{ open ? '▲' : '▼' }}</span>
    </div>

    <div v-if="open" class="step-body">
      <!-- 思考过程 -->
      <div v-if="step.thought" class="thought-block">
        <div class="section-label">Thought</div>
        <p class="thought-text">{{ step.thought }}</p>
      </div>

      <!-- 工具调用 -->
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

      <!-- 工具结果 -->
      <div v-if="step.toolResults?.length" class="results-block">
        <div class="section-label">Tool Results</div>
        <div v-for="tr in step.toolResults" :key="tr.toolCallId" class="tool-result-row">
          <span class="result-icon">{{ tr.isError ? '❌' : '✅' }}</span>
          <span class="tool-name">{{ tr.name }}</span>
          <details class="result-details">
            <summary class="result-summary text-muted">{{ tr.outputSummary }}</summary>
          </details>
        </div>
      </div>

      <!-- LLM 文本输出（直接回复，无工具调用） -->
      <div v-if="step.outputText" class="output-block">
        <div class="section-label">
          Agent 回复
          <span class="section-label-sub">（LLM 文本输出）</span>
        </div>
        <div class="output-text">{{ step.outputText }}</div>
      </div>

      <!-- Final Answer（旧字段，向后兼容） -->
      <div v-if="step.finalAnswer && !step.outputText" class="answer-block">
        <div class="section-label">Final Answer</div>
        <p class="answer-text">{{ step.finalAnswer }}</p>
      </div>

      <!-- 当 step 里什么都没有时 -->
      <div v-if="!step.thought && !step.toolCalls?.length && !step.toolResults?.length && !step.outputText && !step.finalAnswer"
           class="empty-step">
        此步骤无记录内容（Agent 可能已终止或无输出）
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

.step-text-preview,
.step-thought-preview,
.step-tools-preview {
  flex: 1;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  color: #7c3aed;
  font-size: 13px;
  line-height: 1.7;
}

.tool-call-row,
.tool-result-row {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-3);
  padding: var(--sp-2) 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  font-size: 13px;
}

.tool-name {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-info);
  white-space: nowrap;
  flex-shrink: 0;
}

.tool-input-details,
.result-details {
  flex: 1;
  min-width: 0;
}

.tool-input-details summary,
.result-details summary {
  cursor: pointer;
  font-size: 12px;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-input-details pre,
.result-details pre {
  margin: 6px 0 0;
  font-size: 11px;
  font-family: var(--font-mono);
  background: #f8f9fb;
  color: #1a1d2e;
  border: 1px solid var(--color-border);
  padding: 8px;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
}

.result-icon { flex-shrink: 0; }
.result-summary { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* LLM 文本输出块 */
.output-block { }

.section-label-sub {
  font-weight: normal;
  font-size: 11px;
  text-transform: none;
  letter-spacing: 0;
  color: var(--color-text-muted);
  margin-left: 4px;
}

.output-text {
  font-size: 13px;
  line-height: 1.75;
  color: #14532d;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
  padding: 10px 14px;
  white-space: pre-wrap;
  word-break: break-word;
}

.answer-text {
  color: var(--color-success);
  font-size: 13px;
  line-height: 1.7;
}

.empty-step {
  font-size: 12px;
  color: var(--color-text-muted);
  font-style: italic;
  padding: 4px 0;
}
</style>
