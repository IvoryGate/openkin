import type { StreamEvent } from '@openkin/shared-contracts'
import type { AgentLifecycleHook, AgentResult } from '@openkin/core'
import { TraceStreamHub } from './trace-stream-hub.js'

export function createSseStreamingHook(hub: TraceStreamHub): AgentLifecycleHook {
  return {
    async onAfterLLMCall(ctx, response) {
      if (response.toolCalls?.length) {
        const event: StreamEvent = {
          type: 'tool_call',
          traceId: ctx.traceId,
          payload: response.toolCalls,
        }
        hub.emit(ctx.traceId, event)
      }
      return response
    },

    async onAfterToolCall(ctx, result) {
      const event: StreamEvent = {
        type: 'tool_result',
        traceId: ctx.traceId,
        payload: result,
      }
      hub.emit(ctx.traceId, event)
      return result
    },

    async onRunEnd(ctx, result: AgentResult) {
      const terminal: StreamEvent =
        result.status === 'completed'
          ? { type: 'run_completed', traceId: ctx.traceId, payload: result }
          : { type: 'run_failed', traceId: ctx.traceId, payload: result }
      hub.emit(ctx.traceId, terminal)
    },
  }
}
