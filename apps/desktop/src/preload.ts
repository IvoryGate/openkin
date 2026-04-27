const { contextBridge } = require('electron')

type DesktopSessionItem = {
  id: string
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

async function createRun(
  baseUrl: string,
  sessionId: string,
  text: string,
  apiKey?: string,
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
        input: { text },
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

const desktopBridge = {
  platform: process.platform,
  appName: 'theworld Desktop',
  session: {
    listSessions,
    getSessionMessages,
    createRun,
    waitRunTerminal,
  },
  agent: {
    listAgents,
  },
}

contextBridge.exposeInMainWorld('theworldDesktop', desktopBridge)
// Backward compatibility for older renderer code paths.
contextBridge.exposeInMainWorld('openkinDesktop', desktopBridge)
