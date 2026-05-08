const { contextBridge } = require('electron')

/**
 * Route constants imported from @theworld/shared-contracts so that the
 * preload stays aligned with the canonical server contract without
 * hard-coding paths. When the Electron sandbox is enabled these imports
 * are unavailable; the renderer-side http-desktop-bridge.js serves as the
 * browser-compatible fallback in that case.
 */
const {
  apiPathSessions,
  apiPathSession,
  apiPathSessionMessages,
  apiPathSessionRuns,
  apiPathRuns,
  apiPathRunStream,
  apiPathRun,
  apiPathRunCancel,
  apiPathRunContext,
  apiPathApprovals,
  apiPathApprovalEvents,
  apiPathApprovalApprove,
  apiPathApprovalDeny,
  apiPathAgents,
  apiPathAgent,
  apiPathAgentEnable,
  apiPathAgentDisable,
  apiPathTasks,
  apiPathTask,
  apiPathTaskEnable,
  apiPathTaskDisable,
  apiPathTaskTrigger,
  apiPathTaskRuns,
  apiPathTaskRunDetail,
  apiPathSystemStatus,
  apiPathHealth,
  apiPathTools,
  apiPathSkills,
  apiPathConfig,
  parseSseStreamEvents,
} = require('@theworld/shared-contracts')

// ── Types (aligned with @theworld/shared-contracts DTOs) ────────────────

/** @see SessionDto in @theworld/shared-contracts */
type DesktopSessionItem = {
  id: string
  kind?: 'chat' | 'task' | 'channel'
  displayName?: string | null
  agentId?: string | null
  updatedAt?: number | null
  createdAt?: number | null
}

/** @see MessageDto in @theworld/shared-contracts */
type DesktopMessageItem = {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string
  createdAt: number
}

/**
 * Extends AgentDto with UI-specific fields that the Desktop client renders.
 * @see AgentDto in @theworld/shared-contracts for the canonical server DTO.
 */
type DesktopAgentItem = {
  id: string
  name?: string | null
  displayName?: string | null
  avatarUrl?: string | null
  avatar?: string | null
  iconUrl?: string | null
  imageUrl?: string | null
  description?: string | null
  systemPrompt?: string | null
  model?: string | null
  enabled?: boolean
  isBuiltin?: boolean
}

/** @see SystemStatusDto in @theworld/shared-contracts */
type DesktopSystemStatus = {
  version?: string
  uptime?: number
  db?: 'connected' | 'unavailable' | 'not_configured'
  activeSessions?: number
  taskScheduler?: {
    active?: boolean
    stale?: boolean
    lastTickAt?: number
    tickIntervalMs?: number
    runningExecutions?: number
    maxConcurrent?: number
  }
  heartbeat?: {
    schedulerLastBeatAt?: number
    taskSseLastBeatAt?: number
  }
}

/** @see ImagePart | FileRefPart in @theworld/shared-contracts */
type DesktopRunAttachment =
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

/** @see CreateRunRequest in @theworld/shared-contracts */
type DesktopCreateRunOptions = {
  agentId?: string
  executionMode?: 'foreground' | 'background'
  streamAttachment?: 'attached' | 'detached'
  attachments?: DesktopRunAttachment[]
}

/** @see ApprovalRecordDto in @theworld/shared-contracts */
type DesktopApprovalRecord = {
  id: string
  traceId: string
  sessionId: string
  summary: string
  status: string
  toolName?: string
}

type DesktopTraceDto = {
  traceId?: string
  steps?: Array<{
    stepIndex: number
    thought?: string
    toolCalls?: Array<{ id: string; name: string; input: Record<string, unknown> }>
    toolResults?: Array<{
      toolCallId: string
      name: string
      isError: boolean
      outputSummary: string
    }>
    finalAnswer?: string
    outputText?: string
  }>
}

/** @see StreamEvent in @theworld/shared-contracts */
type StreamEventType =
  | 'message'
  | 'tool_call'
  | 'tool_result'
  | 'run_completed'
  | 'run_failed'
  | 'text_delta'

type StreamEvent = {
  type: StreamEventType
  traceId: string
  payload: unknown
}

// ── Auth helpers ─────────────────────────────────────────────────────────

function buildHeaders(apiKey?: string): Headers {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (apiKey) {
    headers.set('Authorization', `Bearer ${apiKey}`)
  }
  return headers
}

