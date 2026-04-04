import type { Message, RunError, RunFinalStatus, ToolCall, ToolResult } from '@openkin/shared-contracts'

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
}

export interface StepTrace {
  stepIndex: number
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  finishReason?: string
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
  result?: AgentResult
  error?: RunError
  finishReason?: string
}
