/**
 * Operator surface HTTP helper (024 + Agent / Trace / Task APIs)
 *
 * All functions read `baseUrl` and `apiKey` from localStorage on each call
 * so that changes in SettingsView take effect immediately.
 */

import type {
  AgentDto,
  CreateAgentRequest,
  UpdateAgentRequest,
  ListAgentsResponseBody,
  ListSessionsResponseBody,
  ListMessagesResponseBody,
  ListSessionTracesResponseBody,
  TraceDto,
  SystemStatusResponseBody,
  ListLogsResponseBody,
  ListLogsRequest,
  ListToolsResponseBody,
  ListSkillsApiResponseBody,
  HealthResponseBody,
  TaskDto,
  ListTasksResponseBody,
  TaskRunDto,
  ListTaskRunsResponseBody,
  ListDbTablesResponseBody,
  DbQueryResponseBody,
  ServerConfigDto,
  PatchServerConfigRequest,
  ListConfigHistoryResponseBody,
  RestoreConfigResponseBody,
} from '@openkin/shared-contracts'

function getConfig(): { baseUrl: string; headers: Record<string, string> } {
  const raw = localStorage.getItem('openkin_console_base_url') ?? ''
  // Default to empty string so Vite dev-server proxy handles routing.
  // For production or direct access, set the full URL in Settings.
  const baseUrl = raw.replace(/\/+$/, '')
  const apiKey = localStorage.getItem('openkin_console_api_key') ?? ''
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
  return { baseUrl, headers }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { baseUrl, headers } = getConfig()
  const mergedHeaders: Record<string, string> = { ...headers }
  if (init?.headers) {
    Object.assign(mergedHeaders, init.headers as Record<string, string>)
  }
  const res = await fetch(`${baseUrl}${path}`, { ...init, headers: mergedHeaders })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  const json = (await res.json()) as { ok?: boolean; data?: T; error?: unknown }
  if (json.ok === false) {
    throw new Error(typeof json.error === 'object' ? JSON.stringify(json.error) : String(json.error))
  }
  return (json.data ?? json) as T
}

// ── Health ────────────────────────────────────────────────────────────────────

export async function getHealth(): Promise<HealthResponseBody> {
  const { baseUrl } = getConfig()
  const res = await fetch(`${baseUrl}/health`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<HealthResponseBody>
}

// ── Debug / Introspection (024) ───────────────────────────────────────────────

export async function getSystemStatus(): Promise<SystemStatusResponseBody> {
  return apiFetch<SystemStatusResponseBody>('/v1/system/status')
}

export async function getLogs(params?: ListLogsRequest): Promise<ListLogsResponseBody> {
  const q = new URLSearchParams()
  if (params?.date) q.set('date', params.date)
  if (params?.level) q.set('level', params.level)
  if (params?.limit != null) q.set('limit', String(params.limit))
  if (params?.before != null) q.set('before', String(params.before))
  if (params?.search) q.set('search', params.search)
  const qs = q.toString()
  return apiFetch<ListLogsResponseBody>(`/v1/logs${qs ? `?${qs}` : ''}`)
}

export async function getTools(): Promise<ListToolsResponseBody> {
  return apiFetch<ListToolsResponseBody>('/v1/tools')
}

export async function getSkills(): Promise<ListSkillsApiResponseBody> {
  return apiFetch<ListSkillsApiResponseBody>('/v1/skills')
}

export async function getSkillContent(id: string): Promise<string> {
  const res = await apiFetch<{ id: string; content: string }>(
    `/v1/skills/${encodeURIComponent(id)}/content`,
  )
  return res.content
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function listSessions(params?: {
  limit?: number
  offset?: number
}): Promise<ListSessionsResponseBody> {
  const q = new URLSearchParams()
  if (params?.limit != null) q.set('limit', String(params.limit))
  if (params?.offset != null) q.set('offset', String(params.offset))
  const qs = q.toString()
  return apiFetch<ListSessionsResponseBody>(`/v1/sessions${qs ? `?${qs}` : ''}`)
}

export async function deleteSession(sessionId: string): Promise<void> {
  const { baseUrl, headers } = getConfig()
  const res = await fetch(`${baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    headers,
  })
  if (res.status === 204) return
  throw new Error(`HTTP ${res.status}`)
}

export async function getSessionMessages(
  sessionId: string,
  params?: { limit?: number; before?: number },
): Promise<ListMessagesResponseBody> {
  const q = new URLSearchParams()
  if (params?.limit != null) q.set('limit', String(params.limit))
  if (params?.before != null) q.set('before', String(params.before))
  const qs = q.toString()
  return apiFetch<ListMessagesResponseBody>(
    `/v1/sessions/${encodeURIComponent(sessionId)}/messages${qs ? `?${qs}` : ''}`,
  )
}

export async function getSessionTraces(sessionId: string): Promise<ListSessionTracesResponseBody> {
  return apiFetch<ListSessionTracesResponseBody>(
    `/v1/sessions/${encodeURIComponent(sessionId)}/traces`,
  )
}

// ── Traces ────────────────────────────────────────────────────────────────────

export async function getTrace(traceId: string): Promise<TraceDto> {
  return apiFetch<TraceDto>(`/v1/runs/${encodeURIComponent(traceId)}`)
}

// ── Agents ────────────────────────────────────────────────────────────────────

export async function listAgents(): Promise<ListAgentsResponseBody> {
  return apiFetch<ListAgentsResponseBody>('/v1/agents')
}

export async function createAgent(req: CreateAgentRequest): Promise<AgentDto> {
  const result = await apiFetch<{ agent: AgentDto }>('/v1/agents', {
    method: 'POST',
    body: JSON.stringify(req),
  })
  return result.agent
}

export async function updateAgent(id: string, req: UpdateAgentRequest): Promise<AgentDto> {
  const result = await apiFetch<{ agent: AgentDto }>(`/v1/agents/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(req),
  })
  return result.agent
}

export async function deleteAgent(id: string): Promise<void> {
  const { baseUrl, headers } = getConfig()
  const res = await fetch(`${baseUrl}/v1/agents/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
  })
  if (res.status === 204) return
  throw new Error(`HTTP ${res.status}`)
}

export async function enableAgent(id: string): Promise<void> {
  await apiFetch<unknown>(`/v1/agents/${encodeURIComponent(id)}/enable`, { method: 'POST' })
}

export async function disableAgent(id: string): Promise<void> {
  await apiFetch<unknown>(`/v1/agents/${encodeURIComponent(id)}/disable`, { method: 'POST' })
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export async function listTasks(): Promise<ListTasksResponseBody> {
  return apiFetch<ListTasksResponseBody>('/v1/tasks')
}

export async function getTask(taskId: string): Promise<TaskDto> {
  const result = await apiFetch<{ task: TaskDto }>(`/v1/tasks/${encodeURIComponent(taskId)}`)
  return result.task
}

export async function enableTask(taskId: string): Promise<void> {
  await apiFetch<unknown>(`/v1/tasks/${encodeURIComponent(taskId)}/enable`, { method: 'POST' })
}

export async function disableTask(taskId: string): Promise<void> {
  await apiFetch<unknown>(`/v1/tasks/${encodeURIComponent(taskId)}/disable`, { method: 'POST' })
}

export async function triggerTask(taskId: string): Promise<void> {
  await apiFetch<unknown>(`/v1/tasks/${encodeURIComponent(taskId)}/trigger`, { method: 'POST' })
}

export async function deleteTask(taskId: string): Promise<void> {
  const { baseUrl, headers } = getConfig()
  const res = await fetch(`${baseUrl}/v1/tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
    headers,
  })
  if (res.status === 204) return
  throw new Error(`HTTP ${res.status}`)
}

