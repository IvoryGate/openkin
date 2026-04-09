import {
  type ApiEnvelope,
  type CreateRunRequest,
  type CreateRunResponseBody,
  type CreateSessionRequest,
  type CreateSessionResponseBody,
  type CreateTaskRequest,
  type GetSessionResponseBody,
  type HealthResponseBody,
  type ListMessagesRequest,
  type ListMessagesResponseBody,
  type ListTaskRunsResponseBody,
  type ListTasksResponseBody,
  type MessageDto,
  type ListSessionsRequest,
  type ListSessionsResponseBody,
  type RunError,
  type SessionDto,
  type StreamEvent,
  type TaskDto,
  type TaskRunDto,
  type TriggerTaskResponseBody,
  type UpdateTaskRequest,
  parseSseStreamEvents,
  apiPathHealth,
  apiPathRunStream,
  apiPathRuns,
  apiPathSession,
  apiPathSessionMessages,
  apiPathSessions,
  apiPathTask,
  apiPathTaskDisable,
  apiPathTaskEnable,
  apiPathTaskRunDetail,
  apiPathTaskRuns,
  apiPathTaskTrigger,
  apiPathTasks,
  createRunError,
} from '@theworld/shared-contracts'

export type {
  CreateRunRequest,
  CreateSessionRequest,
  CreateTaskRequest,
  HealthResponseBody,
  ListMessagesRequest,
  ListMessagesResponseBody,
  ListSessionsRequest,
  ListSessionsResponseBody,
  ListTaskRunsResponseBody,
  ListTasksResponseBody,
  MessageDto,
  SessionDto,
  StreamEvent,
  TaskDto,
  TaskRunDto,
  UpdateTaskRequest,
} from '@theworld/shared-contracts'
export { parseSseStreamEvents } from '@theworld/shared-contracts'
export type { RunError as ClientSdkError }

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

/**
 * Parse an SSE ReadableStream chunk-by-chunk, calling `listener` for each
 * complete `StreamEvent` as soon as it arrives — no buffering of the whole body.
 */
async function parseSseStream(
  body: AsyncIterable<Uint8Array>,
  listener: (event: StreamEvent) => void,
): Promise<void> {
  const decoder = new TextDecoder()
  let carry = ''          // incomplete line fragment from previous chunk

  for await (const chunk of body) {
    const text = carry + decoder.decode(chunk, { stream: true })
    const lines = text.split('\n')
    // The last element may be an incomplete line — save it for next iteration
    carry = lines.pop() ?? ''

    let dataLine: string | undefined

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        dataLine = line.slice(6)
      } else if (line === '') {
        // Blank line = end of SSE block; dispatch if we have a data line
        if (dataLine !== undefined) {
          try {
            const event = JSON.parse(dataLine) as StreamEvent
            listener(event)
          } catch {
            // Malformed JSON — skip
          }
          dataLine = undefined
        }
      }
      // Lines starting with 'event:' or ':' (comments) are intentionally ignored
    }
  }

  // Flush decoder and handle any trailing data
  const tail = carry + decoder.decode()
  if (tail.trim()) {
    for (const block of tail.split(/\n\n+/)) {
      let dataLine: string | undefined
      for (const line of block.split('\n')) {
        if (line.startsWith('data: ')) dataLine = line.slice(6)
      }
      if (dataLine) {
        try {
          listener(JSON.parse(dataLine) as StreamEvent)
        } catch { /* skip */ }
      }
    }
  }
}

function throwFromEnvelope<T>(env: ApiEnvelope<T>, httpStatus: number): never {
  if (env.error) {
    throw env.error
  }
  throw createRunError('RUN_INTERNAL_ERROR', `Request failed (HTTP ${httpStatus})`, 'runtime')
}

export interface TheWorldClientOptions {
  baseUrl: string
  /** When set, sends `Authorization: Bearer <apiKey>` on every request. */
  apiKey?: string
  fetch?: typeof fetch
}

