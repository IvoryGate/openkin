import { createRunError, type Message, type RunError } from '@openkin/shared-contracts'
import type { SessionRuntime } from './session.js'
import { executeToolCall } from './tool-runtime.js'
import { assertRunNotYetFinished } from './run-guards.js'
import type { AgentDefinition, AgentResult, AgentRunInput, RunOptions, RunState, StepTrace } from './types.js'

function createTraceId(): string {
  return `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function asRunError(error: unknown): RunError {
  if (typeof error === 'object' && error && 'code' in error && 'message' in error && 'source' in error) {
    return error as RunError
  }

  return createRunError(
    'RUN_INTERNAL_ERROR',
    error instanceof Error ? error.message : 'Unknown runtime error',
    'runtime',
  )
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
  if (!timeoutMs) {
    return promise
  }

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(createRunError('RUN_TIMEOUT', `Run timed out after ${timeoutMs}ms`, 'runtime', { timeoutMs }))
    }, timeoutMs)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export interface RunArgs {
  agent: AgentDefinition
  runtime: SessionRuntime
  input: AgentRunInput
  options?: RunOptions
}

export interface RunEngine {
  run(args: RunArgs): Promise<AgentResult>
}

export class ReActRunEngine implements RunEngine {
  async run(args: RunArgs): Promise<AgentResult> {
    const maxSteps = args.options?.maxSteps ?? args.agent.maxSteps ?? 6
    const maxToolCalls = args.options?.maxToolCalls ?? maxSteps
    const state: RunState = {
      traceId: args.options?.traceId ?? createTraceId(),
      sessionId: args.runtime.session.id,
      agentId: args.agent.id,
      stepIndex: 0,
      toolCallCount: 0,
      status: 'running',
      steps: [],
      startedAt: Date.now(),
      maxPromptTokens: args.options?.maxPromptTokens,
      systemSuffix: args.options?.systemSuffix,
    }

    try {
      await withTimeout(args.runtime.contextManager.beginRun(args.input, state), args.options?.timeoutMs)
      await args.runtime.hookRunner.onRunStart(state)

      while (state.stepIndex < maxSteps) {
        if (args.options?.abortSignal?.aborted) {
          state.status = 'cancelled'
          state.finishReason = 'abort_signal'
          state.error = createRunError('RUN_CANCELLED', 'Run cancelled by abort signal', 'runtime')
          return await this.finish(args.runtime, state)
        }

        let messages = await withTimeout(args.runtime.contextManager.buildSnapshot(state), args.options?.timeoutMs)
        messages = await args.runtime.hookRunner.beforeLLMCall(state, messages)

        const runtimeView = await withTimeout(
          args.runtime.toolRuntime.getRuntimeView({
            agent: args.agent,
            session: args.runtime.session,
            state,
            metadata: args.input.metadata,
          }),
          args.options?.timeoutMs,
        )
        let response = await withTimeout(
          args.runtime.llm.generate({
            messages,
            tools: runtimeView.getToolSchemaList(),
            // Wire streaming token deltas through the hook runner
            onTextDelta: (delta: string) => args.runtime.hookRunner.textDelta(state, delta),
          }),
          args.options?.timeoutMs,
        )
        response = await args.runtime.hookRunner.afterLLMCall(state, response)
        const trace: StepTrace = { stepIndex: state.stepIndex, finishReason: response.finishReason }

        if (response.toolCalls?.length) {
          state.toolCallCount += response.toolCalls.length
          if (state.toolCallCount > maxToolCalls) {
            state.status = 'budget_exhausted'
            state.finishReason = 'max_tool_calls_exceeded'
            state.error = createRunError(
              'RUN_MAX_TOOL_CALLS_EXCEEDED',
              `Tool call budget exceeded: ${state.toolCallCount}/${maxToolCalls}`,
              'runtime',
              { maxToolCalls, toolCallCount: state.toolCallCount },
            )
            return await this.finish(args.runtime, state)
          }

          // Append the assistant's tool-call decision to history BEFORE tool results.
          // This is required by the OpenAI protocol: the conversation must show
          //   assistant (tool_calls) → tool (result) → assistant (next step)
          // Without this, models like LongCat re-evaluate from scratch each step
          // and repeatedly invoke the same tool.
          const assistantToolCallMessage: Message = {
            role: 'assistant',
            content: response.toolCalls.map((tc) => ({
              type: 'json' as const,
              value: { tool_call_id: tc.id, name: tc.name, arguments: tc.input },
            })),
          }
          await withTimeout(
            args.runtime.contextManager.appendAssistant(assistantToolCallMessage, state),
            args.options?.timeoutMs,
          )

          trace.toolCalls = response.toolCalls
          const results = []
          for (const originalCall of response.toolCalls) {
            const toolCall = await args.runtime.hookRunner.beforeToolCall(state, originalCall)
            let result = await withTimeout(
              executeToolCall({ call: toolCall, runtimeView, state }),
              args.options?.timeoutMs,
            )
            result = await args.runtime.hookRunner.afterToolCall(state, result)
            results.push(result)
          }
          trace.toolResults = results
          state.steps.push(trace)
          await withTimeout(args.runtime.contextManager.appendToolResults(results, state), args.options?.timeoutMs)
          state.stepIndex += 1
          continue
        }

        if (response.message) {
          await withTimeout(args.runtime.contextManager.appendAssistant(response.message, state), args.options?.timeoutMs)
          // Capture the text output so the trace step is not empty for text-only replies
          const textParts = response.message.content
            .filter((p): p is import('@openkin/shared-contracts').TextPart => p.type === 'text')
            .map((p) => p.text)
          if (textParts.length > 0) trace.outputText = textParts.join('')
          state.steps.push(trace)
          state.status = 'completed'
          state.finishReason = response.finishReason
          return await this.finish(args.runtime, state, response.message)
        }

        break
      }

      state.status = 'budget_exhausted'
      state.finishReason = 'max_steps_exceeded'
      state.error = createRunError(
        'RUN_MAX_STEPS_EXCEEDED',
        `Run exceeded max steps: ${maxSteps}`,
        'runtime',
        { maxSteps },
      )
      return await this.finish(args.runtime, state)
    } catch (error) {
      state.error = asRunError(error)
      state.finishReason = state.error.code
      state.status = state.error.code === 'RUN_ABORTED' ? 'aborted' : 'failed'
      await args.runtime.hookRunner.onRunError(state, state.error)
      return await this.finish(args.runtime, state)
    }
  }

  private async finish(runtime: SessionRuntime, state: RunState, output?: Message): Promise<AgentResult> {
    assertRunNotYetFinished(state)
    const result: AgentResult = {
      traceId: state.traceId,
      sessionId: state.sessionId,
      status: state.status === 'running' ? 'failed' : state.status,
      output,
      steps: state.steps,
      error: state.error,
      finishReason: state.finishReason,
    }
    state.result = result
    await runtime.hookRunner.onRunEnd(state, result)
    return result
  }
}
