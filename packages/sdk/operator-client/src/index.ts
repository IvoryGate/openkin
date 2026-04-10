import {
  type ApiEnvelope,
  type CreateTaskRequest,
  type CreateTaskResponseBody,
  type ListLogsRequest,
  type ListLogsResponseBody,
  type ListSkillsApiResponseBody,
  type ListTaskRunsResponseBody,
  type ListTasksResponseBody,
  type ListToolsResponseBody,
  type ListSessionRunsRequest,
  type ListSessionRunsResponseBody,
  type SystemStatusResponseBody,
  type TaskDto,
  type TriggerTaskResponseBody,
  apiPathLogs,
  apiPathSkills,
  apiPathSystemStatus,
  apiPathTask,
  apiPathTaskDisable,
  apiPathTaskEnable,
  apiPathTaskRuns,
  apiPathTaskTrigger,
  apiPathTasks,
  apiPathTools,
  apiPathSessionRuns,
  createRunError,
} from '@theworld/shared-contracts'

export type {
  CreateTaskRequest,
  ListLogsRequest,
  ListLogsResponseBody,
  ListSessionRunsRequest,
  ListSessionRunsResponseBody,
  ListSkillsApiResponseBody,
  ListTaskRunsResponseBody,
  ListTasksResponseBody,
  ListToolsResponseBody,
  SystemStatusResponseBody,
  TaskDto,
  TriggerTaskResponseBody,
} from '@theworld/shared-contracts'

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

function throwFromEnvelope<T>(env: ApiEnvelope<T>, httpStatus: number): never {
  if (env.error) {
    throw env.error
  }
  throw createRunError('RUN_INTERNAL_ERROR', `Request failed (HTTP ${httpStatus})`, 'runtime')
}

export interface TheWorldOperatorClientOptions {
  baseUrl: string
  apiKey?: string
  fetch?: typeof fetch
}

export interface TheWorldOperatorClient {
  getSystemStatus(): Promise<SystemStatusResponseBody>
  listLogs(params?: ListLogsRequest): Promise<ListLogsResponseBody>
  listTools(): Promise<ListToolsResponseBody>
  listSkills(): Promise<ListSkillsApiResponseBody>
  listTasks(): Promise<ListTasksResponseBody>
  getTask(taskId: string): Promise<TaskDto>
  createTask(request: CreateTaskRequest): Promise<TaskDto>
  triggerTask(taskId: string): Promise<TriggerTaskResponseBody>
  enableTask(taskId: string): Promise<void>
  disableTask(taskId: string): Promise<void>
  listTaskRuns(taskId: string): Promise<ListTaskRunsResponseBody>
  /** List runs (traces) for a session. Operator surface — exec plan 046. */
  listSessionRuns(sessionId: string, params?: ListSessionRunsRequest): Promise<ListSessionRunsResponseBody>
}

