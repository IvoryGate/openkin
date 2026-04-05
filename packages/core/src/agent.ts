import type { Message } from '@openkin/shared-contracts'
import { SimpleContextManager } from './context.js'
import type { SimpleContextManagerOptions } from './context.js'
import type { AgentLifecycleHook } from './lifecycle.js'
import { InMemoryHookRunner } from './lifecycle.js'
import type { LLMProvider } from './llm.js'
import { ReActRunEngine } from './run-engine.js'
import { InMemorySessionRegistry, type Session, type SessionRuntime } from './session.js'
import type { ToolRuntime } from './tool-runtime.js'
import type { AgentDefinition, AgentResult, RunOptions } from './types.js'

export class OpenKinAgent {
  private readonly runEngine = new ReActRunEngine()

  constructor(
    private readonly definition: AgentDefinition,
    private readonly llm: LLMProvider,
    private readonly toolRuntime: ToolRuntime,
    private readonly sessions = new InMemorySessionRegistry(),
    private readonly hooks: AgentLifecycleHook[] = [],
    private readonly contextOptions: SimpleContextManagerOptions = {},
  ) {}

  /** Ensures a session exists without running a turn (e.g. REST `POST /v1/sessions`). */
  createSession(session: Session): void {
    this.ensureRuntime(session)
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId)?.session
  }

  /** Number of in-memory sessions currently tracked (debug / introspection). */
  activeSessionCount(): number {
    return this.sessions.size()
  }

  async run(sessionId: string, userText: string, options?: RunOptions): Promise<AgentResult> {
    const baseRuntime = this.ensureRuntime({ id: sessionId, kind: 'chat' })
    const agent = options?.agentDefinition ?? this.definition
    const runtime =
      options?.agentDefinition != null
        ? {
            ...baseRuntime,
            agent,
            contextManager: new SimpleContextManager(options.agentDefinition, baseRuntime.history, this.contextOptions),
          }
        : baseRuntime
    return this.runEngine.run({
      agent,
      runtime,
      input: {
        message: {
          role: 'user',
          content: [{ type: 'text', text: userText }],
        },
      },
      options,
    })
  }

  private ensureRuntime(session: Session): SessionRuntime {
    const existing = this.sessions.get(session.id)
    if (existing) return existing

    const history: Message[] = []
    const runtime: SessionRuntime = {
      session,
      agent: this.definition,
      llm: this.llm,
      toolRuntime: this.toolRuntime,
      hookRunner: new InMemoryHookRunner(this.hooks),
      history,
      contextManager: new SimpleContextManager(this.definition, history, this.contextOptions),
    }
    this.sessions.set(runtime)
    return runtime
  }
}
