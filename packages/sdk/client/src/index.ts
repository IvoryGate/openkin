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
  }
}