async function fetchWithOptionalAuthRetry(
  url: string,
  init: { method: string; body?: string },
  apiKey?: string,
): Promise<Response> {
  const first = await fetch(url, {
    method: init.method,
    headers: buildHeaders(apiKey),
    body: init.body,
  })
  if (first.status !== 401 || !apiKey) {
    return first
  }

  // local stale token is common during desktop iteration; retry once without auth
  return fetch(url, {
    method: init.method,
    headers: buildHeaders(undefined),
    body: init.body,
  })
}

function authHeadersOnly(apiKey?: string): Headers {
  const headers = new Headers()
  if (apiKey) {
    headers.set('Authorization', `Bearer ${apiKey}`)
  }
  return headers
}

async function fetchGetWithOptionalAuthRetry(url: string, apiKey?: string): Promise<Response> {
  const first = await fetch(url, {
    method: 'GET',
    headers: authHeadersOnly(apiKey),
  })
  if (first.status !== 401 || !apiKey) {
    return first
  }
  return fetch(url, {
    method: 'GET',
    headers: authHeadersOnly(undefined),
  })
}

// ── SSE streaming ────────────────────────────────────────────────────────

async function parseSseStream(
  body: AsyncIterable<Uint8Array>,
  listener: (event: StreamEvent) => void,
): Promise<void> {
  const decoder = new TextDecoder()
  let carry = ''

  for await (const chunk of body) {
    const text = carry + decoder.decode(chunk, { stream: true })
    const lines = text.split('\n')
    carry = lines.pop() ?? ''

    let dataLine: string | undefined

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        dataLine = line.slice(6)
      } else if (line === '') {
        if (dataLine !== undefined) {
          try {
            listener(JSON.parse(dataLine) as StreamEvent)
          } catch {
            /* malformed chunk */
          }
          dataLine = undefined
        }
      }
    }
  }

  const tail = carry + decoder.decode()
  if (tail.trim()) {
    for (const ev of parseSseStreamEvents(tail) as StreamEvent[]) {
      listener(ev)
    }
  }
}

// ── Helper ───────────────────────────────────────────────────────────────

function norm(baseUrl: string): string {
  return (baseUrl || '').replace(/\/+$/, '')
}

// ── API functions (using shared-contracts route constants) ───────────────

async function listSessions(baseUrl: string, apiKey?: string): Promise<DesktopSessionItem[]> {
  const base = norm(baseUrl)
  if (!base) {
    return []
  }

  const res = await fetchWithOptionalAuthRetry(
    `${base}${apiPathSessions()}?limit=100`,
    { method: 'GET' },
    apiKey,
  )
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  const json = (await res.json()) as {
    ok?: boolean
    data?: { sessions?: DesktopSessionItem[] }
    sessions?: DesktopSessionItem[]
  }

  const sessions = json.data?.sessions ?? json.sessions ?? []
  return Array.isArray(sessions) ? sessions : []
}

async function getSessionMessages(
  baseUrl: string,
  sessionId: string,
  apiKey?: string,
): Promise<DesktopMessageItem[]> {
  const base = norm(baseUrl)
  if (!base || !sessionId) {
    return []
  }

  const res = await fetchWithOptionalAuthRetry(
    `${base}${apiPathSessionMessages(sessionId)}?limit=100`,
    { method: 'GET' },
    apiKey,
  )
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  const json = (await res.json()) as {
    ok?: boolean
    data?: { messages?: DesktopMessageItem[] }
    messages?: DesktopMessageItem[]
  }

  const messages = json.data?.messages ?? json.messages ?? []
  return Array.isArray(messages) ? messages : []
}

async function createSessionMessage(
  baseUrl: string,
  sessionId: string,
  content: string,
  role: 'user' | 'assistant' | 'system' = 'user',
  apiKey?: string,
): Promise<DesktopMessageItem> {
  const base = norm(baseUrl)
  if (!base || !sessionId || !content.trim()) {
    throw new Error('invalid_message_input')
  }
  const res = await fetchWithOptionalAuthRetry(
    `${base}${apiPathSessionMessages(sessionId)}`,
    {
      method: 'POST',
      body: JSON.stringify({
        role,
        content,
      }),
    },
    apiKey,
  )
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  const json = (await res.json()) as {
    ok?: boolean
    data?: { message?: DesktopMessageItem }
    message?: DesktopMessageItem
  }
  const message = json.data?.message ?? json.message
  if (!message?.id) {
    throw new Error('missing_message_id')
  }
  return message
}

