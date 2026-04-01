import { randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import {
  type ApiEnvelope,
  type CreateRunRequest,
  type CreateSessionRequest,
  createRunError,
  formatSseEvent,
  type StreamEvent,
  apiPathRuns,
  apiPathSessions,
} from '@openkin/shared-contracts'
import { InMemorySessionRegistry, OpenKinAgent, type AgentDefinition, type LLMProvider, type ToolRuntime } from '@openkin/core'
import { createSseStreamingHook } from './sse-hooks.js'
import { TraceStreamHub } from './trace-stream-hub.js'

function jsonResponse(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(payload) })
  res.end(payload)
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => {
      chunks.push(c as Buffer)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function envelopeError(message: string, code: string): ApiEnvelope<never> {
  return {
    ok: false,
    error: createRunError(code, message, 'runtime'),
  }
}

export interface CreateOpenKinHttpServerOptions {
  definition: AgentDefinition
  llm: LLMProvider
  toolRuntime: ToolRuntime
}

export interface OpenKinHttpServer {
  readonly server: Server
  readonly streamHub: TraceStreamHub
  readonly agent: OpenKinAgent
}

export function createOpenKinHttpServer(options: CreateOpenKinHttpServerOptions): OpenKinHttpServer {
  const streamHub = new TraceStreamHub()
  const sseHook = createSseStreamingHook(streamHub)
  const agent = new OpenKinAgent(
    options.definition,
    options.llm,
    options.toolRuntime,
    new InMemorySessionRegistry(),
    [sseHook],
  )

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const pathname = url.pathname
    const method = req.method ?? 'GET'

    try {
      if (method === 'POST' && pathname === apiPathSessions()) {
        const raw = (await readJsonBody(req)) as CreateSessionRequest
        const kind = raw.kind ?? 'chat'
        const id = randomUUID()
        agent.createSession({ id, kind })
        const body: ApiEnvelope<{ session: { id: string; kind: typeof kind } }> = {
          ok: true,
          data: { session: { id, kind } },
        }
        jsonResponse(res, 201, body)
        return
      }

      if (method === 'GET' && pathname.startsWith(`${apiPathSessions()}/`)) {
        const sessionId = decodeURIComponent(pathname.slice(apiPathSessions().length + 1))
        if (!sessionId || sessionId.includes('/')) {
          jsonResponse(res, 400, envelopeError('Invalid session id', 'INVALID_REQUEST'))
          return
        }
        const session = agent.getSession(sessionId)
        if (!session) {
          jsonResponse(res, 404, envelopeError('Session not found', 'NOT_FOUND'))
          return
        }
        jsonResponse(res, 200, { ok: true, data: { session: { id: session.id, kind: session.kind } } })
        return
      }

      if (method === 'POST' && pathname === apiPathRuns()) {
        const raw = (await readJsonBody(req)) as CreateRunRequest
        const sessionId = raw.sessionId
        const text = raw.input?.text
        if (!sessionId || typeof text !== 'string') {
          jsonResponse(res, 400, envelopeError('sessionId and input.text are required', 'INVALID_REQUEST'))
          return
        }
        if (!agent.getSession(sessionId)) {
          jsonResponse(res, 404, envelopeError('Session not found', 'NOT_FOUND'))
          return
        }
        const traceId = `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        streamHub.reserve(traceId)

        void agent.run(sessionId, text, { traceId }).catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err)
          const failed: StreamEvent = {
            type: 'run_failed',
            traceId,
            payload: { message, raw: String(err) },
          }
          streamHub.emit(traceId, failed)
        })

        jsonResponse(res, 202, {
          ok: true,
          data: { traceId, sessionId },
        })
        return
      }

      if (method === 'GET' && pathname.endsWith('/stream') && pathname.startsWith(`${apiPathRuns()}/`)) {
        const withoutRuns = pathname.slice(apiPathRuns().length + 1)
        const traceId = decodeURIComponent(withoutRuns.replace(/\/stream$/, ''))
        if (!traceId || !streamHub.isKnown(traceId)) {
          jsonResponse(res, 404, envelopeError('Run stream not found', 'NOT_FOUND'))
          return
        }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        })

        streamHub.subscribe(traceId, (event) => {
          res.write(formatSseEvent(event))
          if (event.type === 'run_completed' || event.type === 'run_failed') {
            res.end()
          }
        })
        return
      }

      jsonResponse(res, 404, envelopeError('Not found', 'NOT_FOUND'))
    } catch {
      jsonResponse(res, 400, envelopeError('Invalid JSON body', 'INVALID_REQUEST'))
    }
  })

  return { server, streamHub, agent }
}
