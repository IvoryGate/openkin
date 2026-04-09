/**
 * E2E smoke for @theworld/client-sdk against a real local server (exec-plan 005).
 * Started by scripts/test-sdk.mjs with THEWORLD_BASE_URL set
 * (fallback OPENKIN_BASE_URL).
 */
import { createOpenKinClient } from '../packages/sdk/client/src/index.ts'
import type { StreamEvent } from '@theworld/shared-contracts'

const base = process.env.THEWORLD_BASE_URL ?? process.env.OPENKIN_BASE_URL
if (!base) {
  console.error('THEWORLD_BASE_URL or OPENKIN_BASE_URL is required')
  process.exit(1)
}

const client = createOpenKinClient({ baseUrl: base })

const session = await client.createSession({ kind: 'chat' })
const fetched = await client.getSession(session.id)
if (fetched.id !== session.id) {
  throw new Error('getSession id mismatch')
}

const runOnly = await client.run({ sessionId: session.id, input: { text: 'sdk run only' } })
if (!runOnly.traceId) {
  throw new Error('run() missing traceId')
}

const streamed: StreamEvent[] = []
await client.streamRun({ sessionId: session.id, input: { text: 'sdk stream' } }, (ev) => {
  streamed.push(ev)
})
const terminal = streamed.find((e) => e.type === 'run_completed' || e.type === 'run_failed')
if (!terminal) {
  throw new Error(`expected terminal SSE event, got ${streamed.length} events`)
}

console.log('test:sdk passed (createSession -> getSession -> run -> streamRun terminal).')
