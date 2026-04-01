import {
  type ApiEnvelope,
  type CreateRunRequest,
  type CreateRunResponseBody,
  type CreateSessionRequest,
  type CreateSessionResponseBody,
  type GetSessionResponseBody,
  type RunError,
  type SessionDto,
  type StreamEvent,
  parseSseStreamEvents,
  apiPathRunStream,
  apiPathRuns,
  apiPathSession,
  apiPathSessions,
  createRunError,
} from '@openkin/shared-contracts'

export type { CreateRunRequest, CreateSessionRequest, SessionDto, StreamEvent } from '@openkin/shared-contracts'
export { parseSseStreamEvents } from '@openkin/shared-contracts'
export type { RunError as ClientSdkError }

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

function throwFromEnvelope<T>(env: ApiEnvelope<T>, httpStatus: number): never {
  if (env.error) {
    throw env.error
  }
  throw createRunError('RUN_INTERNAL_ERROR', `Request failed (HTTP ${httpStatus})`, 'runtime')
}

export interface OpenKinClientOptions {
  baseUrl: string
  fetch?: typeof fetch
}

export interface OpenKinClient {
  createSession(request?: CreateSessionRequest): Promise<SessionDto>
  getSession(sessionId: string): Promise<SessionDto>
  run(request: CreateRunRequest): Promise<CreateRunResponseBody>
  /** POST run, then GET SSE stream; invokes `listener` for each parsed `StreamEvent` in order. */
  streamRun(request: CreateRunRequest, listener: (event: StreamEvent) => void): Promise<void>
}

export function createOpenKinClient(options: OpenKinClientOptions): OpenKinClient {
  const base = normalizeBaseUrl(options.baseUrl)
  const fetchFn = options.fetch ?? globalThis.fetch

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
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(request ?? {}),
      })
      const env = await readEnvelope<CreateSessionResponseBody>(res)
      if (!env.ok || !env.data?.session) {
        throwFromEnvelope(env, res.status)
      }
      return env.data.session
    },

    async getSession(sessionId: string): Promise<SessionDto> {
      const res = await fetchFn(`${base}${apiPathSession(sessionId)}`, { method: 'GET' })
      const env = await readEnvelope<GetSessionResponseBody>(res)
      if (!env.ok || !env.data?.session) {
        throwFromEnvelope(env, res.status)
      }
      return env.data.session
    },

    async run(request: CreateRunRequest): Promise<CreateRunResponseBody> {
      const res = await fetchFn(`${base}${apiPathRuns()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
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
      const streamRes = await fetchFn(`${base}${apiPathRunStream(traceId)}`, { method: 'GET' })
      if (!streamRes.ok) {
        const hint = await streamRes.text()
        throw createRunError(
          'RUN_INTERNAL_ERROR',
          `SSE request failed (HTTP ${streamRes.status}): ${hint.slice(0, 300)}`,
          'runtime',
        )
      }
      const text = await streamRes.text()
      const events = parseSseStreamEvents(text)
      for (const event of events) {
        listener(event)
      }
    },
  }
}