async function createSession(
  baseUrl: string,
  apiKey?: string,
): Promise<{ id: string; kind: 'chat' | 'task' | 'channel' }> {
  const base = norm(baseUrl)
  if (!base) {
    throw new Error('invalid_base_url')
  }

  const res = await fetchWithOptionalAuthRetry(
    `${base}${apiPathSessions()}`,
    {
      method: 'POST',
      body: JSON.stringify({
        kind: 'chat',
      }),
    },
    apiKey,
  )
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  const json = (await res.json()) as {
    ok?: boolean
    data?: { session?: { id?: string; kind?: 'chat' | 'task' | 'channel' } }
    session?: { id?: string; kind?: 'chat' | 'task' | 'channel' }
  }
  const session = json.data?.session ?? json.session
  const id = session?.id
  const kind = session?.kind ?? 'chat'
  if (!id) {
    throw new Error('missing_session_id')
  }
  return { id, kind }
}

async function probeRunSurface(baseUrl: string, apiKey?: string): Promise<boolean> {
  const base = norm(baseUrl)
  if (!base) return false
  try {
    const res = await fetchWithOptionalAuthRetry(
      `${base}${apiPathRuns()}`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
      apiKey,
    )
    return res.status !== 404
  } catch {
    return false
  }
}

async function createRun(
  baseUrl: string,
  sessionId: string,
  text: string,
  apiKey?: string,
  options?: DesktopCreateRunOptions,
): Promise<{ traceId: string }> {
  const base = norm(baseUrl)
  if (!base || !sessionId || !text.trim()) {
    throw new Error('invalid_run_input')
  }

  const res = await fetchWithOptionalAuthRetry(
    `${base}${apiPathRuns()}`,
    {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        input: {
          text,
          ...(options?.attachments && options.attachments.length > 0 ? { attachments: options.attachments } : {}),
        },
        ...(options?.agentId ? { agentId: options.agentId } : {}),
        ...(options?.executionMode ? { executionMode: options.executionMode } : {}),
        ...(options?.streamAttachment ? { streamAttachment: options.streamAttachment } : {}),
      }),
    },
    apiKey,
  )
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  const json = (await res.json()) as {
    ok?: boolean
    data?: { traceId?: string }
    traceId?: string
  }
  const traceId = json.data?.traceId ?? json.traceId
  if (!traceId) {
    throw new Error('missing_trace_id')
  }
  return { traceId }
}

async function streamRunUntilTerminal(
  baseUrl: string,
  traceId: string,
  apiKey: string | undefined,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  const base = norm(baseUrl)
  if (!base || !traceId) {
    return
  }

  const url = `${base}${apiPathRunStream(traceId)}`
  const res = await fetchGetWithOptionalAuthRetry(url, apiKey)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  const streamBody = res.body as AsyncIterable<Uint8Array> | null
  if (streamBody && typeof streamBody[Symbol.asyncIterator] === 'function') {
    await parseSseStream(streamBody as AsyncIterable<Uint8Array>, onEvent)
  } else {
    const text = await res.text()
    for (const ev of parseSseStreamEvents(text) as StreamEvent[]) {
      onEvent(ev)
    }
  }
}

async function waitRunTerminal(baseUrl: string, traceId: string, apiKey?: string): Promise<void> {
  await streamRunUntilTerminal(baseUrl, traceId, apiKey, () => {})
}

async function listApprovals(baseUrl: string, apiKey?: string): Promise<DesktopApprovalRecord[]> {
  const base = norm(baseUrl)
  if (!base) {
    return []
  }

  const res = await fetchWithOptionalAuthRetry(`${base}${apiPathApprovals()}`, { method: 'GET' }, apiKey)
  if (!res.ok) {
    return []
  }

  const json = (await res.json()) as {
    ok?: boolean
    data?: { approvals?: DesktopApprovalRecord[] }
    approvals?: DesktopApprovalRecord[]
  }
  const approvals = json.data?.approvals ?? json.approvals ?? []
  return Array.isArray(approvals) ? approvals : []
}

