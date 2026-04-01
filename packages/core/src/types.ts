import type { Message, RunError, RunFinalStatus, ToolCall, ToolResult } from '@openkin/shared-contracts'

export interface AgentDefinition {
  id: string
  name: string
  systemPrompt: string
  maxSteps?: number
}

export interface AgentRunInput {
  message: Message
  metadata?: Record<string, unknown>
}

export interface RunOptions {
  abortSignal?: AbortSignal
  timeoutMs?: number
  maxSteps?: number
  maxToolCalls?: number
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
  result?: AgentResult
  error?: RunError
  finishReason?: string
}
