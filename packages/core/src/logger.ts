/** Structured log event types for the OpenKin Agent tool layer. */

/** A single message turn in a conversation log */
export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  name?: string
}

/** Records one complete conversation turn (user→LLM round) */
export interface ConversationLogEvent {
  type: 'conversation'
  ts: string
  traceId: string
  sessionId: string
  /** 'user_message' = user input arriving, 'assistant_reply' = LLM final text output */
  turn: 'user_message' | 'assistant_reply'
  message: ConversationMessage
}

/** Records the full message list sent to LLM at each step */
export interface LLMRequestLogEvent {
  type: 'llm_request'
  ts: string
  traceId: string
  sessionId: string
  stepIndex: number
  messageCount: number
  /** Full messages – role + full content (no truncation; callers may truncate before passing) */
  messages: ConversationMessage[]
}

/** Records the LLM's response at each step */
export interface LLMResponseLogEvent {
  type: 'llm_response'
  ts: string
  traceId: string
  stepIndex: number
  finishReason: string
  /** Text content if it was a text reply */
  text?: string
  /** Tool call names if the LLM chose to call tools */
  toolCalls?: string[]
  durationMs: number
}

export interface ToolCallLogEvent {
  type: 'tool_call'
  ts: string
  traceId: string
  sessionId: string
  stepIndex: number
  toolName: string
  sourceType: 'builtin' | 'skill' | 'mcp' | 'custom'
  input: Record<string, unknown>
}

export interface ToolResultLogEvent {
  type: 'tool_result'
  ts: string
  traceId: string
  toolName: string
  durationMs: number
  /** exit code from run_script; undefined for other tools */
  exitCode?: number
  isError: boolean
  /** First 500 chars of stdout/output to avoid oversized log entries */
  outputSummary: string
}

export interface SkillRunLogEvent {
  type: 'skill_run'
  ts: string
  traceId: string
  skillId: string
  script: string
  args: Record<string, unknown>
  durationMs: number
  exitCode: number
}

export interface McpCallLogEvent {
  type: 'mcp_call'
  ts: string
  traceId: string
  providerId: string
  toolName: string
  durationMs: number
  isError: boolean
}

export interface ErrorLogEvent {
  type: 'error'
  ts: string
  traceId?: string
  message: string
  stack?: string
}

export type LogEvent =
  | ConversationLogEvent
  | LLMRequestLogEvent
  | LLMResponseLogEvent
  | ToolCallLogEvent
  | ToolResultLogEvent
  | SkillRunLogEvent
  | McpCallLogEvent
  | ErrorLogEvent

export interface Logger {
  conversation(event: ConversationLogEvent): void
  llmRequest(event: LLMRequestLogEvent): void
  llmResponse(event: LLMResponseLogEvent): void
  toolCall(event: ToolCallLogEvent): void
  toolResult(event: ToolResultLogEvent): void
  skillRun(event: SkillRunLogEvent): void
  mcpCall(event: McpCallLogEvent): void
  error(event: ErrorLogEvent): void
}

/** No-op implementation – used in tests and when no logger is wired up. */
export class NoopLogger implements Logger {
  conversation(_event: ConversationLogEvent): void {}
  llmRequest(_event: LLMRequestLogEvent): void {}
  llmResponse(_event: LLMResponseLogEvent): void {}
  toolCall(_event: ToolCallLogEvent): void {}
  toolResult(_event: ToolResultLogEvent): void {}
  skillRun(_event: SkillRunLogEvent): void {}
  mcpCall(_event: McpCallLogEvent): void {}
  error(_event: ErrorLogEvent): void {}
}
