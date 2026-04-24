/**
 * E2E for Session/Message API (exec-plan 019). Invoked with THEWORLD_BASE_URL
 * from test-session-message-api.mjs.
 */
import { apiPathSessions } from '../packages/shared/contracts/src/index.ts'
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

const rowA = list.sessions.find((s) => s.id === a.id)
if (!rowA?.agentId) {
  throw new Error('expected listSessions row to include agentId')
}
const byAgent = await client.listSessions({ agentId: rowA.agentId, kind: 'chat', limit: 50 })
if (!byAgent.sessions.some((s) => s.id === a.id)) {
  throw new Error('agentId+kind filter should include session a')
}
if (byAgent.sessions.some((s) => s.agentId && s.agentId !== rowA.agentId)) {
  throw new Error('agentId filter returned wrong agentId')
}

const newest = [...list.sessions].sort((x, y) => (y.createdAt ?? 0) - (x.createdAt ?? 0))[0]
const beforeCursor = newest.createdAt ?? 0
const olderOnly = await client.listSessions({ before: beforeCursor, limit: 50 })
if (olderOnly.sessions.some((s) => (s.createdAt ?? 0) >= beforeCursor)) {
  throw new Error('before=cursor should exclude sessions with createdAt >= cursor')
}

const badBefore = await fetch(new URL(`${apiPathSessions()}?before=not-a-number`, base).toString())
if (badBefore.status !== 400) {
  throw new Error(`expected 400 for invalid before, got ${badBefore.status}`)
}

const msgs = await client.getMessages(a.id)
const roles = new Set(msgs.messages.map((m) => m.role))
if (!roles.has('user') || !roles.has('assistant')) {
  throw new Error(`expected user and assistant messages, got: ${[...roles].join(', ')}`)
}

await client.patchSession(a.id, { displayName: 'Smoke display' })
const patched = await client.getSession(a.id)
if (patched.displayName !== 'Smoke display') {
  throw new Error(`expected displayName after PATCH, got ${patched.displayName}`)
}

const sysMsg = await client.createSessionMessage(a.id, {
  role: 'system',
  content: 'system smoke marker',
})
if (sysMsg.role !== 'system') {
  throw new Error('createSessionMessage role mismatch')
}
const msgs2 = await client.getMessages(a.id)
if (!msgs2.messages.some((m) => m.role === 'system' && m.content.includes('system smoke marker'))) {
  throw new Error('expected persisted system message')
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
