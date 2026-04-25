import type { StreamEvent } from '@theworld/shared-contracts'
import type { AgentLifecycleHook, AgentResult, LLMGenerateResponse } from '@theworld/core'
import { TraceStreamHub } from './trace-stream-hub.js'

export function createSseStreamingHook(hub: TraceStreamHub): AgentLifecycleHook {
  return {
    onTextDelta(ctx, delta: string) {
      const event: StreamEvent = {
        type: 'text_delta',
        traceId: ctx.traceId,
        payload: { delta },
      }
      hub.emit(ctx.traceId, event)
    },

    async onAfterLLMCall(ctx, response: LLMGenerateResponse) {
      // If the LLM response contains tool calls, emit them
      if (response.toolCalls?.length) {
        const event: StreamEvent = {
          type: 'tool_call',
          traceId: ctx.traceId,
          payload: response.toolCalls,
        }
        hub.emit(ctx.traceId, event)
      }

      // If the LLM response also contains a text message alongside tool calls,
      // emit it as a 'message' event for intermediate reasoning display (💭).
      // For pure text replies (no tool calls), the text has already been streamed
      // via text_delta events — don't re-emit it here.
      if (response.message && response.toolCalls?.length) {
        const textContent = response.message.content
          .filter((p) => p.type === 'text')
          .map((p) => (p as { type: 'text'; text: string }).text)
          .join('')
          .trim()

        if (textContent) {
          const msgEvent: StreamEvent = {
            type: 'message',
            traceId: ctx.traceId,
            payload: { role: 'assistant', text: textContent },
          }
          hub.emit(ctx.traceId, msgEvent)
        }
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