async function approveApproval(
  baseUrl: string,
  approvalId: string,
  apiKey?: string,
  body?: { reason?: string },
): Promise<{ ok: boolean }> {
  const base = norm(baseUrl)
  if (!base || !approvalId?.trim()) {
    return { ok: false }
  }
  const res = await fetchWithOptionalAuthRetry(
    `${base}${apiPathApprovalApprove(approvalId)}`,
    { method: 'POST', body: JSON.stringify(body ?? {}) },
    apiKey,
  )
  return { ok: res.ok }
}

async function denyApproval(
  baseUrl: string,
  approvalId: string,
  apiKey?: string,
  body?: { reason?: string },
): Promise<{ ok: boolean }> {
  const base = norm(baseUrl)
  if (!base || !approvalId?.trim()) {
    return { ok: false }
  }
  const res = await fetchWithOptionalAuthRetry(
    `${base}${apiPathApprovalDeny(approvalId)}`,
    { method: 'POST', body: JSON.stringify(body ?? {}) },
    apiKey,
  )
  return { ok: res.ok }
}

async function getRunTrace(
  baseUrl: string,
  traceId: string,
  apiKey?: string,
): Promise<DesktopTraceDto | null> {
  const base = norm(baseUrl)
  if (!base || !traceId) {
    return null
  }

  const res = await fetchWithOptionalAuthRetry(
    `${base}${apiPathRun(traceId)}`,
    { method: 'GET' },
    apiKey,
  )
  if (!res.ok) {
    return null
  }

  const json = (await res.json()) as {
    ok?: boolean
    data?: DesktopTraceDto
  }
  const dto = json.data
  return dto && typeof dto === 'object' ? dto : null
}

async function cancelRun(baseUrl: string, traceId: string, apiKey?: string): Promise<{ cancelled: boolean }> {
  const base = norm(baseUrl)
  if (!base || !traceId) {
    return { cancelled: false }
  }

  const res = await fetchWithOptionalAuthRetry(
    `${base}${apiPathRunCancel(traceId)}`,
    { method: 'POST' },
    apiKey,
  )
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  const json = (await res.json()) as {
    ok?: boolean
    data?: { cancelled?: boolean }
    cancelled?: boolean
  }
  const cancelled = json.data?.cancelled ?? json.cancelled
  return { cancelled: Boolean(cancelled) }
}

async function listAgents(baseUrl: string, apiKey?: string): Promise<DesktopAgentItem[]> {
  const base = norm(baseUrl)
  if (!base) {
    return []
  }

  const res = await fetchWithOptionalAuthRetry(
    `${base}${apiPathAgents()}`,
    { method: 'GET' },
    apiKey,
  )
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  const json = (await res.json()) as {
    ok?: boolean
    data?: { agents?: DesktopAgentItem[] }
    agents?: DesktopAgentItem[]
  }
  const agents = json.data?.agents ?? json.agents ?? []
  return Array.isArray(agents) ? agents : []
}

async function createAgent(
  baseUrl: string,
  payload: {
    id?: string
    name: string
    description?: string
    systemPrompt: string
    model?: string
  },
  apiKey?: string,
): Promise<DesktopAgentItem> {
  const base = norm(baseUrl)
  if (!base || !payload?.name?.trim() || !payload?.systemPrompt?.trim()) {
    throw new Error('invalid_agent_input')
  }
  const res = await fetchWithOptionalAuthRetry(
    `${base}${apiPathAgents()}`,
    {
      method: 'POST',
      body: JSON.stringify({
        ...(payload.id ? { id: payload.id.trim() } : {}),
        name: payload.name.trim(),
        ...(payload.description ? { description: payload.description.trim() } : {}),
        systemPrompt: payload.systemPrompt.trim(),
        ...(payload.model ? { model: payload.model.trim() } : {}),
      }),
    },
    apiKey,
  )
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  const json = (await res.json()) as {
    ok?: boolean
    data?: { agent?: DesktopAgentItem }
    agent?: DesktopAgentItem
  }
  const agent = json.data?.agent ?? json.agent
  if (!agent?.id) {
    throw new Error('missing_agent_id')
  }
  return agent
}

