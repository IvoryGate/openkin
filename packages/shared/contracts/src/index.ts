export type MessageRole = 'system' | 'user' | 'assistant' | 'tool'

export interface TextPart {
  type: 'text'
  text: string
}

export interface JsonPart {
  type: 'json'
  value: unknown
}

export type MessagePart = TextPart | JsonPart

export interface Message {
  role: MessageRole
  content: MessagePart[]
  name?: string
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResult {
  toolCallId: string
  name: string
  output: unknown
  isError?: boolean
}

export type LLMErrorCode =
  | 'LLM_RATE_LIMIT'
  | 'LLM_TIMEOUT'
  | 'LLM_UNAVAILABLE'
  | 'LLM_INVALID_RESPONSE'
  | 'LLM_CONTEXT_OVERFLOW'

export type ToolErrorCode =
  | 'TOOL_NOT_FOUND'
  | 'TOOL_INVALID_INPUT'
  | 'TOOL_EXECUTION_FAILED'
  | 'TOOL_TIMEOUT'
  | 'TOOL_PERMISSION_DENIED'

export type RunErrorCode =
  | 'RUN_CANCELLED'
  | 'RUN_ABORTED'
  | 'RUN_MAX_STEPS_EXCEEDED'
  | 'RUN_MAX_TOOL_CALLS_EXCEEDED'
  | 'RUN_TIMEOUT'
  | 'RUN_CONTEXT_BUILD_FAILED'
  | 'RUN_HOOK_FAILED'
  | 'RUN_INTERNAL_ERROR'

export type RunFinalStatus =
  | 'completed'
  | 'aborted'
  | 'cancelled'
  | 'budget_exhausted'
  | 'failed'

export interface RunError {
  code: LLMErrorCode | ToolErrorCode | RunErrorCode | string
  message: string
  source: 'llm' | 'tool' | 'runtime' | 'hook' | 'context'
  retryable?: boolean
  details?: Record<string, unknown>
}

export function createRunError(
  code: LLMErrorCode | ToolErrorCode | RunErrorCode | string,
  message: string,
  source: RunError['source'],
  details?: Record<string, unknown>,
  retryable?: boolean,
): RunError {
  return {
    code,
    message,
    source,
    details,
    retryable,
  }
}

export interface StreamEvent {
  type: 'message' | 'tool_call' | 'tool_result' | 'run_completed' | 'run_failed'
  traceId: string
  payload: unknown
}

export interface ApiEnvelope<T> {
  ok: boolean
  data?: T
  error?: RunError
}
