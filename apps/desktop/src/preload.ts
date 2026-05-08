const { contextBridge } = require('electron')

/** Aligned with `@theworld/shared-contracts` StreamEvent wire shape (SSE `data:` JSON). */
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

function parseSseStreamEvents(sseText: string): StreamEvent[] {
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
      /* skip malformed block */
    }
  }
  return out
}

type DesktopSessionItem = {
  id: string
  kind?: 'chat' | 'task' | 'channel'
  displayName?: string | null
  agentId?: string | null
  updatedAt?: number | null
  createdAt?: number | null
}

type DesktopMessageItem = {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string
  createdAt: number
}

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

type DesktopSystemStatus = {
  taskScheduler?: {
    active?: boolean
    stale?: boolean
    lastTickAt?: number
  }
  heartbeat?: {
    schedulerLastBeatAt?: number
    taskSseLastBeatAt?: number
  }
}

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

type DesktopCreateRunOptions = {
  agentId?: string
  executionMode?: 'foreground' | 'background'
  streamAttachment?: 'attached' | 'detached'
  attachments?: DesktopRunAttachment[]
}

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

/**
 * Parse SSE byte stream; each complete `data:` JSON line triggers listener (aligned with client SDK).
 */
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
    for (const block of tail.split(/\n\n+/)) {
      let dataLine: string | undefined
      for (const line of block.split('\n')) {
        if (line.startsWith('data: ')) {
          dataLine = line.slice(6)
        }
      }
      if (dataLine) {
        try {
          listener(JSON.parse(dataLine) as StreamEvent)
        } catch {
          /* skip */
        }
      }
    }
  }
}

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

