/**
 * E2E smoke for @theworld/client-sdk against a real local server (exec-plan 005).
 * Started by scripts/test-sdk.mjs with THEWORLD_BASE_URL set.
 */
import { createTheWorldClient } from '../packages/sdk/client/src/index.ts'
import { apiPathRunStream, parseSseStreamEvents } from '../packages/shared/contracts/src/index.ts'
import type { StreamEvent } from '@theworld/shared-contracts'

const SSE_READ_MS =
  Number(process.env.THEWORLD_TEST_SSE_TIMEOUT_MS) > 0
    ? Number(process.env.THEWORLD_TEST_SSE_TIMEOUT_MS)
    : 120_000

const base = process.env.THEWORLD_BASE_URL
if (!base) {
  console.error('THEWORLD_BASE_URL is required')
  process.exit(1)
}

const client = createTheWorldClient({ baseUrl: base })

const session = await client.createSession({ kind: 'chat' })
const fetched = await client.getSession(session.id)
if (fetched.id !== session.id) {
  throw new Error('getSession id mismatch')
}

const runOnly = await client.run({ sessionId: session.id, input: { text: 'sdk run only' } })
if (!runOnly.traceId) {
  throw new Error('run() missing traceId')
}
if (runOnly.executionMode !== 'foreground' || runOnly.streamAttachment !== 'attached') {
  throw new Error(`run() missing default lifecycle fields: ${JSON.stringify(runOnly)}`)
}

// `client.run` is 202 only — the first run may still be active when the second starts.
// Drain the first run to a terminal event so a later `cancelRun` is an idempotent no-op.
async function readRunSseToTerminal(traceId: string, label: string): Promise<StreamEvent[]> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), SSE_READ_MS)
  try {
    const b = base.replace(/\/+$/, '')
    const res = await fetch(`${b}${apiPathRunStream(traceId)}`, { signal: ac.signal })
    if (!res.ok) {
      const hint = await res.text()
      throw new Error(`${label}: stream GET failed: HTTP ${res.status} ${hint.slice(0, 300)}`)
    }
    const sseText = await res.text()
    return parseSseStreamEvents(sseText)
  } catch (e) {
    if (e && typeof e === 'object' && (e as { name?: string }).name === 'AbortError') {
      throw new Error(`${label}: stream read timed out after ${SSE_READ_MS}ms`)
    }
    throw e
  } finally {
    clearTimeout(t)
  }
}

const streamedRunOnly = await readRunSseToTerminal(runOnly.traceId, 'runOnly')
const termRunOnly = streamedRunOnly.find((e) => e.type === 'run_completed' || e.type === 'run_failed')
if (!termRunOnly) {
  throw new Error(`runOnly: expected terminal SSE event, got ${streamedRunOnly.length} events`)
}

const runForStream = await client.run({ sessionId: session.id, input: { text: 'sdk stream' } })
if (!runForStream.traceId) {
  throw new Error('stream run() missing traceId')
}
const streamed = await readRunSseToTerminal(runForStream.traceId, 'runForStream')
const terminal = streamed.find((e) => e.type === 'run_completed' || e.type === 'run_failed')
if (!terminal) {
  throw new Error(`expected terminal SSE event, got ${streamed.length} events`)
}

const cancelOld = await client.cancelRun(runOnly.traceId)
if (cancelOld.cancelled !== false) {
  throw new Error(`expected cancel on finished run to report cancelled=false, got ${JSON.stringify(cancelOld)}`)
}

console.log('test:sdk passed (createSession -> getSession -> run -> streamRun terminal).')