async function updateAgent(
  baseUrl: string,
  agentId: string,
  payload: {
    name?: string
    description?: string
    systemPrompt?: string
    model?: string
  },
  apiKey?: string,
): Promise<DesktopAgentItem> {
  const base = norm(baseUrl)
  if (!base || !agentId?.trim()) {
    throw new Error('invalid_agent_update_input')
  }
  const body: Record<string, string> = {}
  if (payload.name !== undefined) body.name = payload.name.trim()
  if (payload.description !== undefined) body.description = payload.description.trim()
  if (payload.systemPrompt !== undefined) body.systemPrompt = payload.systemPrompt.trim()
  if (payload.model !== undefined) body.model = payload.model.trim()
  const res = await fetchWithOptionalAuthRetry(
    `${base}${apiPathAgent(agentId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    },
    apiKey,
  )
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  const json = (await res.json()) as {
    ok?: boolean
    data?: { agent?: DesktopAgentItem }
    agent?: DesktopAgentItem
  }
  const agent = json.data?.agent ?? json.agent
  if (!agent?.id) {
    throw new Error('missing_agent_id')
  }
  return agent
}

async function deleteAgent(baseUrl: string, agentId: string, apiKey?: string): Promise<void> {
  const base = norm(baseUrl)
  if (!base || !agentId?.trim()) {
    throw new Error('invalid_agent_delete_input')
  }
  const res = await fetchWithOptionalAuthRetry(
    `${base}${apiPathAgent(agentId)}`,
    {
      method: 'DELETE',
    },
    apiKey,
  )
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
}

async function getSystemStatus(baseUrl: string, apiKey?: string): Promise<DesktopSystemStatus> {
  const base = norm(baseUrl)
  if (!base) {
    return {}
  }
  const res = await fetchWithOptionalAuthRetry(
    `${base}${apiPathSystemStatus()}`,
    { method: 'GET' },
    apiKey,
  )
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  const json = (await res.json()) as {
    ok?: boolean
    data?: DesktopSystemStatus
  } & DesktopSystemStatus
  return json.data ?? json
}

async function getSession(baseUrl: string, sessionId: string, apiKey?: string): Promise<{ id: string; displayName?: string | null; agentId?: string | null; kind?: string } | null> {
  const base = norm(baseUrl)
  if (!base || !sessionId) return null
  const res = await fetchGetWithOptionalAuthRetry(`${base}${apiPathSession(sessionId)}`, apiKey)
  if (!res.ok) return null
  const json = (await res.json()) as { ok?: boolean; data?: { session?: { id: string; displayName?: string | null; agentId?: string | null; kind?: string } }; session?: { id: string } }
  return json.data?.session ?? json.session ?? null
}

async function patchSession(baseUrl: string, sessionId: string, patch: { displayName?: string }, apiKey?: string): Promise<{ id: string; displayName?: string | null } | null> {
  const base = norm(baseUrl)
  if (!base || !sessionId) throw new Error('invalid_patch_session_input')
  const res = await fetchWithOptionalAuthRetry(
    `${base}${apiPathSession(sessionId)}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
    apiKey,
  )
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = (await res.json()) as { ok?: boolean; data?: { session?: { id: string; displayName?: string | null } }; session?: { id: string } }
  return json.data?.session ?? json.session ?? null
}

