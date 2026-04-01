import type { Message } from '@openkin/shared-contracts'
import type { ContextManager } from './context.js'
import type { LLMProvider } from './llm.js'
import type { HookRunner } from './lifecycle.js'
import type { ToolRuntime } from './tool-runtime.js'
import type { AgentDefinition } from './types.js'

export interface Session {
  id: string
  kind: 'chat' | 'task' | 'channel'
}

export interface SessionRuntime {
  session: Session
  agent: AgentDefinition
  llm: LLMProvider
  contextManager: ContextManager
  toolRuntime: ToolRuntime
  hookRunner: HookRunner
  history: Message[]
}

export class InMemorySessionRegistry {
  private readonly runtimes = new Map<string, SessionRuntime>()

  get(sessionId: string): SessionRuntime | undefined {
    return this.runtimes.get(sessionId)
  }

  set(runtime: SessionRuntime): void {
    this.runtimes.set(runtime.session.id, runtime)
  }
}
