export type MessageRole = 'system' | 'user' | 'assistant' | 'tool'

export interface TextPart {
  type: 'text'
  text: string
}

export interface JsonPart {
  type: 'json'
  value: unknown
}

/**
 * 095: user multimodal (OpenAI-style `image_url` after mapping in provider; not a transport upload API).
 * `url` may be `https:`, `http:`, or `data:`.
 */
export interface ImagePart {
  type: 'image'
  url: string
  mimeType?: string
  detail?: 'auto' | 'low' | 'high'
}

/**
 * 095: opaque file reference (future upload id, workspace path token, or URL) — L4+ resolves; L3 only carries metadata.
 * Delivered to text-only API surfaces as a single `[Attached file: …]` line in the provider.
 */
export interface FileRefPart {
  type: 'file_ref'
  ref: string
  name?: string
  mimeType?: string
  sizeBytes?: number
}

export type MessagePart = TextPart | JsonPart | ImagePart | FileRefPart

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

/**
 * Third-layer **run id** (UUID-shaped string). Today this is the same as `traceId` on all HTTP run routes
 * (`POST /v1/runs`, `GET /v1/runs/:traceId`, stream, cancel). Keep one vocabulary for 091+ event subjects.
 */
export type RunId = string

/**
 * **Declared** execution posture for a run. Does not change the core run engine; it is a substrate hint for
 * clients and operators (L4+). `background` still runs the same pipeline; the client may skip holding SSE.
 */
export type RunExecutionMode = 'foreground' | 'background'

/**
 * **Declared** client relationship to the run stream. `detached` means the client is not expected to open
 * `GET /v1/runs/:traceId/stream` (e.g. fire-and-forget); the server still may emit events for other subscribers.
 */
export type RunStreamAttachment = 'attached' | 'detached'

export const DEFAULT_RUN_EXECUTION_MODE: RunExecutionMode = 'foreground'
export const DEFAULT_RUN_STREAM_ATTACHMENT: RunStreamAttachment = 'attached'

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

/** Request cancellation of an in-flight run (052). */
export function apiPathRunCancel(traceId: string): string {
  return `${API_V1_PREFIX}/runs/${encodeURIComponent(traceId)}/cancel`
}

/** 094: prompt assembly / compact / memory contribution snapshot (in-process, best-effort). */
export function apiPathRunContext(traceId: string): string {
  return `${API_V1_PREFIX}/runs/${encodeURIComponent(traceId)}/context`
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
  /** Declared at run creation; defaults apply when metadata is missing (090). */
  executionMode: RunExecutionMode
  /** Declared at run creation; defaults apply when metadata is missing (090). */
  streamAttachment: RunStreamAttachment
}

export interface TraceSummaryDto {
  traceId: string
  sessionId: string
  agentId: string
  status: RunFinalStatus
  stepCount: number
  durationMs: number | null
  createdAt: number
  executionMode: RunExecutionMode
  streamAttachment: RunStreamAttachment
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
  /** Server-persisted display label (PATCH), optional. */
  displayName?: string
}

export type SessionKindDto = SessionDto['kind']

