/**
 * E2E smoke for @theworld/client-sdk against a real local server (exec-plan 005).
 * Started by scripts/test-sdk.mjs with THEWORLD_BASE_URL set.
 */
import { createTheWorldClient } from '../packages/sdk/client/src/index.ts'
import type { StreamEvent } from '@theworld/shared-contracts'

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

const streamed: StreamEvent[] = []
await client.streamRun({ sessionId: session.id, input: { text: 'sdk stream' } }, (ev) => {
  streamed.push(ev)
})
const terminal = streamed.find((e) => e.type === 'run_completed' || e.type === 'run_failed')
if (!terminal) {
  throw new Error(`expected terminal SSE event, got ${streamed.length} events`)
}

const cancelOld = await client.cancelRun(runOnly.traceId)
if (cancelOld.cancelled !== false) {
  throw new Error(`expected cancel on finished run to report cancelled=false, got ${JSON.stringify(cancelOld)}`)
}

console.log('test:sdk passed (createSession -> getSession -> run -> streamRun terminal).')
