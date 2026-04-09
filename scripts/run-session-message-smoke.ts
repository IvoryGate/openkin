/**
 * E2E for Session/Message API (exec-plan 019). Invoked with THEWORLD_BASE_URL
 * from test-session-message-api.mjs.
 */
import { createTheWorldClient } from '../packages/sdk/client/src/index.ts'

const base = process.env.THEWORLD_BASE_URL
if (!base) {
  console.error('THEWORLD_BASE_URL is required')
  process.exit(1)
}

const client = createTheWorldClient({ baseUrl: base })

const a = await client.createSession({ kind: 'chat' })
const b = await client.createSession({ kind: 'chat' })

await client.streamRun({ sessionId: a.id, input: { text: 'hello session api' } }, () => {})

const list = await client.listSessions()
if (list.total < 2 || list.sessions.length < 2) {
  throw new Error(`expected 2 sessions in list, got total=${list.total} len=${list.sessions.length}`)
}

const msgs = await client.getMessages(a.id)
const roles = new Set(msgs.messages.map((m) => m.role))
if (!roles.has('user') || !roles.has('assistant')) {
  throw new Error(`expected user and assistant messages, got: ${[...roles].join(', ')}`)
}

await client.deleteSession(b.id)
let threw = false
try {
  await client.getSession(b.id)
} catch {
  threw = true
}
if (!threw) {
  throw new Error('expected getSession to fail after delete')
}

console.log('test:session-message passed (list, messages, delete).')
