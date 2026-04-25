import type { AgentLifecycleHook, AgentResult, Logger } from '@theworld/core'
import type { HookContext } from '@theworld/core'
import type { Message, ToolCall, ToolResult } from '@theworld/shared-contracts'
import type { LLMGenerateResponse } from '@theworld/core'
import { flattenMessageContent } from './message-persistence.js'

function textOf(msg: Message): string {
  return flattenMessageContent(msg)
}

function messagesForLog(messages: Message[]) {
  return messages.map((m) => ({
    role: m.role as 'system' | 'user' | 'assistant' | 'tool',
    content: textOf(m),
    ...(m.name ? { name: m.name } : {}),
  }))
}

/**
 * createLogHook — wires a Logger into the agent lifecycle.
 *
 * Records:
 *  - onRunStart:       user_message conversation event
 *  - onRunEnd:         assistant_reply conversation event (if completed with text)
 *  - onBeforeLLMCall:  full llm_request event (all messages sent to LLM)
 *  - onAfterLLMCall:   llm_response event (text or tool_calls)
 *  - onBeforeToolCall: tool_call event
 *  - onAfterToolCall:  tool_result event with duration
 *  - onRunError:       error event
 */
export function createLogHook(logger: Logger): AgentLifecycleHook {
  const toolStartTimes = new Map<string, number>()
  const llmCallStartTimes = new Map<string, number>()

  return {
    onRunStart(ctx: HookContext): void {
      // The user message is already in context by the time onRunStart fires.
      // We'll capture it in onBeforeLLMCall (first call, step 0) from the messages array.
    },

    onBeforeLLMCall(ctx: HookContext, messages: Message[]): Message[] {
      try {
        const llmKey = `${ctx.traceId}:${ctx.stepIndex}`
        llmCallStartTimes.set(llmKey, Date.now())

        const mappedMessages = messagesForLog(messages)

        // On step 0: log the user's message as a conversation event
        if (ctx.stepIndex === 0) {
          const userMsg = [...messages].reverse().find((m) => m.role === 'user')
          if (userMsg) {
            logger.conversation({
              type: 'conversation',
              ts: new Date().toISOString(),
              traceId: ctx.traceId,
              sessionId: ctx.sessionId,
              turn: 'user_message',
              message: { role: 'user', content: textOf(userMsg) },
            })
          }
        }

        logger.llmRequest({
          type: 'llm_request',
          ts: new Date().toISOString(),
          traceId: ctx.traceId,
          sessionId: ctx.sessionId,
          stepIndex: ctx.stepIndex,
          messageCount: messages.length,
          messages: mappedMessages,
        })
      } catch { /* best effort */ }
      return messages
    },

    onAfterLLMCall(ctx: HookContext, response: LLMGenerateResponse): LLMGenerateResponse {
      try {
        const llmKey = `${ctx.traceId}:${ctx.stepIndex}`
        const startTime = llmCallStartTimes.get(llmKey) ?? Date.now()
        llmCallStartTimes.delete(llmKey)
        const durationMs = Date.now() - startTime

        if (response.toolCalls?.length) {
          logger.llmResponse({
            type: 'llm_response',
            ts: new Date().toISOString(),
            traceId: ctx.traceId,
            stepIndex: ctx.stepIndex,
            finishReason: response.finishReason,
            toolCalls: response.toolCalls.map((tc: ToolCall) => tc.name),
            durationMs,
          })
        } else if (response.message) {
          const text = textOf(response.message)
          logger.llmResponse({
            type: 'llm_response',
            ts: new Date().toISOString(),
            traceId: ctx.traceId,
            stepIndex: ctx.stepIndex,
            finishReason: response.finishReason,
            text,
            durationMs,
          })
        }
      } catch { /* best effort */ }
      return response
    },

    onBeforeToolCall(ctx: HookContext, call: ToolCall) {
      try {
        const key = `${ctx.traceId}:${ctx.stepIndex}:${call.name}`
        toolStartTimes.set(key, Date.now())

        logger.toolCall({
          type: 'tool_call',
          ts: new Date().toISOString(),
          traceId: ctx.traceId,
          sessionId: ctx.sessionId,
          stepIndex: ctx.stepIndex,
          toolName: call.name,
          sourceType: 'builtin',
          input: call.input,
        })
      } catch { /* best effort */ }
      return { action: 'continue' as const }
    },

    onAfterToolCall(ctx: HookContext, result: ToolResult): ToolResult {
      try {
        const key = `${ctx.traceId}:${ctx.stepIndex}:${result.name}`
        const startTime = toolStartTimes.get(key) ?? Date.now()
        toolStartTimes.delete(key)
        const durationMs = Date.now() - startTime

        const rawOutput = JSON.stringify(result.output)
        logger.toolResult({
          type: 'tool_result',
          ts: new Date().toISOString(),
          traceId: ctx.traceId,
          toolName: result.name,
          durationMs,
          isError: result.isError ?? false,
          outputSummary: rawOutput.slice(0, 500),
        })
      } catch { /* best effort */ }
      return result
    },

    onRunEnd(ctx: HookContext, result: AgentResult): void {
      try {
        // Log the assistant's final text reply as a conversation event
        if (result.status === 'completed' && result.output) {
          const text = textOf(result.output)
          if (text) {
            logger.conversation({
              type: 'conversation',
              ts: new Date().toISOString(),
              traceId: ctx.traceId,
              sessionId: ctx.sessionId,
              turn: 'assistant_reply',
              message: { role: 'assistant', content: text },
            })
          }
        }
      } catch { /* best effort */ }
    },

    onRunError(ctx: HookContext, error: unknown): void {
      try {
        logger.error({
          type: 'error',
          ts: new Date().toISOString(),
          traceId: ctx.traceId,
          message: String((error as { message?: string }).message ?? error),
          stack: (error as { stack?: string }).stack,
        })
      } catch { /* best effort */ }
    },
  }
}
