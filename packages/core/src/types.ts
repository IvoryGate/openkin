import type { Message, RunError, RunFinalStatus, ToolCall, ToolResult } from '@theworld/shared-contracts'

export interface AgentDefinition {
  id: string
  name: string
  /** Static string or an async factory called before every LLM turn (enables hot-reload of Skills). */
  systemPrompt: string | (() => Promise<string>)
  maxSteps?: number
}

export interface AgentRunInput {
  message: Message
  metadata?: Record<string, unknown>
}

export interface RunOptions {
  /** When set (e.g. by the service layer), the run uses this id so clients can subscribe to `/v1/runs/:traceId/stream` before the run finishes. */
  traceId?: string
  abortSignal?: AbortSignal
  timeoutMs?: number
  maxSteps?: number
  maxToolCalls?: number
  maxPromptTokens?: number
  /** When set by the service layer, overrides the agent definition for this run only (system prompt, id, name for tools/memory). */
  agentDefinition?: AgentDefinition
  /**
   * Optional text appended to the system prompt for this run only.
   * Used by the scheduler to inject task-execution context so the LLM
   * understands the message is an automated instruction (not a user chat).
   */
  systemSuffix?: string
  /**
   * Completely replaces the agent's system prompt for this run only.
   * When set, agent.systemPrompt and systemSuffix are both ignored.
   * Used by the scheduler to inject a lean, task-specific system prompt
   * that contains ONLY what the task runner needs.
   */
  overrideSystemPrompt?: string
  /**
   * 095: when set, used as the full user `Message` for this turn (`userText` argument to `run()` is ignored).
   * Enables `ImagePart` / `FileRefPart` in `content`.
   */
  userMessage?: Message
}

export interface StepTrace {
  stepIndex: number
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  finishReason?: string
  /** LLM text output for this step (present when the model replied with text instead of tool calls) */
  outputText?: string
}

export interface AgentResult {
  traceId: string
  sessionId: string
  status: RunFinalStatus
  output?: Message
  steps: StepTrace[]
  error?: RunError
  finishReason?: string
}

export interface RunState {
  traceId: string
  sessionId: string
  agentId: string
  stepIndex: number
  toolCallCount: number
  status: 'running' | RunFinalStatus
  steps: StepTrace[]
  startedAt: number
  maxPromptTokens?: number
  /** Extra text appended to the system prompt for this run (e.g. injected by scheduler). */
  systemSuffix?: string
  /**
   * When set, completely replaces the system prompt for this run.
   * Both agent.systemPrompt and systemSuffix are ignored.
   */
  overrideSystemPrompt?: string
  result?: AgentResult
  error?: RunError
  finishReason?: string
}
