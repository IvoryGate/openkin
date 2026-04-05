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
  type: 'message' | 'tool_call' | 'tool_result' | 'run_completed' | 'run_failed' | 'text_delta'
  traceId: string
  payload: unknown
}

export interface ApiEnvelope<T> {
  ok: boolean
  data?: T
  error?: RunError
}

// --- Service API (v1): routes, DTOs, SSE wire format (exec plan 004) ---

export const API_V1_PREFIX = '/v1' as const

/** `GET /health` — liveness / readiness probe (not under `/v1`). */
export function apiPathHealth(): string {
  return '/health'
}

export interface HealthResponseBody {
  ok: boolean
  version: string
  db: 'connected' | 'unavailable' | 'not_configured'
  uptime: number
  ts: number
}

export function apiPathSessions(): string {
  return `${API_V1_PREFIX}/sessions`
}

export function apiPathSession(sessionId: string): string {
  return `${API_V1_PREFIX}/sessions/${encodeURIComponent(sessionId)}`
}

export function apiPathRuns(): string {
  return `${API_V1_PREFIX}/runs`
}

export function apiPathTraces(): string {
  return `${API_V1_PREFIX}/traces`
}

export function apiPathRunStream(traceId: string): string {
  return `${API_V1_PREFIX}/runs/${encodeURIComponent(traceId)}/stream`
}

/** Single run trace (operator surface; not the SSE stream path). */
export function apiPathRun(traceId: string): string {
  return `${API_V1_PREFIX}/runs/${encodeURIComponent(traceId)}`
}

export function apiPathSessionTraces(sessionId: string): string {
  return `${API_V1_PREFIX}/sessions/${encodeURIComponent(sessionId)}/traces`
}