export interface TheWorldClient {
  createSession(request?: CreateSessionRequest): Promise<SessionDto>
  getSession(sessionId: string): Promise<SessionDto>
  listSessions(params?: ListSessionsRequest): Promise<ListSessionsResponseBody>
  deleteSession(sessionId: string): Promise<void>
  getMessages(sessionId: string, params?: ListMessagesRequest): Promise<ListMessagesResponseBody>
  run(request: CreateRunRequest): Promise<CreateRunResponseBody>
  /** POST run, then GET SSE stream; invokes `listener` for each parsed `StreamEvent` in order. */
  streamRun(request: CreateRunRequest, listener: (event: StreamEvent) => void): Promise<void>
  /** `GET /health` — does not require `apiKey` when the server has no key configured. */
  getHealth(): Promise<HealthResponseBody>
  listTasks(): Promise<ListTasksResponseBody>
  createTask(request: CreateTaskRequest): Promise<TaskDto>
  getTask(taskId: string): Promise<TaskDto>
  updateTask(taskId: string, request: UpdateTaskRequest): Promise<TaskDto>
  deleteTask(taskId: string): Promise<void>
  enableTask(taskId: string): Promise<void>
  disableTask(taskId: string): Promise<void>
  triggerTask(taskId: string): Promise<TriggerTaskResponseBody>
  listTaskRuns(taskId: string): Promise<ListTaskRunsResponseBody>
  getTaskRun(taskId: string, runId: string): Promise<TaskRunDto>
}

/** @deprecated Use `TheWorldClientOptions`. */
export type OpenKinClientOptions = TheWorldClientOptions

/** @deprecated Use `TheWorldClient`. */
export type OpenKinClient = TheWorldClient