export function createTheWorldOperatorClient(
  options: TheWorldOperatorClientOptions,
): TheWorldOperatorClient {
  const base = normalizeBaseUrl(options.baseUrl)
  const fetchFn = options.fetch ?? globalThis.fetch

  function authHeaders(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { ...extra }
    if (options.apiKey) {
      h.Authorization = `Bearer ${options.apiKey}`
    }
    return h
  }

  async function readEnvelope<T>(res: Response): Promise<ApiEnvelope<T>> {
    const text = await res.text()
    try {
      return JSON.parse(text) as ApiEnvelope<T>
    } catch {
      throw createRunError('RUN_INTERNAL_ERROR', `Invalid JSON response (HTTP ${res.status})`, 'runtime')
    }
  }

  return {
    async getSystemStatus(): Promise<SystemStatusResponseBody> {
      const res = await fetchFn(`${base}${apiPathSystemStatus()}`, { method: 'GET', headers: authHeaders() })
      const env = await readEnvelope<SystemStatusResponseBody>(res)
      if (!res.ok || !env.ok || !env.data) {
        throwFromEnvelope(env, res.status)
      }
      return env.data
    },

    async listLogs(params?: ListLogsRequest): Promise<ListLogsResponseBody> {
      const q = new URLSearchParams()
      if (params?.date) q.set('date', params.date)
      if (params?.level) q.set('level', params.level)
      if (params?.limit != null) q.set('limit', String(params.limit))
      if (params?.before != null) q.set('before', String(params.before))
      if (params?.search) q.set('search', params.search)
      const qs = q.toString()
      const path = `${apiPathLogs()}${qs ? `?${qs}` : ''}`
      const res = await fetchFn(`${base}${path}`, { method: 'GET', headers: authHeaders() })
      const env = await readEnvelope<ListLogsResponseBody>(res)
      if (!res.ok || !env.ok || env.data?.logs === undefined) {
        throwFromEnvelope(env, res.status)
      }
      return env.data
    },

    async listTools(): Promise<ListToolsResponseBody> {
      const res = await fetchFn(`${base}${apiPathTools()}`, { method: 'GET', headers: authHeaders() })
      const env = await readEnvelope<ListToolsResponseBody>(res)
      if (!res.ok || !env.ok || env.data?.tools === undefined) {
        throwFromEnvelope(env, res.status)
      }
      return env.data
    },

    async listSkills(): Promise<ListSkillsApiResponseBody> {
      const res = await fetchFn(`${base}${apiPathSkills()}`, { method: 'GET', headers: authHeaders() })
      const env = await readEnvelope<ListSkillsApiResponseBody>(res)
      if (!res.ok || !env.ok || env.data?.skills === undefined) {
        throwFromEnvelope(env, res.status)
      }
      return env.data
    },

    async listTasks(): Promise<ListTasksResponseBody> {
      const res = await fetchFn(`${base}${apiPathTasks()}`, { method: 'GET', headers: authHeaders() })
      const env = await readEnvelope<ListTasksResponseBody>(res)
      if (!res.ok || !env.ok || env.data?.tasks === undefined) {
        throwFromEnvelope(env, res.status)
      }
      return env.data
    },

    async getTask(taskId: string): Promise<TaskDto> {
      const res = await fetchFn(`${base}${apiPathTask(taskId)}`, { method: 'GET', headers: authHeaders() })
      const env = await readEnvelope<{ task: TaskDto }>(res)
      if (!res.ok || !env.ok || !env.data?.task) {
        throwFromEnvelope(env, res.status)
      }
      return env.data.task
    },

    async createTask(request: CreateTaskRequest): Promise<TaskDto> {
      const res = await fetchFn(`${base}${apiPathTasks()}`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json; charset=utf-8' }),
        body: JSON.stringify(request),
      })
      const env = await readEnvelope<CreateTaskResponseBody>(res)
      if (!res.ok || !env.ok || !env.data?.task) {
        throwFromEnvelope(env, res.status)
      }
      return env.data.task
    },

    async triggerTask(taskId: string): Promise<TriggerTaskResponseBody> {
      const res = await fetchFn(`${base}${apiPathTaskTrigger(taskId)}`, {
        method: 'POST',
        headers: authHeaders(),
      })
      const env = await readEnvelope<TriggerTaskResponseBody>(res)
      if (!res.ok || !env.ok || !env.data?.traceId) {
        throwFromEnvelope(env, res.status)
      }
      return env.data
    },

    async enableTask(taskId: string): Promise<void> {
      const res = await fetchFn(`${base}${apiPathTaskEnable(taskId)}`, {
        method: 'POST',
        headers: authHeaders(),
      })
      const env = await readEnvelope<{ id: string; enabled: boolean }>(res)
      if (!res.ok || !env.ok) {
        throwFromEnvelope(env, res.status)
      }
    },

    async disableTask(taskId: string): Promise<void> {
      const res = await fetchFn(`${base}${apiPathTaskDisable(taskId)}`, {
        method: 'POST',
        headers: authHeaders(),
      })
      const env = await readEnvelope<{ id: string; enabled: boolean }>(res)
      if (!res.ok || !env.ok) {
        throwFromEnvelope(env, res.status)
      }
    },

    async listTaskRuns(taskId: string): Promise<ListTaskRunsResponseBody> {
      const res = await fetchFn(`${base}${apiPathTaskRuns(taskId)}`, { method: 'GET', headers: authHeaders() })
      const env = await readEnvelope<ListTaskRunsResponseBody>(res)
      if (!res.ok || !env.ok || env.data?.runs === undefined) {
        throwFromEnvelope(env, res.status)
      }
      return env.data
    },

    async listSessionRuns(sessionId: string, params?: ListSessionRunsRequest): Promise<ListSessionRunsResponseBody> {
      const q = new URLSearchParams()
      if (params?.status) q.set('status', params.status)
      if (params?.limit != null) q.set('limit', String(params.limit))
      if (params?.before != null) q.set('before', String(params.before))
      const qs = q.toString()
      const path = `${apiPathSessionRuns(sessionId)}${qs ? `?${qs}` : ''}`
      const res = await fetchFn(`${base}${path}`, { method: 'GET', headers: authHeaders() })
      const env = await readEnvelope<ListSessionRunsResponseBody>(res)
      if (!res.ok || !env.ok || env.data?.runs === undefined) {
        throwFromEnvelope(env, res.status)
      }
      return env.data
    },
  }
}