async function listSessions(baseUrl: string, apiKey?: string): Promise<DesktopSessionItem[]> {
  const normalizedBase = (baseUrl || '').replace(/\/+$/, '')
  if (!normalizedBase) {
    return []
  }

  const res = await fetchWithOptionalAuthRetry(
    `${normalizedBase}/v1/sessions?limit=100`,
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
  const normalizedBase = (baseUrl || '').replace(/\/+$/, '')
  if (!normalizedBase || !sessionId) {
    return []
  }

  const res = await fetchWithOptionalAuthRetry(
    `${normalizedBase}/v1/sessions/${encodeURIComponent(sessionId)}/messages?limit=100`,
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
  const normalizedBase = (baseUrl || '').replace(/\/+$/, '')
  if (!normalizedBase || !sessionId || !content.trim()) {
    throw new Error('invalid_message_input')
  }
  const res = await fetchWithOptionalAuthRetry(
    `${normalizedBase}/v1/sessions/${encodeURIComponent(sessionId)}/messages`,
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
  const normalizedBase = (baseUrl || '').replace(/\/+$/, '')
  if (!normalizedBase) {
    throw new Error('invalid_base_url')
  }

  const res = await fetchWithOptionalAuthRetry(
    `${normalizedBase}/v1/sessions`,
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
  const normalizedBase = (baseUrl || '').replace(/\/+$/, '')
  if (!normalizedBase) return false
  try {
    const res = await fetchWithOptionalAuthRetry(
      `${normalizedBase}/v1/runs`,
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
  const normalizedBase = (baseUrl || '').replace(/\/+$/, '')
  if (!normalizedBase || !sessionId || !text.trim()) {
    throw new Error('invalid_run_input')
  }

  const res = await fetchWithOptionalAuthRetry(
    `${normalizedBase}/v1/runs`,
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
  const normalizedBase = (baseUrl || '').replace(/\/+$/, '')
  if (!normalizedBase || !traceId) {
    return
  }

  const url = `${normalizedBase}/v1/runs/${encodeURIComponent(traceId)}/stream`
  const res = await fetchGetWithOptionalAuthRetry(url, apiKey)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  const streamBody = res.body as AsyncIterable<Uint8Array> | null
  if (streamBody && typeof streamBody[Symbol.asyncIterator] === 'function') {
    await parseSseStream(streamBody as AsyncIterable<Uint8Array>, onEvent)
  } else {
    const text = await res.text()
    for (const ev of parseSseStreamEvents(text)) {
      onEvent(ev)
    }
  }
}

async function waitRunTerminal(baseUrl: string, traceId: string, apiKey?: string): Promise<void> {
  await streamRunUntilTerminal(baseUrl, traceId, apiKey, () => {})
}

async function listApprovals(baseUrl: string, apiKey?: string): Promise<DesktopApprovalRecord[]> {
  const normalizedBase = (baseUrl || '').replace(/\/+$/, '')
  if (!normalizedBase) {
    return []
  }

  const res = await fetchWithOptionalAuthRetry(`${normalizedBase}/v1/approvals`, { method: 'GET' }, apiKey)
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

async function getRunTrace(
  baseUrl: string,
  traceId: string,
  apiKey?: string,
): Promise<DesktopTraceDto | null> {
  const normalizedBase = (baseUrl || '').replace(/\/+$/, '')
  if (!normalizedBase || !traceId) {
    return null
  }

  const res = await fetchWithOptionalAuthRetry(
    `${normalizedBase}/v1/runs/${encodeURIComponent(traceId)}`,
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
  const normalizedBase = (baseUrl || '').replace(/\/+$/, '')
  if (!normalizedBase || !traceId) {
    return { cancelled: false }
  }

  const res = await fetchWithOptionalAuthRetry(
    `${normalizedBase}/v1/runs/${encodeURIComponent(traceId)}/cancel`,
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
  const normalizedBase = (baseUrl || '').replace(/\/+$/, '')
  if (!normalizedBase) {
    return []
  }

  const res = await fetchWithOptionalAuthRetry(
    `${normalizedBase}/v1/agents`,
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
  const normalizedBase = (baseUrl || '').replace(/\/+$/, '')
  if (!normalizedBase || !payload?.name?.trim() || !payload?.systemPrompt?.trim()) {
    throw new Error('invalid_agent_input')
  }
  const res = await fetchWithOptionalAuthRetry(
    `${normalizedBase}/v1/agents`,
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
  const normalizedBase = (baseUrl || '').replace(/\/+$/, '')
  if (!normalizedBase || !agentId?.trim()) {
    throw new Error('invalid_agent_update_input')
  }
  const body: Record<string, string> = {}
  if (payload.name !== undefined) body.name = payload.name.trim()
  if (payload.description !== undefined) body.description = payload.description.trim()
  if (payload.systemPrompt !== undefined) body.systemPrompt = payload.systemPrompt.trim()
  if (payload.model !== undefined) body.model = payload.model.trim()
  const res = await fetchWithOptionalAuthRetry(
    `${normalizedBase}/v1/agents/${encodeURIComponent(agentId)}`,
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
  const normalizedBase = (baseUrl || '').replace(/\/+$/, '')
  if (!normalizedBase || !agentId?.trim()) {
    throw new Error('invalid_agent_delete_input')
  }
  const res = await fetchWithOptionalAuthRetry(
    `${normalizedBase}/v1/agents/${encodeURIComponent(agentId)}`,
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
  const normalizedBase = (baseUrl || '').replace(/\/+$/, '')
  if (!normalizedBase) {
    return {}
  }
  const res = await fetchWithOptionalAuthRetry(
    `${normalizedBase}/v1/system/status`,
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
    getRunTrace,
    cancelRun,
  },
  agent: {
    listAgents,
    createAgent,
    updateAgent,
    deleteAgent,
  },
  system: {
    getSystemStatus,
  },
}

contextBridge.exposeInMainWorld('theworldDesktop', desktopBridge)
// Backward compatibility for older renderer code paths.
contextBridge.exposeInMainWorld('openkinDesktop', desktopBridge)