async function deleteSession(baseUrl: string, sessionId: string, apiKey?: string): Promise<void> {
  const base = norm(baseUrl)
  if (!base || !sessionId) throw new Error('invalid_delete_session_input')
  const res = await fetchWithOptionalAuthRetry(
    `${base}${apiPathSession(sessionId)}`,
    { method: 'DELETE' },
    apiKey,
  )
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

async function getSessionMessagesPaged(baseUrl: string, sessionId: string, apiKey?: string, before?: number): Promise<{ messages: DesktopMessageItem[]; hasMore: boolean }> {
  const base = norm(baseUrl)
  if (!base || !sessionId) return { messages: [], hasMore: false }
  let url = `${base}${apiPathSessionMessages(sessionId)}?limit=50`
  if (before) url += `&before=${before}`
  const res = await fetchGetWithOptionalAuthRetry(url, apiKey)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = (await res.json()) as { ok?: boolean; data?: { messages?: DesktopMessageItem[]; hasMore?: boolean }; messages?: DesktopMessageItem[]; hasMore?: boolean }
  const messages = json.data?.messages ?? json.messages ?? []
  return { messages: Array.isArray(messages) ? messages : [], hasMore: Boolean(json.data?.hasMore ?? json.hasMore) }
}

async function getRunContext(baseUrl: string, traceId: string, apiKey?: string): Promise<Record<string, unknown> | null> {
  const base = norm(baseUrl)
  if (!base || !traceId) return null
  const res = await fetchGetWithOptionalAuthRetry(`${base}${apiPathRunContext(traceId)}`, apiKey)
  if (!res.ok) return null
  const json = (await res.json()) as { ok?: boolean; data?: Record<string, unknown> }
  return json.data ?? null
}

async function enableAgent(baseUrl: string, agentId: string, apiKey?: string): Promise<void> {
  const base = norm(baseUrl)
  if (!base || !agentId?.trim()) throw new Error('invalid_agent_enable_input')
  const res = await fetchWithOptionalAuthRetry(
    `${base}${apiPathAgentEnable(agentId)}`,
    { method: 'POST' },
    apiKey,
  )
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

async function disableAgent(baseUrl: string, agentId: string, apiKey?: string): Promise<void> {
  const base = norm(baseUrl)
  if (!base || !agentId?.trim()) throw new Error('invalid_agent_disable_input')
  const res = await fetchWithOptionalAuthRetry(
    `${base}${apiPathAgentDisable(agentId)}`,
    { method: 'POST' },
    apiKey,
  )
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

async function listTasks(baseUrl: string, apiKey?: string): Promise<Array<{ id: string; name: string; triggerType: string; agentId: string; enabled: boolean; createdAt: number }>> {
  const base = norm(baseUrl)
  if (!base) return []
  const res = await fetchGetWithOptionalAuthRetry(`${base}${apiPathTasks()}`, apiKey)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = (await res.json()) as { ok?: boolean; data?: { tasks?: Array<{ id: string; name: string; triggerType: string; agentId: string; enabled: boolean; createdAt: number }> }; tasks?: Array<{ id: string; name: string; triggerType: string; agentId: string; enabled: boolean; createdAt: number }> }
  const tasks = json.data?.tasks ?? json.tasks ?? []
  return tasks
}

async function createTask(baseUrl: string, payload: Record<string, unknown>, apiKey?: string): Promise<{ id: string; name: string }> {
  const base = norm(baseUrl)
  if (!base) throw new Error('invalid_base_url')
  const res = await fetchWithOptionalAuthRetry(
    `${base}${apiPathTasks()}`,
    { method: 'POST', body: JSON.stringify(payload) },
    apiKey,
  )
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = (await res.json()) as { ok?: boolean; data?: { task?: { id: string; name: string } }; task?: { id: string; name: string } }
  const task = json.data?.task ?? json.task
  if (!task?.id) throw new Error('missing_task_id')
  return task
}

async function deleteTask(baseUrl: string, taskId: string, apiKey?: string): Promise<void> {
  const base = norm(baseUrl)
  if (!base || !taskId) throw new Error('invalid_delete_task_input')
  const res = await fetchWithOptionalAuthRetry(
    `${base}${apiPathTask(taskId)}`,
    { method: 'DELETE' },
    apiKey,
  )
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

async function enableTask(baseUrl: string, taskId: string, apiKey?: string): Promise<void> {
  const base = norm(baseUrl)
  if (!base || !taskId) throw new Error('invalid_enable_task_input')
  const res = await fetchWithOptionalAuthRetry(
    `${base}${apiPathTaskEnable(taskId)}`,
    { method: 'POST' },
    apiKey,
  )
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

async function disableTask(baseUrl: string, taskId: string, apiKey?: string): Promise<void> {
  const base = norm(baseUrl)
  if (!base || !taskId) throw new Error('invalid_disable_task_input')
  const res = await fetchWithOptionalAuthRetry(
    `${base}${apiPathTaskDisable(taskId)}`,
    { method: 'POST' },
    apiKey,
  )
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

async function triggerTask(baseUrl: string, taskId: string, apiKey?: string): Promise<{ runId: string; traceId: string; sessionId: string }> {
  const base = norm(baseUrl)
  if (!base || !taskId) throw new Error('invalid_trigger_task_input')
  const res = await fetchWithOptionalAuthRetry(
    `${base}${apiPathTaskTrigger(taskId)}`,
    { method: 'POST' },
    apiKey,
  )
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = (await res.json()) as { ok?: boolean; data?: { runId: string; traceId: string; sessionId: string } }
  return json.data ?? (json as Record<string, unknown>) as { runId: string; traceId: string; sessionId: string }
}

async function listTaskRuns(baseUrl: string, taskId: string, apiKey?: string): Promise<Array<{ id: string; status: string; startedAt: number; completedAt: number | null }>> {
  const base = norm(baseUrl)
  if (!base || !taskId) return []
  const res = await fetchGetWithOptionalAuthRetry(`${base}${apiPathTaskRuns(taskId)}`, apiKey)
  if (!res.ok) return []
  const json = (await res.json()) as { ok?: boolean; data?: { runs?: Array<{ id: string; status: string; startedAt: number; completedAt: number | null }> }; runs?: Array<{ id: string; status: string; startedAt: number; completedAt: number | null }> }
  const runs = json.data?.runs ?? json.runs ?? []
  return runs
}

async function getHealth(baseUrl: string, apiKey?: string): Promise<{ ok: boolean; version?: string }> {
  const base = norm(baseUrl)
  if (!base) return { ok: false }
  try {
    const res = await fetchGetWithOptionalAuthRetry(`${base}${apiPathHealth()}`, apiKey)
    if (!res.ok) return { ok: false }
    const json = (await res.json()) as { ok?: boolean; data?: { ok: boolean; version?: string }; version?: string }
    return json.data ?? { ok: Boolean(json.ok), version: json.version }
  } catch {
    return { ok: false }
  }
}

// ── Bridge exposure ──────────────────────────────────────────────────────

async function pickFile(): Promise<{ ref: string; name: string; mimeType: string }> {
  const { dialog } = require('electron') as typeof import('electron')
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    title: '选择附件',
  })
  if (result.canceled || result.filePaths.length === 0) {
    throw new Error('cancelled')
  }
  const filePath = result.filePaths[0]
  const path = require('path') as typeof import('path')
  const fs = require('fs') as typeof import('fs')
  const name = path.basename(filePath)
  const ext = path.extname(filePath).toLowerCase()
  const mimeMap: Record<string, string> = {
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.json': 'application/json',
    '.csv': 'text/csv',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  }
  const mimeType = mimeMap[ext] || 'application/octet-stream'
  const buffer = fs.readFileSync(filePath)
  const ref = `data:${mimeType};base64,${buffer.toString('base64')}`
  return { ref, name, mimeType }
}

async function pickImage(): Promise<{ url: string; mimeType: string }> {
  const { dialog } = require('electron') as typeof import('electron')
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    title: '选择图片',
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }],
  })
  if (result.canceled || result.filePaths.length === 0) {
    throw new Error('cancelled')
  }
  const filePath = result.filePaths[0]
  const fs = require('fs') as typeof import('fs')
  const path = require('path') as typeof import('path')
  const ext = path.extname(filePath).toLowerCase()
  const mimeMap: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
  }
  const mimeType = mimeMap[ext] || 'image/png'
  const buffer = fs.readFileSync(filePath)
  const url = `data:${mimeType};base64,${buffer.toString('base64')}`
  return { url, mimeType }
}

const desktopBridge = {
  platform: process.platform,
  appName: 'theworld Desktop',
  session: {
    listSessions,
    probeRunSurface,
    createSessionMessage,
    getSessionMessages,
    createSession,
    createRun,
    waitRunTerminal,
    streamRunUntilTerminal,
    listApprovals,
    approveApproval,
    denyApproval,
    getRunTrace,
    cancelRun,
    getSession,
    patchSession,
    deleteSession,
    getSessionMessagesPaged,
    getRunContext,
    pickFile,
    pickImage,
  },
  agent: {
    listAgents,
    createAgent,
    updateAgent,
    deleteAgent,
    enableAgent,
    disableAgent,
  },
  task: {
    listTasks,
    createTask,
    deleteTask,
    enableTask,
    disableTask,
    triggerTask,
    listTaskRuns,
  },
  system: {
    getSystemStatus,
    getHealth,
  },
}

contextBridge.exposeInMainWorld('theworldDesktop', desktopBridge)
// Backward compatibility for older renderer code paths.
contextBridge.exposeInMainWorld('openkinDesktop', desktopBridge)
