import {
  type ApiEnvelope,
  type CreateRunResponseBody,
  type CreateSessionResponseBody,
  createRunError,
  parseSseStreamEvents,
  apiPathRuns,
  apiPathRunStream,
  apiPathSessions,
} from '@theworld/shared-contracts'

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

function assistantTextFromRunPayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const p = payload as {
    output?: { content?: Array<{ type: string; text?: string }> }
    status?: string
  }
  const parts =
    p.output?.content?.filter((x) => x.type === 'text').map((x) => x.text ?? '') ?? []
  const t = parts.join('').trim()
  return t || JSON.stringify(payload)
}

export interface ChannelServiceGatewayOptions {
  baseUrl: string
  fetch?: typeof fetch
  /** Defaults to `channel` so sessions created via gateway are distinct from generic `chat` demos. */
  sessionKind?: 'chat' | 'task' | 'channel'
}

/**
 * Calls the frozen v1 REST + SSE API (`004`) only — never imports the core runtime package.
 */
export class ChannelServiceGateway {
  private readonly base: string
  private readonly fetchFn: typeof fetch
  private readonly sessionKind: ChannelServiceGatewayOptions['sessionKind']

  constructor(options: ChannelServiceGatewayOptions) {
    this.base = normalizeBaseUrl(options.baseUrl)
    this.fetchFn = options.fetch ?? globalThis.fetch
    this.sessionKind = options.sessionKind ?? 'channel'
  }

  async createSession(): Promise<string> {
    const res = await this.fetchFn(`${this.base}${apiPathSessions()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ kind: this.sessionKind }),
    })
    const env = (await res.json()) as ApiEnvelope<CreateSessionResponseBody>
    if (!res.ok || !env.ok || !env.data?.session?.id) {
      throw env.error ?? createRunError('RUN_INTERNAL_ERROR', `createSession failed (HTTP ${res.status})`, 'runtime')
    }
    return env.data.session.id
  }

  async runAndGetAssistantText(sessionId: string, userText: string): Promise<string> {
    const runRes = await this.fetchFn(`${this.base}${apiPathRuns()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ sessionId, input: { text: userText } }),
    })
    const runEnv = (await runRes.json()) as ApiEnvelope<CreateRunResponseBody>
    if (!runRes.ok || !runEnv.ok || !runEnv.data?.traceId) {
      throw runEnv.error ?? createRunError('RUN_INTERNAL_ERROR', `run failed (HTTP ${runRes.status})`, 'runtime')
    }
    const { traceId } = runEnv.data
    const streamRes = await this.fetchFn(`${this.base}${apiPathRunStream(traceId)}`, { method: 'GET' })
    if (!streamRes.ok) {
      throw createRunError('RUN_INTERNAL_ERROR', `SSE failed (HTTP ${streamRes.status})`, 'runtime')
    }
    const sseText = await streamRes.text()
    const events = parseSseStreamEvents(sseText)
    const terminal = events.find((e) => e.type === 'run_completed' || e.type === 'run_failed')
    if (!terminal) {
      throw createRunError('RUN_INTERNAL_ERROR', 'No terminal SSE event from service', 'runtime')
    }
    if (terminal.type === 'run_failed') {
      return `[failed] ${JSON.stringify(terminal.payload)}`
    }
    return assistantTextFromRunPayload(terminal.payload)
  }
}
