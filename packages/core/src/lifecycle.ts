import { createRunError, type Message, type RunError, type ToolCall, type ToolResult } from '@openkin/shared-contracts'
import type { LLMGenerateResponse } from './llm.js'
import type { AgentResult, RunState } from './types.js'

export interface HookContext {
  traceId: string
  sessionId: string
  agentId: string
  stepIndex: number
}

export interface GuardResult<T> {
  action: 'continue' | 'abort' | 'replace'
  reason?: string
  replacement?: T
}

export interface AgentLifecycleHook {
  onRunStart?(ctx: HookContext): Promise<void> | void
  onRunEnd?(ctx: HookContext, result: AgentResult): Promise<void> | void
  onRunError?(ctx: HookContext, error: RunError): Promise<void> | void
  onBeforeLLMCall?(ctx: HookContext, messages: Message[]): Promise<Message[] | null | undefined> | Message[] | null | undefined
  onAfterLLMCall?(ctx: HookContext, response: LLMGenerateResponse): Promise<LLMGenerateResponse | null | undefined> | LLMGenerateResponse | null | undefined
  onBeforeToolCall?(ctx: HookContext, call: ToolCall): Promise<GuardResult<ToolCall>> | GuardResult<ToolCall>
  onAfterToolCall?(ctx: HookContext, result: ToolResult): Promise<ToolResult | null | undefined> | ToolResult | null | undefined
}

export interface HookRunner {
  onRunStart(state: RunState): Promise<void>
  onRunEnd(state: RunState, result: AgentResult): Promise<void>
  onRunError(state: RunState, error: RunError): Promise<void>
  beforeLLMCall(state: RunState, messages: Message[]): Promise<Message[]>
  afterLLMCall(state: RunState, response: LLMGenerateResponse): Promise<LLMGenerateResponse>
  beforeToolCall(state: RunState, call: ToolCall): Promise<ToolCall>
  afterToolCall(state: RunState, result: ToolResult): Promise<ToolResult>
}

function ctxFrom(state: RunState): HookContext {
  return {
    traceId: state.traceId,
    sessionId: state.sessionId,
    agentId: state.agentId,
    stepIndex: state.stepIndex,
  }
}

export class InMemoryHookRunner implements HookRunner {
  constructor(private readonly hooks: AgentLifecycleHook[] = []) {}

  async onRunStart(state: RunState): Promise<void> {
    const ctx = ctxFrom(state)
    await Promise.all(this.hooks.map(async (hook) => {
      try {
        await hook.onRunStart?.(ctx)
      } catch {
        // Observer hooks should not break the run.
      }
    }))
  }

  async onRunEnd(state: RunState, result: AgentResult): Promise<void> {
    const ctx = ctxFrom(state)
    await Promise.all(this.hooks.map(async (hook) => {
      try {
        await hook.onRunEnd?.(ctx, result)
      } catch {
        // Observer hooks should not break the run.
      }
    }))
  }

  async onRunError(state: RunState, error: RunError): Promise<void> {
    const ctx = ctxFrom(state)
    await Promise.all(this.hooks.map(async (hook) => {
      try {
        await hook.onRunError?.(ctx, error)
      } catch {
        // Observer hooks should not break the run.
      }
    }))
  }

  async beforeLLMCall(state: RunState, messages: Message[]): Promise<Message[]> {
    const ctx = ctxFrom(state)
    let current = messages
    for (const hook of this.hooks) {
      const next = await hook.onBeforeLLMCall?.(ctx, current)
      if (next) current = next
    }
    return current
  }

  async afterLLMCall(state: RunState, response: LLMGenerateResponse): Promise<LLMGenerateResponse> {
    const ctx = ctxFrom(state)
    let current = response
    for (const hook of this.hooks) {
      const next = await hook.onAfterLLMCall?.(ctx, current)
      if (next) current = next
    }
    return current
  }

  async beforeToolCall(state: RunState, call: ToolCall): Promise<ToolCall> {
    const ctx = ctxFrom(state)
    let current = call
    for (const hook of this.hooks) {
      const result = await hook.onBeforeToolCall?.(ctx, current)
      if (!result || result.action === 'continue') continue
      if (result.action === 'replace' && result.replacement) {
        current = result.replacement
        continue
      }
      throw createRunError('RUN_ABORTED', result.reason ?? `Tool call aborted: ${current.name}`, 'hook', {
        toolName: current.name,
      })
    }
    return current
  }

  async afterToolCall(state: RunState, result: ToolResult): Promise<ToolResult> {
    const ctx = ctxFrom(state)
    let current = result
    for (const hook of this.hooks) {
      const next = await hook.onAfterToolCall?.(ctx, current)
      if (next) current = next
    }
    return current
  }
}
