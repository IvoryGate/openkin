import type { AddressInfo } from 'node:net'
import {
  MockLLMProvider,
  InMemoryToolRuntime,
  createBuiltinToolProvider,
  type AgentLifecycleHook,
} from '../packages/core/src/index.ts'
import {
  apiPathRunCancel,
  apiPathRuns,
  apiPathRunStream,
  apiPathSessions,
  type CreateRunResponseBody,
  type CreateSessionResponseBody,
} from '../packages/shared/contracts/src/index.ts'
import { createTheWorldHttpServer } from '../packages/server/src/http-server.ts'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseEnvelope<T>(json: unknown): { ok: boolean; data?: T } {
  if (!json || typeof json !== 'object') {
    throw new Error(`expected JSON object envelope, got ${JSON.stringify(json)}`)
  }
  return json as { ok: boolean; data?: T }
}

function parseSseEvents(sseText: string): Array<{ type: string; payload: unknown }> {
  const events: Array<{ type: string; payload: unknown }> = []
  let currentType = 'message'
  for (const rawLine of sseText.split('\n')) {
    const line = rawLine.trimEnd()
    if (!line) continue
    if (line.startsWith('event: ')) {
      currentType = line.slice(7).trim()
      continue
    }
    if (!line.startsWith('data: ')) continue
    const body = line.slice(6)
    try {
      const parsed = JSON.parse(body) as { type?: string; payload?: unknown }
      events.push({ type: parsed.type ?? currentType, payload: parsed.payload })
    } catch {
      events.push({ type: currentType, payload: body })
    }
  }
  return events
}

const slowStartHook: AgentLifecycleHook = {
  async onRunStart() {
    await sleep(300)
  },
}

async function main() {
  const runtime = new InMemoryToolRuntime([createBuiltinToolProvider()])
  const { server } = createTheWorldHttpServer({
    definition: {
      id: 'cancel-smoke-server',
      name: 'Cancel Smoke Server',
      systemPrompt: 'You are a test assistant for run cancellation smoke tests.',
      maxSteps: 4,
    },
    llm: new MockLLMProvider(),
    toolRuntime: runtime,
    extraHooks: [slowStartHook],
  })

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const addr = server.address() as AddressInfo | null
    if (!addr?.port) {
      throw new Error('server did not expose a port')
    }
    const base = `http://127.0.0.1:${addr.port}`

    const sessionRes = await fetch(`${base}${apiPathSessions()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'chat' }),
    })
    const sessionJson = parseEnvelope<CreateSessionResponseBody>(await sessionRes.json())
    const sessionId = sessionJson.data?.session?.id
    if (!sessionRes.ok || !sessionJson.ok || !sessionId) {
      throw new Error(`create session failed: ${JSON.stringify(sessionJson)}`)
    }

    const runRes = await fetch(`${base}${apiPathRuns()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, input: { text: 'cancel this run before first step' } }),
    })
    const runJson = parseEnvelope<CreateRunResponseBody>(await runRes.json())
    const traceId = runJson.data?.traceId
    if (!runRes.ok || !runJson.ok || !traceId) {
      throw new Error(`create run failed: ${JSON.stringify(runJson)}`)
    }

    const cancelRes = await fetch(`${base}${apiPathRunCancel(traceId)}`, { method: 'POST' })
    const cancelJson = parseEnvelope<{ cancelled: boolean }>(await cancelRes.json())
    if (!cancelRes.ok || !cancelJson.ok || cancelJson.data?.cancelled !== true) {
      throw new Error(`cancel run failed: ${JSON.stringify(cancelJson)}`)
    }

    const streamRes = await fetch(`${base}${apiPathRunStream(traceId)}`)
    if (!streamRes.ok) {
      throw new Error(`stream fetch failed: HTTP ${streamRes.status}`)
    }
    const sseText = await streamRes.text()
    const events = parseSseEvents(sseText)
    const terminal = events.find((event) => event.type === 'run_failed' || event.type === 'run_completed')
    if (!terminal || terminal.type !== 'run_failed') {
      throw new Error(`expected cancelled run_failed terminal event, got ${JSON.stringify(events)}`)
    }
    const payload = (terminal.payload ?? {}) as { status?: string; error?: { code?: string } }
    if (payload.status !== 'cancelled') {
      throw new Error(`expected terminal status=cancelled, got ${JSON.stringify(payload)}`)
    }
    if (payload.error?.code !== 'RUN_CANCELLED') {
      throw new Error(`expected RUN_CANCELLED error, got ${JSON.stringify(payload)}`)
    }
    if (events.some((event) => event.type === 'text_delta' || event.type === 'tool_call')) {
      throw new Error(`expected no text/tool events after active cancel, got ${JSON.stringify(events)}`)
    }

    console.log('test:run-cancel passed (active run -> cancel -> RUN_CANCELLED terminal).')
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