export interface ToolCallSummary {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResultSummary {
  toolCallId: string
  name: string
  isError: boolean
  outputSummary: string
}

export interface RunStepDto {
  stepIndex: number
  thought?: string
  toolCalls?: ToolCallSummary[]
  toolResults?: ToolResultSummary[]
  finalAnswer?: string
  /** LLM text output (present when the model replied with text rather than tool calls) */
  outputText?: string
}

export interface TraceDto {
  traceId: string
  sessionId: string
  agentId: string
  status: RunFinalStatus
  steps: RunStepDto[]
  durationMs: number | null
  createdAt: number
}

export interface TraceSummaryDto {
  traceId: string
  sessionId: string
  agentId: string
  status: RunFinalStatus
  stepCount: number
  durationMs: number | null
  createdAt: number
}

export interface ListSessionTracesResponseBody {
  traces: TraceSummaryDto[]
  hasMore: boolean
}

export interface SessionDto {
  id: string
  kind: 'chat' | 'task' | 'channel'
  agentId?: string
  createdAt?: number
}

export type SessionKindDto = SessionDto['kind']

export interface ListSessionsRequest {
  limit?: number
  offset?: number
  /** Filter by session kind. If omitted, returns all kinds. */
  kind?: 'chat' | 'task' | 'channel' | ''
}

export interface ListSessionsResponseBody {
  sessions: SessionDto[]
  total: number
}

export interface MessageDto {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string
  createdAt: number
}

export interface ListMessagesRequest {
  limit?: number
  before?: number
}

export interface ListMessagesResponseBody {
  messages: MessageDto[]
  hasMore: boolean
}

export function apiPathSessionMessages(sessionId: string): string {
  return `${API_V1_PREFIX}/sessions/${encodeURIComponent(sessionId)}/messages`
}

export function apiPathAgents(): string {
  return `${API_V1_PREFIX}/agents`
}

export function apiPathAgent(agentId: string): string {
  return `${API_V1_PREFIX}/agents/${encodeURIComponent(agentId)}`
}

export function apiPathAgentEnable(agentId: string): string {
  return `${API_V1_PREFIX}/agents/${encodeURIComponent(agentId)}/enable`
}

export function apiPathAgentDisable(agentId: string): string {
  return `${API_V1_PREFIX}/agents/${encodeURIComponent(agentId)}/disable`
}

export type TaskTriggerTypeDto = 'cron' | 'once' | 'interval'

export function apiPathTasks(): string {
  return `${API_V1_PREFIX}/tasks`
}

export function apiPathTask(taskId: string): string {
  return `${API_V1_PREFIX}/tasks/${encodeURIComponent(taskId)}`
}

export function apiPathTaskEnable(taskId: string): string {
  return `${API_V1_PREFIX}/tasks/${encodeURIComponent(taskId)}/enable`
}

export function apiPathTaskDisable(taskId: string): string {
  return `${API_V1_PREFIX}/tasks/${encodeURIComponent(taskId)}/disable`
}

export function apiPathTaskTrigger(taskId: string): string {
  return `${API_V1_PREFIX}/tasks/${encodeURIComponent(taskId)}/trigger`
}

export function apiPathTaskRuns(taskId: string): string {
  return `${API_V1_PREFIX}/tasks/${encodeURIComponent(taskId)}/runs`
}

export function apiPathTaskRunDetail(taskId: string, runId: string): string {
  return `${API_V1_PREFIX}/tasks/${encodeURIComponent(taskId)}/runs/${encodeURIComponent(runId)}`
}

export interface TaskDto {
  id: string
  name: string
  triggerType: TaskTriggerTypeDto
  triggerConfig: Record<string, unknown>
  agentId: string
  input: RunInputDto
  enabled: boolean
  createdBy: string
  createdAt: number
  nextRunAt: number | null
  /** Webhook URL to POST `TaskRunEventDto` on task completion, if configured. */
  webhookUrl?: string | null
}

export interface TaskRunDto {
  id: string
  /** null when the parent scheduled task has been deleted (run history is preserved) */
  taskId: string | null
  status: 'running' | 'completed' | 'failed'
  progress: number | null
  progressMsg: string | null
  output: unknown | null
  error: unknown | null
  traceId: string | null
  sessionId: string | null
  retryCount: number
  startedAt: number
  completedAt: number | null
}

export interface CreateTaskRequest {
  name: string
  triggerType: TaskTriggerTypeDto
  triggerConfig: Record<string, unknown>
  agentId: string
  input: RunInputDto
  enabled?: boolean
  createdBy?: 'user' | 'agent'
  /**
   * Optional webhook URL. When set, the server POSTs a `TaskRunEventDto` JSON
   * body to this URL after each task run completes (success or failure).
   */
  webhookUrl?: string
}

export interface UpdateTaskRequest {
  name?: string
  triggerType?: TaskTriggerTypeDto
  triggerConfig?: Record<string, unknown>
  agentId?: string
  input?: RunInputDto
  enabled?: boolean
  /**
   * Set to `null` to remove an existing webhook, or a URL string to update it.
   */
  webhookUrl?: string | null
}

// ── Task Run Event (SSE + Webhook shared payload) ─────────────────────────────

/**
 * Emitted by the server after every task run finishes (success or failure).
 * Used by both the SSE stream (`GET /v1/tasks/events`) and Webhook callbacks.
 */
export interface TaskRunEventDto {
  type: 'task_run_finished'
  taskId: string
  taskName: string
  runId: string
  sessionId: string
  traceId: string
  status: 'completed' | 'failed'
  /** Agent output text (success only) */
  output?: string
  /** Error message (failure only) */
  error?: string
  startedAt: number
  completedAt: number
  ts: number
}

/** Path for the SSE stream of task run events. */
export function apiPathTaskEvents(): string {
  return `${API_V1_PREFIX}/tasks/events`
}

export interface CreateTaskResponseBody {
  task: TaskDto
}

export interface ListTasksResponseBody {
  tasks: TaskDto[]
}

export interface TriggerTaskResponseBody {
  runId: string
  traceId: string
  sessionId: string
}

export interface ListTaskRunsResponseBody {
  runs: TaskRunDto[]
}

export interface GetTaskRunResponseBody {
  run: TaskRunDto
}

export interface AgentDto {
  id: string
  name: string
  description?: string
  systemPrompt: string
  model?: string
  enabled: boolean
  isBuiltin: boolean
  createdAt: number
  updatedAt: number
}

export interface CreateAgentRequest {
  id?: string
  name: string
  description?: string
  systemPrompt: string
  model?: string
}

export interface UpdateAgentRequest {
  name?: string
  description?: string
  systemPrompt?: string
  model?: string
}

export interface ListAgentsResponseBody {
  agents: AgentDto[]
}

export interface CreateSessionRequest {
  kind?: SessionDto['kind']
}

export interface CreateSessionResponseBody {
  session: SessionDto
}

export interface GetSessionResponseBody {
  session: SessionDto
}

export interface RunInputDto {
  /** Plain user text; service builds a user `Message`. */
  text: string
}

export interface CreateRunRequest {
  sessionId: string
  input: RunInputDto
  /** When set, uses this persisted Agent for the run (see Agent API). Omit to use the server default definition. */
  agentId?: string
}

export interface CreateRunResponseBody {
  traceId: string
  sessionId: string
}

/** SSE: `event` line = `StreamEvent.type`, `data` line = full `StreamEvent` JSON. */
export function formatSseEvent(event: StreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

/** Parse SSE response body into `StreamEvent[]` (each `data:` line is one JSON `StreamEvent`). */
export function parseSseStreamEvents(sseText: string): StreamEvent[] {
  const out: StreamEvent[] = []
  for (const block of sseText.split(/\n\n+/)) {
    if (!block.trim()) continue
    let dataLine: string | undefined
    for (const line of block.split('\n')) {
      if (line.startsWith('data: ')) {
        dataLine = line.slice(6)
      }
    }
    if (!dataLine) continue
    try {
      out.push(JSON.parse(dataLine) as StreamEvent)
    } catch {
      // skip malformed block
    }
  }
  return out
}

// --- Debug & Introspection API (exec plan 024) ---

export interface McpProviderStatusDto {
  id: string
  status: 'connected' | 'disconnected' | 'error'
  toolCount: number
  error?: string
}

export interface SystemStatusResponseBody {
  version: string
  uptime: number
  db: 'connected' | 'unavailable' | 'not_configured'
  activeSessions: number
  tools: {
    builtin: number
    mcp: number
    total: number
  }
  skills: {
    loaded: number
    list: string[]
  }
  mcpProviders: McpProviderStatusDto[]
  ts: number
}

export interface LogEntryDto {
  type: string
  level?: string
  ts: number
  sessionId?: string
  traceId?: string
  message?: string
  [key: string]: unknown
}

export interface ListLogsRequest {
  date?: string
  level?: string
  limit?: number
  before?: number
  search?: string
}

export interface ListLogsResponseBody {
  logs: LogEntryDto[]
  hasMore: boolean
}

export interface ListTracesResponseBody {
  traces: TraceSummaryDto[]
  total: number
  limit: number
  offset: number
}

export interface ToolEntryDto {
  name: string
  description: string
  source: 'builtin' | 'mcp' | 'skill' | 'custom'
  providerId?: string
  parameters?: Record<string, unknown>
}

export interface ListToolsResponseBody {
  tools: ToolEntryDto[]
}

export interface SkillEntryDto {
  id: string
  title: string
  description: string
  hasScript: boolean
}

export interface ListSkillsApiResponseBody {
  skills: SkillEntryDto[]
}

export interface GetSkillContentResponseBody {
  id: string
  content: string
}

// ── DB Inspect API ──────────────────────────────────────────────────────────

export interface DbTableInfoDto {
  name: string
  rowCount: number
  columns: { name: string; type: string }[]
}

export interface ListDbTablesResponseBody {
  tables: DbTableInfoDto[]
}

export interface DbQueryResponseBody {
  columns: string[]
  rows: unknown[][]
  rowCount: number
  truncated: boolean
}

export interface McpStatusResponseBody {
  providers: McpProviderStatusDto[]
}

export function apiPathSystemStatus(): string {
  return `${API_V1_PREFIX}/system/status`
}

export function apiPathDbTables(): string {
  return `${API_V1_PREFIX}/db/tables`
}

export function apiPathDbQuery(): string {
  return `${API_V1_PREFIX}/db/query`
}

export function apiPathLogs(): string {
  return `${API_V1_PREFIX}/logs`
}

export function apiPathTools(): string {
  return `${API_V1_PREFIX}/tools`
}

export function apiPathSkills(): string {
  return `${API_V1_PREFIX}/skills`
}

export function apiPathSkillContent(id: string): string {
  return `${API_V1_PREFIX}/skills/${encodeURIComponent(id)}/content`
}

// ── Server Config API (exec plan 027) ────────────────────────────────────────

/**
 * Runtime configuration grouped by domain.
 * Secret fields (API keys) are never returned as plain text —
 * only `hasXxx: boolean` is exposed.
 */
export interface ServerConfigDto {
  llm: {
    /** Whether an LLM API key is set. The key itself is never returned. */
    hasApiKey: boolean
    baseUrl: string
    model: string
    maxSteps: number
  }
  server: {
    /** Whether a server API key (HTTP auth) is set. */
    hasApiKey: boolean
    maxBodyBytes: number
  }
  scheduler: {
    maxConcurrent: number
    maxRetries: number
    slowRunThresholdMs: number
  }
  sandbox: {
    /** Whether Deno sandbox is enabled. */
    enabled: boolean
    scriptTimeoutMs: number
    maxOutputBytes: number
  }
  runtime: {
    commandTimeoutMs: number
  }
}

/**
 * Partial update payload — all fields optional.
 * Secret fields (API keys) accept a string value; pass `null` to clear.
 * `undefined` means "don't change".
 */
export interface PatchServerConfigRequest {
  llm?: {
    apiKey?: string | null
    baseUrl?: string
    model?: string
    maxSteps?: number
  }
  server?: {
    apiKey?: string | null
    maxBodyBytes?: number
  }
  scheduler?: {
    maxConcurrent?: number
    maxRetries?: number
    slowRunThresholdMs?: number
  }
  sandbox?: {
    enabled?: boolean
    scriptTimeoutMs?: number
    maxOutputBytes?: number
  }
  runtime?: {
    commandTimeoutMs?: number
  }
  /** Optional note stored in config history (e.g. what was changed and why). */
  _note?: string
  /** Who is making the change. Defaults to 'user'. */
  _changedBy?: 'user' | 'agent' | 'api'
}

export interface GetServerConfigResponseBody {
  config: ServerConfigDto
}

export interface PatchServerConfigResponseBody {
  config: ServerConfigDto
}

/** A single entry in the config change history. */
export interface ConfigHistoryEntryDto {
  id: string
  /** Full config snapshot at the time of change (same shape as ServerConfigDto). */
  snapshot: ServerConfigDto
  changedBy: string
  note: string | null
  createdAt: number
}

export interface ListConfigHistoryResponseBody {
  history: ConfigHistoryEntryDto[]
}

export interface RestoreConfigResponseBody {
  config: ServerConfigDto
  restoredFrom: string  // history entry id
}

export function apiPathConfig(): string {
  return `${API_V1_PREFIX}/config`
}

export function apiPathConfigHistory(): string {
  return `${API_V1_PREFIX}/config/history`
}

export function apiPathConfigRestore(historyId: string): string {
  return `${API_V1_PREFIX}/config/history/${encodeURIComponent(historyId)}/restore`
}
