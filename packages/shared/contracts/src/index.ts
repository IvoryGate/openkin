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
}

export type SessionKindDto = SessionDto['kind']

export interface ListSessionsRequest {
  limit?: number
  offset?: number
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
}

export interface TaskRunDto {
  id: string
  taskId: string
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
}

export interface UpdateTaskRequest {
  name?: string
  triggerType?: TaskTriggerTypeDto
  triggerConfig?: Record<string, unknown>
  agentId?: string
  input?: RunInputDto
  enabled?: boolean
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
