/**
 * 093: Approval & danger — REST + `GET /v1/approvals/events` plane events.
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import net from 'node:net'
import { dirname, join } from 'node:path'
import { drainChildStdioForBackpressure } from './lib/integration-test-helpers.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function getFreePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer()
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address()
      const p = typeof addr === 'object' && addr ? addr.port : 0
      s.close((err) => (err ? reject(err) : resolve(p)))
    })
    s.on('error', reject)
  })
}

async function waitForServer(child) {
  let bootLog = ''
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`server start timeout: ${bootLog}`)), 25_000)
    const onChunk = (chunk) => {
      bootLog += chunk.toString()
      if (bootLog.includes('listening')) {
        clearTimeout(t)
        cleanup()
        resolve()
      }
    }
    const cleanup = () => {
      child.stderr?.off('data', onChunk)
      child.stdout?.off('data', onChunk)
    }
    child.stderr.on('data', onChunk)
    child.stdout.on('data', onChunk)
    child.on('error', (err) => {
      clearTimeout(t)
      reject(err)
    })
    child.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        clearTimeout(t)
        reject(new Error(`server exited early code=${code} log=${bootLog}`))
      }
    })
  })
  drainChildStdioForBackpressure(child)
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function readApprovalPlanesFromStream(body) {
  const reader = body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  const out = []
  const deadline = Date.now() + 20_000
  while (out.length < 2 && Date.now() < deadline) {
    const { value, done } = await reader.read()
    if (value) buf += dec.decode(value, { stream: true })
    const parts = buf.split('\n\n')
    buf = parts.pop() ?? ''
    for (const block of parts) {
      for (const line of block.split('\n')) {
        if (line.startsWith('data: ')) {
          try {
            const j = JSON.parse(line.slice(6))
            if (j && j.v === 1 && j.domain === 'approval') out.push(j)
          } catch {
            // ignore
          }
        }
      }
    }
    if (done) break
  }
  return out
}

async function main() {
  const port = await getFreePort()
  const tmpBase = mkdtempSync(join(tmpdir(), 'theworld-appr-'))
  const child = spawn('pnpm', ['exec', 'tsx', 'packages/server/src/cli.ts'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), THEWORLD_WORKSPACE_DIR: tmpBase, THEWORLD_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  try {
    await waitForServer(child)
    const base = `http://127.0.0.1:${port}`

    // A) deny path + GET
    const cr = await fetch(`${base}/v1/approvals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        traceId: 'trace-smoke-1',
        sessionId: 'session-smoke-1',
        runId: 'run-smoke-1',
        riskClass: 'shell_command',
        toolName: 'run_command',
        summary: 'run rm -rf /',
        ttlMs: 60_000,
      }),
    })
    const cj = await cr.json()
    assert(cr.status === 201 && cj.ok && cj.data?.approval?.id, `create: ${cr.status} ${JSON.stringify(cj)}`)
    const id1 = cj.data.approval.id
    assert(cj.data.approval.status === 'pending', 'expected pending')
    const dr = await fetch(`${base}/v1/approvals/${encodeURIComponent(id1)}/deny`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'policy' }),
    })
    const dj = await dr.json()
    assert(dr.status === 200 && dj.ok && dj.data.approval.status === 'denied', `deny: ${dr.status} ${JSON.stringify(dj)}`)
    const gr = await fetch(`${base}/v1/approvals/${encodeURIComponent(id1)}`)
    const gj = await gr.json()
    assert(
      gr.status === 200 && gj.data?.approval?.status === 'denied',
      `get after deny: ${gr.status} ${JSON.stringify(gj)}`,
    )
    console.log('  ✓ create → deny → GET (denied)')

    // B) SSE: requested + approved (resume / continue gate)
    const streamPromise = (async () => {
      const res = await fetch(`${base}/v1/approvals/events`)
      if (!res.ok) throw new Error(`SSE ${res.status}`)
      return readApprovalPlanesFromStream(res.body)
    })()
    await new Promise((r) => setTimeout(r, 200))
    const cr2 = await fetch(`${base}/v1/approvals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        traceId: 'trace-smoke-2',
        sessionId: 'session-smoke-2',
        runId: 'run-smoke-2',
        riskClass: 'file_mutation',
        summary: 'write /etc/foo',
        ttlMs: 60_000,
      }),
    })
    const c2j = await cr2.json()
    assert(cr2.status === 201 && c2j.ok, `create2: ${cr2.status}`)
    const id2 = c2j.data.approval.id
    const ar = await fetch(`${base}/v1/approvals/${encodeURIComponent(id2)}/approve`, { method: 'POST', body: '{}' })
    const aj = await ar.json()
    assert(ar.status === 200 && aj.ok && aj.data.approval.status === 'approved', `approve: ${ar.status} ${JSON.stringify(aj)}`)
    const planes = await streamPromise
    assert(planes.length >= 2, `expected >=2 approval plane events, got ${planes.length}`)
    const k0 = planes[0]
    const k1 = planes[1]
    assert(k0.domain === 'approval' && k0.kind === 'approval_requested', 'first event kind')
    assert(k0.payload?.approval?.id === id2, 'requested payload id')
    assert(k1.domain === 'approval' && k1.kind === 'approval_resolved', 'second event kind')
    assert(
      k1.payload?.resolution === 'approved' && k1.payload?.approval?.status === 'approved',
      'resolved approved',
    )
    console.log('  ✓ GET /v1/approvals/events  approval_requested + approval_resolved(approved)')

    // C) timeout → expired (短 TTL，轮询后 GET)
    const cr3 = await fetch(`${base}/v1/approvals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        traceId: 'trace-smoke-3',
        sessionId: 'session-smoke-3',
        runId: 'run-smoke-3',
        riskClass: 'network',
        summary: 'curl http://x',
        ttlMs: 100,
      }),
    })
    const c3j = await cr3.json()
    assert(cr3.status === 201 && c3j.ok, `create3: ${cr3.status}`)
    const id3 = c3j.data.approval.id
    const start = Date.now()
    let status = 'pending'
    while (Date.now() - start < 4_000) {
      const g = await fetch(`${base}/v1/approvals/${encodeURIComponent(id3)}`)
      const t = await g.json()
      if (g.ok && t.data?.approval?.status === 'expired') {
        status = 'expired'
        break
      }
      await new Promise((r) => setTimeout(r, 30))
    }
    assert(status === 'expired', 'expected auto-expire')
    console.log('  ✓ short TTL → status expired (timeout semantic)')

    console.log('test:approval passed ✓')
  } finally {
    child.kill('SIGTERM')
    await new Promise((r) => setTimeout(r, 200))
    try {
      rmSync(tmpBase, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