export function createTheWorldClient(options: TheWorldClientOptions): TheWorldClient {
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
    async createSession(request?: CreateSessionRequest): Promise<SessionDto> {
      const res = await fetchFn(`${base}${apiPathSessions()}`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json; charset=utf-8' }),
        body: JSON.stringify(request ?? {}),
      })
      const env = await readEnvelope<CreateSessionResponseBody>(res)
      if (!env.ok || !env.data?.session) {
        throwFromEnvelope(env, res.status)
      }
      return env.data.session
    },

    async getSession(sessionId: string): Promise<SessionDto> {
      const res = await fetchFn(`${base}${apiPathSession(sessionId)}`, { method: 'GET', headers: authHeaders() })
      const env = await readEnvelope<GetSessionResponseBody>(res)
      if (!env.ok || !env.data?.session) {
        throwFromEnvelope(env, res.status)
      }
      return env.data.session
    },

    async listSessions(params?: ListSessionsRequest): Promise<ListSessionsResponseBody> {
      const q = new URLSearchParams()
      if (params?.limit != null) q.set('limit', String(params.limit))
      if (params?.offset != null) q.set('offset', String(params.offset))
      const qs = q.toString()
      const path = `${apiPathSessions()}${qs ? `?${qs}` : ''}`
      const res = await fetchFn(`${base}${path}`, { method: 'GET', headers: authHeaders() })
      const env = await readEnvelope<ListSessionsResponseBody>(res)
      if (!env.ok || !env.data) {
        throwFromEnvelope(env, res.status)
      }
      return env.data
    },

    async deleteSession(sessionId: string): Promise<void> {
      const res = await fetchFn(`${base}${apiPathSession(sessionId)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (res.status === 204) return
      const env = await readEnvelope<never>(res)
      throwFromEnvelope(env, res.status)
    },

    async getMessages(sessionId: string, params?: ListMessagesRequest): Promise<ListMessagesResponseBody> {
      const q = new URLSearchParams()
      if (params?.limit != null) q.set('limit', String(params.limit))
      if (params?.before != null) q.set('before', String(params.before))
      const qs = q.toString()
      const path = `${apiPathSessionMessages(sessionId)}${qs ? `?${qs}` : ''}`
      const res = await fetchFn(`${base}${path}`, { method: 'GET', headers: authHeaders() })
      const env = await readEnvelope<ListMessagesResponseBody>(res)
      if (!env.ok || !env.data) {
        throwFromEnvelope(env, res.status)
      }
      return env.data
    },

    async run(request: CreateRunRequest): Promise<CreateRunResponseBody> {
      const res = await fetchFn(`${base}${apiPathRuns()}`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json; charset=utf-8' }),
        body: JSON.stringify(request),
      })
      const env = await readEnvelope<CreateRunResponseBody>(res)
      if (!env.ok || !env.data?.traceId) {
        throwFromEnvelope(env, res.status)
      }
      return env.data
    },

    async streamRun(request: CreateRunRequest, listener: (event: StreamEvent) => void): Promise<void> {
      const { traceId } = await this.run(request)
      const streamRes = await fetchFn(`${base}${apiPathRunStream(traceId)}`, {
        method: 'GET',
        headers: authHeaders(),
      })
      if (!streamRes.ok) {
        const hint = await streamRes.text()
        throw createRunError(
          'RUN_INTERNAL_ERROR',
          `SSE request failed (HTTP ${streamRes.status}): ${hint.slice(0, 300)}`,
          'runtime',
        )
      }

      // True streaming: parse SSE line-by-line as bytes arrive.
      // Falls back to buffered mode if ReadableStream is unavailable.
      if (streamRes.body && typeof streamRes.body[Symbol.asyncIterator] === 'function') {
        await parseSseStream(streamRes.body as AsyncIterable<Uint8Array>, listener)
      } else {
        // Fallback: buffer everything then dispatch (old behaviour)
        const text = await streamRes.text()
        for (const event of parseSseStreamEvents(text)) {
          listener(event)
        }
      }
    },

    async getHealth(): Promise<HealthResponseBody> {
      const res = await fetchFn(`${base}${apiPathHealth()}`, { method: 'GET' })
      if (!res.ok) {
        const hint = await res.text()
        throw createRunError(
          'RUN_INTERNAL_ERROR',
          `Health request failed (HTTP ${res.status}): ${hint.slice(0, 300)}`,
          'runtime',
        )
      }
      return (await res.json()) as HealthResponseBody
    },

    async listTasks(): Promise<ListTasksResponseBody> {
      const res = await fetchFn(`${base}${apiPathTasks()}`, { method: 'GET', headers: authHeaders() })
      const env = await readEnvelope<ListTasksResponseBody>(res)
      if (!res.ok || !env.ok || env.data?.tasks === undefined) {
        throwFromEnvelope(env, res.status)
      }
      return env.data
    },

    async createTask(request: CreateTaskRequest): Promise<TaskDto> {
      const res = await fetchFn(`${base}${apiPathTasks()}`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json; charset=utf-8' }),
        body: JSON.stringify(request),
      })
      const env = await readEnvelope<{ task: TaskDto }>(res)
      if (!res.ok || !env.ok || !env.data?.task) {
        throwFromEnvelope(env, res.status)
      }
      return env.data.task
    },

    async getTask(taskId: string): Promise<TaskDto> {
      const res = await fetchFn(`${base}${apiPathTask(taskId)}`, { method: 'GET', headers: authHeaders() })
      const env = await readEnvelope<{ task: TaskDto }>(res)
      if (!res.ok || !env.ok || !env.data?.task) {
        throwFromEnvelope(env, res.status)
      }
      return env.data.task
    },

    async updateTask(taskId: string, request: UpdateTaskRequest): Promise<TaskDto> {
      const res = await fetchFn(`${base}${apiPathTask(taskId)}`, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json; charset=utf-8' }),
        body: JSON.stringify(request),
      })
      const env = await readEnvelope<{ task: TaskDto }>(res)
      if (!res.ok || !env.ok || !env.data?.task) {
        throwFromEnvelope(env, res.status)
      }
      return env.data.task
    },

    async deleteTask(taskId: string): Promise<void> {
      const res = await fetchFn(`${base}${apiPathTask(taskId)}`, { method: 'DELETE', headers: authHeaders() })
      if (res.status === 204) return
      const env = await readEnvelope<never>(res)
      throwFromEnvelope(env, res.status)
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

    async listTaskRuns(taskId: string): Promise<ListTaskRunsResponseBody> {
      const res = await fetchFn(`${base}${apiPathTaskRuns(taskId)}`, { method: 'GET', headers: authHeaders() })
      const env = await readEnvelope<ListTaskRunsResponseBody>(res)
      if (!res.ok || !env.ok || env.data?.runs === undefined) {
        throwFromEnvelope(env, res.status)
      }
      return env.data
    },

    async getTaskRun(taskId: string, runId: string): Promise<TaskRunDto> {
      const res = await fetchFn(`${base}${apiPathTaskRunDetail(taskId, runId)}`, {
        method: 'GET',
        headers: authHeaders(),
      })
      const env = await readEnvelope<{ run: TaskRunDto }>(res)
      if (!res.ok || !env.ok || !env.data?.run) {
        throwFromEnvelope(env, res.status)
      }
      return env.data.run
    },
  }
}

/** @deprecated Use `createTheWorldClient`. */
export const createOpenKinClient: (options: OpenKinClientOptions) => OpenKinClient = createTheWorldClient
