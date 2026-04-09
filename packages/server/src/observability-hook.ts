import type { AgentLifecycleHook, AgentResult, LLMGenerateResponse } from '@theworld/core'
import type { Message, RunError } from '@theworld/shared-contracts'
import type { MetricsStore } from './metrics.js'
import { metricsHelpers } from './metrics.js'

export interface ObservabilityHookOptions {
  /** Label for `openkin_llm_*` metrics (e.g. `openai`, `mock`). */
  llmProviderLabel: string
}

/** LLM/tool/run counters + agent run totals (slow-run logging lives in `persistence-hook`). */
export function createObservabilityHook(
  metrics: MetricsStore,
  opts: ObservabilityHookOptions,
): AgentLifecycleHook {
  const llmStartMs = new Map<string, number>()

  function llmKey(ctx: { traceId: string; stepIndex: number }): string {
    return `${ctx.traceId}:${ctx.stepIndex}`
  }

  return {
    async onBeforeLLMCall(ctx, messages: Message[]) {
      llmStartMs.set(llmKey(ctx), Date.now())
      return messages
    },

    async onAfterLLMCall(ctx, response: LLMGenerateResponse) {
      const key = llmKey(ctx)
      const start = llmStartMs.get(key) ?? Date.now()
      llmStartMs.delete(key)
      const durationMs = Math.max(0, Date.now() - start)
      metricsHelpers.recordLlmRequest(metrics, opts.llmProviderLabel, durationMs)
      return response
    },

    async onAfterToolCall(ctx, result) {
      metricsHelpers.recordToolCall(metrics, result.name)
      return result
    },

    async onRunEnd(_ctx, result: AgentResult) {
      metricsHelpers.recordAgentRun(metrics, result.status)
    },

    async onRunError(_ctx, _error: RunError) {
      // Terminal outcome is still emitted via `onRunEnd` with failed status in current engine.
    },
  }
}