export interface ListSessionsRequest {
  limit?: number
  offset?: number
  /** Filter by session kind. If omitted, returns all kinds. */
  kind?: 'chat' | 'task' | 'channel' | ''
  /** Filter by persisted `sessions.agent_id`. */
  agentId?: string
  /** Only sessions with `created_at` strictly less than this (epoch ms). */
  before?: number
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

export function apiPathSessionRuns(sessionId: string): string {
  return `${API_V1_PREFIX}/sessions/${encodeURIComponent(sessionId)}/runs`
}

export interface ListSessionRunsRequest {
  status?: 'running' | 'completed' | 'failed'
  limit?: number
  before?: number
}

export interface ListSessionRunsResponseBody {
  runs: TraceSummaryDto[]
  hasMore: boolean
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
 * - **Webhooks** POST this JSON body as-is.
 * - **SSE** `GET /v1/tasks/events` wraps it in `EventPlaneEnvelopeV1` (091) — `data` JSON is the envelope, `payload` is this DTO.
 */
export interface TaskRunEventDto {
  type: 'task_run_finished'
  taskId: string
  taskName: string
  runId: string
  sessionId: string
  traceId: string
  status: 'completed' | 'failed'
  /** 092: `schedule` = tick, `trigger` = manual POST, `retry` = after failure resched. */
  runSource: TaskRunSourceDto
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

// ── L3 Approval & danger (093): operator / product substrate ─────────────────

/** 093: risk categories for user-visible warnings and policy (not a full engine). */
export type RiskClassDto = 'shell_command' | 'file_mutation' | 'network' | 'destructive'

/** 093: lifecycle of a single approval request (independent of `RunFinalStatus`). */
export type ApprovalStatusDto = 'pending' | 'approved' | 'denied' | 'expired' | 'cancelled'

export interface ApprovalRecordDto {
  id: string
  traceId: string
  sessionId: string
  runId: string
  riskClass: RiskClassDto
  toolName?: string
  /** Short human label for the proposed action. */
  summary: string
  status: ApprovalStatusDto
  requestedAt: number
  /** When this request is no longer valid; `null` = no auto-expiry. */
  expiresAt: number | null
  resolvedAt: number | null
  reason?: string
}

/**
 * 093: SSE + subscribers share this shape. `type` is the plane `kind` for `domain: approval`.
 * On `approval_resolved`, `resolution` is the terminal outcome (incl. timeout → `expired`).
 */
export interface ApprovalEventDto {
  type: 'approval_requested' | 'approval_resolved'
  approval: ApprovalRecordDto
  /** Present when `type === 'approval_resolved'`. */
  resolution?: 'approved' | 'denied' | 'expired' | 'cancelled'
  ts: number
}

export interface CreateApprovalRequestBody {
  traceId: string
  sessionId: string
  runId: string
  riskClass: RiskClassDto
  toolName?: string
  summary: string
  /**
   * Time-to-live in ms from `requestedAt`. Omitted → 300_000 (5m).
   * Set `0` for no auto-expiry (`expiresAt: null`) — L4+ must close via approve/deny/cancel.
   */
  ttlMs?: number | null
}

export interface ResolveApprovalRequestBody {
  reason?: string
}

export interface CreateApprovalResponseBody {
  approval: ApprovalRecordDto
}

export interface GetApprovalResponseBody {
  approval: ApprovalRecordDto
}

export interface ListApprovalsResponseBody {
  /** Process-local, newest first (server-defined sort). */
  approvals: ApprovalRecordDto[]
}

export function apiPathApprovals(): string {
  return `${API_V1_PREFIX}/approvals`
}

export function apiPathApprovalEvents(): string {
  return `${API_V1_PREFIX}/approvals/events`
}

export function apiPathApproval(approvalId: string): string {
  return `${API_V1_PREFIX}/approvals/${encodeURIComponent(approvalId)}`
}

export function apiPathApprovalApprove(approvalId: string): string {
  return `${API_V1_PREFIX}/approvals/${encodeURIComponent(approvalId)}/approve`
}

export function apiPathApprovalDeny(approvalId: string): string {
  return `${API_V1_PREFIX}/approvals/${encodeURIComponent(approvalId)}/deny`
}

export function apiPathApprovalCancel(approvalId: string): string {
  return `${API_V1_PREFIX}/approvals/${encodeURIComponent(approvalId)}/cancel`
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

export interface PatchSessionRequest {
  displayName: string
}

export interface CreateSessionMessageRequest {
  role: MessageDto['role']
  content: string
}

export interface CreateSessionMessageResponseBody {
  message: MessageDto
}

/** 095: multipart run input — service maps to `Message` with `ImagePart` / `FileRefPart` (see L3 multimodal doc). */
export type RunAttachmentInputDto =
  | {
      kind: 'image'
      url: string
      mimeType?: string
      detail?: 'auto' | 'low' | 'high'
    }
  | {
      kind: 'file'
      ref: string
      name?: string
      mimeType?: string
      sizeBytes?: number
    }

export interface RunInputDto {
  /** Plain user text; combined with `attachments` into one user `Message`. */
  text: string
  /** When set, appended as `ImagePart` / `FileRefPart` after the text part. */
  attachments?: RunAttachmentInputDto[]
}

export interface CreateRunRequest {
  sessionId: string
  input: RunInputDto
  /** When set, uses this persisted Agent for the run (see Agent API). Omit to use the server default definition. */
  agentId?: string
  /** See `RunExecutionMode` (090). */
  executionMode?: RunExecutionMode
  /** See `RunStreamAttachment` (090). */
  streamAttachment?: RunStreamAttachment
  /**
   * 094: optional context budget for this run (maps to `RunState.maxPromptTokens`).
   * When set, `TrimCompressionPolicy` may drop compressible `history` blocks from the prompt.
   */
  maxPromptTokens?: number
}

export interface CreateRunResponseBody {
  traceId: string
  sessionId: string
  executionMode: RunExecutionMode
  streamAttachment: RunStreamAttachment
}

// ── L3 Context / memory descriptors (094) ───────────────────────────────────

/** Mirrors `ContextLayer` in core; L4+ uses this for explainable context UI. */
export type ContextBlockLayerDto = 'system' | 'memory' | 'history' | 'recent' | 'tool_result'

export type ContextBlockProtectionDto = 'immutable' | 'pinned' | 'compressible'

/** Reserved provenance for MemoryPort / future layered memory — not a full policy engine (094). */
export type MemorySourceKindDto =
  | 'system'
  | 'workspace'
  | 'session'
  | 'persona'
  | 'skill'
  | 'retrieval'
  | 'other'

export interface ContextBlockDescriptorDto {
  id: string
  layer: ContextBlockLayerDto
  protection: ContextBlockProtectionDto
  messageCount: number
  /** ~char/4 heuristic (same as core `estimateMessageTokens`). */
  estimatedTokens: number
  includedInPrompt: boolean
}

export interface ContextCompactDescriptorDto {
  maxPromptTokens?: number
  estimatedTokensBeforeFit: number
  estimatedTokensAfterFit: number
  droppedBlockIds: string[]
  droppedTokenEstimate: number
}

export interface MemoryContributionDescriptorDto {
  sourceKind: MemorySourceKindDto
  messageCount: number
  estimatedTokens: number
  /** e.g. `MemoryPort` until specialized providers label themselves. */
  label?: string
}

export interface ContextBuildReportDto {
  traceId: string
  sessionId: string
  stepIndex: number
  maxPromptTokens?: number
  blocks: ContextBlockDescriptorDto[]
  compact: ContextCompactDescriptorDto
  memoryContributions: MemoryContributionDescriptorDto[]
  assembledMessageCount: number
  assembledEstimatedTokens: number
}

export interface GetRunContextResponseBody {
  /** One slice per `onPromptAssembled` (each LLM step). */
  steps: ContextBuildReportDto[]
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

/** 092: how a task run was started (for events / webhooks; not always persisted on TaskRun row). */
export type TaskRunSourceDto = 'schedule' | 'trigger' | 'retry'

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
  /** 092: in-process scheduler liveness; omitted in builds without a running scheduler. */
  taskScheduler?: {
    active: boolean
    tickIntervalMs: number
    lastTickAt: number
    lastDueCount: number
    runningExecutions: number
    maxConcurrent: number
    /** True if `active` and no tick for ~3× `tickIntervalMs` (stalled loop). */
    stale: boolean
  }
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

// ── L3 Event plane (091): unified envelope + taxonomy (SSE data lines may use this shape) ──

export const EVENT_PLANE_VERSION = 1 as const

/**
 * High-level event channel. New sources (093 approval, 092 heartbeat, 094 memory) extend here — do not
 * overload `StreamEvent.type` for cross-cutting concerns.
 */
export type EventPlaneDomain = 'run' | 'task' | 'log' | 'approval' | 'heartbeat' | 'memory'

/**
 * `kind` is a dot-free short name within a domain, e.g. `text_delta` (run, legacy), `task_run_finished` (task).
 * Full taxonomy: `docs/architecture-docs-for-human/backend-plan/layer3-design/L3_EVENT_PLANE.md`
 */
export type EventPlaneSubject =
  | { type: 'run'; runId: RunId; sessionId?: string }
  | {
      type: 'task'
      taskId: string
      runId: string
      traceId: string
      sessionId: string
      taskName?: string
    }
  | { type: 'log' }
  | { type: 'approval'; requestId?: string; traceId?: string; sessionId?: string }
  | { type: 'heartbeat'; name?: string }
  | { type: 'memory'; sessionId?: string }

/**
 * Versioned wrapper for all L3 “plane” events. Wire: SSE `event:` line = `domain` string;
 * `data:` line = JSON of this object (see `formatSseEventPlaneV1`).
 */
export interface EventPlaneEnvelopeV1<P = unknown> {
  v: typeof EVENT_PLANE_VERSION
  domain: EventPlaneDomain
  kind: string
  ts: number
  subject: EventPlaneSubject
  payload: P
  /**
   * Optional monotonic / ordering token for a single connection. Not a global guarantee across processes.
   * Run stream (`StreamEvent` wire) is still legacy-ordered; map with `streamEventToPlaneEnvelope` for plane view.
   */
  seq?: number
}

export function isEventPlaneEnvelopeV1(x: unknown): x is EventPlaneEnvelopeV1 {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  if (o.v !== 1) return false
  if (typeof o.domain !== 'string') return false
  if (typeof o.kind !== 'string') return false
  if (typeof o.ts !== 'number' || !Number.isFinite(o.ts)) return false
  if (!o.subject || typeof o.subject !== 'object') return false
  const s = o.subject as Record<string, unknown>
  if (typeof s.type !== 'string') return false
  if (!('payload' in o)) return false
  return true
}

/** Map a persisted/logged run stream event into the unified envelope (client-side or observability). */
export function streamEventToPlaneEnvelope(ev: StreamEvent, ts: number = Date.now()): EventPlaneEnvelopeV1<StreamEvent['payload']> {
  return {
    v: 1,
    domain: 'run',
    kind: ev.type,
    ts,
    subject: { type: 'run', runId: ev.traceId },
    payload: ev.payload,
  }
}

export function taskRunEventToPlaneEnvelope(dto: TaskRunEventDto): EventPlaneEnvelopeV1<TaskRunEventDto> {
  return {
    v: 1,
    domain: 'task',
    kind: dto.type,
    ts: dto.ts,
    subject: {
      type: 'task',
      taskId: dto.taskId,
      runId: dto.runId,
      traceId: dto.traceId,
      sessionId: dto.sessionId,
      taskName: dto.taskName,
    },
    payload: dto,
  }
}

export function approvalEventToPlaneEnvelope(dto: ApprovalEventDto): EventPlaneEnvelopeV1<ApprovalEventDto> {
  return {
    v: 1,
    domain: 'approval',
    kind: dto.type,
    ts: dto.ts,
    subject: {
      type: 'approval',
      requestId: dto.approval.id,
      traceId: dto.approval.traceId,
      sessionId: dto.approval.sessionId,
    },
    payload: dto,
  }
}

/**
 * Wrap a log row (JSON line from `serverLog` or `GET /v1/logs` entry) as a plane log event.
 */
export function logEntryToPlaneEnvelope(
  entry: LogEntryDto | Record<string, unknown>,
  tsFallback: number = Date.now(),
): EventPlaneEnvelopeV1<Record<string, unknown>> {
  const t = typeof (entry as LogEntryDto).ts === 'number' ? (entry as LogEntryDto).ts : tsFallback
  const kind =
    typeof (entry as LogEntryDto).type === 'string' && (entry as LogEntryDto).type
      ? String((entry as LogEntryDto).type)
      : 'entry'
  return {
    v: 1,
    domain: 'log',
    kind,
    ts: t,
    subject: { type: 'log' },
    payload: { ...entry } as Record<string, unknown>,
  }
}

export function formatSseEventPlaneV1(env: EventPlaneEnvelopeV1): string {
  return `event: ${env.domain}\ndata: ${JSON.stringify(env)}\n\n`
}

/**
 * Best-effort parse of SSE body segments whose `data:` JSON decodes to `EventPlaneEnvelopeV1`.
 * Ignores non-JSON / legacy `StreamEvent` lines.
 */
export function parseSseEventPlaneV1DataLines(sseText: string): EventPlaneEnvelopeV1[] {
  const out: EventPlaneEnvelopeV1[] = []
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
      const j = JSON.parse(dataLine) as unknown
      if (isEventPlaneEnvelopeV1(j)) out.push(j)
    } catch {
      // skip
    }
  }
  return out
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

/**
 * 096: Coarse tool grouping for L3/operator and L4 surfaces (not a full ontology).
 * MCP 工具默认归为 `mcp`（可在 metadata 中覆盖）。
 */
export type ToolSurfaceCategoryDto =
  | 'utility'
  | 'filesystem'
  | 'shell'
  | 'skill'
  | 'logs'
  | 'workspace'
  | 'mcp'
  | 'other'

export interface ToolEntryDto {
  name: string
  description: string
  source: 'builtin' | 'mcp' | 'skill' | 'custom'
  providerId?: string
  parameters?: Record<string, unknown>
  /** 093: 与审批/危险语义对齐时非空；仅观察面，不替代运行时策略。 */
  riskClass?: RiskClassDto
  /** 096: 稳定 `surfaceCategory`，供 `GET /v1/tools` 与上层 UI。 */
  category?: ToolSurfaceCategoryDto
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

export function apiPathLogStream(): string {
  return `${API_V1_PREFIX}/logs/stream`
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
