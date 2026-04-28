const { contextBridge } = require('electron')

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

async function waitRunTerminal(baseUrl: string, traceId: string, apiKey?: string): Promise<void> {
  const normalizedBase = (baseUrl || '').replace(/\/+$/, '')
  if (!normalizedBase || !traceId) {
    return
  }

  const res = await fetchWithOptionalAuthRetry(
    `${normalizedBase}/v1/runs/${encodeURIComponent(traceId)}/stream`,
    { method: 'GET' },
    apiKey,
  )
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  await res.text()
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
    cancelRun,
  },
  agent: {
    listAgents,
  },
  system: {
    getSystemStatus,
  },
}

contextBridge.exposeInMainWorld('theworldDesktop', desktopBridge)
// Backward compatibility for older renderer code paths.
contextBridge.exposeInMainWorld('openkinDesktop', desktopBridge)