export async function listTaskRuns(taskId: string): Promise<ListTaskRunsResponseBody> {
  return apiFetch<ListTaskRunsResponseBody>(`/v1/tasks/${encodeURIComponent(taskId)}/runs`)
}

export async function getTaskRun(taskId: string, runId: string): Promise<TaskRunDto> {
  const result = await apiFetch<{ run: TaskRunDto }>(
    `/v1/tasks/${encodeURIComponent(taskId)}/runs/${encodeURIComponent(runId)}`,
  )
  return result.run
}

// ── DB Inspect ─────────────────────────────────────────────────────────────────

export async function getDbTables(): Promise<ListDbTablesResponseBody> {
  return apiFetch<ListDbTablesResponseBody>('/v1/db/tables')
}

// ── Server Config (027) ────────────────────────────────────────────────────────

export async function getServerConfig(): Promise<ServerConfigDto> {
  const result = await apiFetch<{ config: ServerConfigDto }>('/v1/config')
  return result.config
}

export async function patchServerConfig(patch: PatchServerConfigRequest): Promise<ServerConfigDto> {
  const result = await apiFetch<{ config: ServerConfigDto }>('/v1/config', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return result.config
}

export async function listConfigHistory(limit = 20): Promise<ListConfigHistoryResponseBody> {
  return apiFetch<ListConfigHistoryResponseBody>(`/v1/config/history?limit=${limit}`)
}

export async function restoreConfig(historyId: string): Promise<RestoreConfigResponseBody> {
  return apiFetch<RestoreConfigResponseBody>(
    `/v1/config/history/${encodeURIComponent(historyId)}/restore`,
    { method: 'POST' },
  )
}

export async function runDbQuery(sql: string, limit?: number): Promise<DbQueryResponseBody> {
  const { baseUrl, headers } = getConfig()
  const res = await fetch(`${baseUrl}/v1/db/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ sql, limit }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  const json = (await res.json()) as { ok?: boolean; data?: DbQueryResponseBody; error?: unknown }
  if (json.ok === false) {
    throw new Error(typeof json.error === 'object' ? JSON.stringify(json.error) : String(json.error))
  }
  return json.data!
}
