/**
 * Smoke test for GET /v1/sessions/:id/runs (exec plan 046)
 *
 * Verifies:
 * 1. GET /v1/sessions/:id/runs returns runs after a POST /v1/runs
 * 2. ?status=completed filter works
 * 3. Non-existent session returns 404
 */

import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import net from 'node:net'

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
    const t = setTimeout(() => reject(new Error(`server start timeout: ${bootLog.slice(-400)}`)), 20_000)
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
    child.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        clearTimeout(t)
        reject(new Error(`server exited early code=${code} signal=${signal}`))
      }
    })
  })
}

async function main() {
  const port = await getFreePort()
  const tmpDir = mkdtempSync(join(tmpdir(), 'theworld-test-session-runs-'))

  const child = spawn(
    'pnpm',
    ['exec', 'tsx', 'packages/server/src/cli.ts'],
    {
      cwd: root,
      env: {
        ...process.env,
        PORT: String(port),
        THEWORLD_WORKSPACE_DIR: tmpDir,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  try {
    await waitForServer(child)
    const base = `http://127.0.0.1:${port}`

    // 1. Create a session
    const sessRes = await fetch(`${base}/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'chat' }),
    })
    const sessJson = await sessRes.json()
    if (!sessRes.ok || !sessJson.ok || !sessJson.data?.session?.id) {
      throw new Error(`POST /v1/sessions failed: ${JSON.stringify(sessJson)}`)
    }
    const sessionId = sessJson.data.session.id

    // 2. Start a run and wait for it to complete
    const runRes = await fetch(`${base}/v1/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, input: { text: 'hello from session-runs smoke' } }),
    })
    const runJson = await runRes.json()
    if (!runRes.ok || !runJson.ok || !runJson.data?.traceId) {
      throw new Error(`POST /v1/runs failed: ${JSON.stringify(runJson)}`)
    }
    const { traceId } = runJson.data

    // Wait for SSE stream to finish
    const streamRes = await fetch(`${base}/v1/runs/${encodeURIComponent(traceId)}/stream`)
    if (!streamRes.ok) throw new Error(`GET stream failed: ${streamRes.status}`)
    await streamRes.text() // drain

    // 3. GET /v1/sessions/:id/runs — should contain the run we just did
    const runsRes = await fetch(`${base}/v1/sessions/${encodeURIComponent(sessionId)}/runs`)
    const runsJson = await runsRes.json()
    if (!runsRes.ok || !runsJson.ok || !Array.isArray(runsJson.data?.runs)) {
      throw new Error(`GET /v1/sessions/:id/runs failed: ${JSON.stringify(runsJson)}`)
    }
    const runIds = runsJson.data.runs.map((r) => r.traceId)
    if (!runIds.includes(traceId)) {
      throw new Error(`Expected traceId ${traceId} in runs list, got: ${JSON.stringify(runIds)}`)
    }
    console.log(`  ✓ GET /v1/sessions/:id/runs  count=${runsJson.data.runs.length}`)

    // 4. GET /v1/sessions/:id/runs?status=completed — should match
    const completedRes = await fetch(`${base}/v1/sessions/${encodeURIComponent(sessionId)}/runs?status=completed`)
    const completedJson = await completedRes.json()
    if (!completedRes.ok || !completedJson.ok || !Array.isArray(completedJson.data?.runs)) {
      throw new Error(`GET ?status=completed failed: ${JSON.stringify(completedJson)}`)
    }
    const completedIds = completedJson.data.runs.map((r) => r.traceId)
    if (!completedIds.includes(traceId)) {
      throw new Error(`Expected traceId ${traceId} in completed runs, got: ${JSON.stringify(completedIds)}`)
    }
    console.log(`  ✓ GET /v1/sessions/:id/runs?status=completed  count=${completedJson.data.runs.length}`)

    // 5. GET with invalid status — should return 400
    const badRes = await fetch(`${base}/v1/sessions/${encodeURIComponent(sessionId)}/runs?status=invalid`)
    if (badRes.status !== 400) {
      throw new Error(`Expected 400 for invalid status, got: ${badRes.status}`)
    }
    console.log(`  ✓ GET /v1/sessions/:id/runs?status=invalid → 400`)

    // 6. Non-existent session returns 404
    const notFoundRes = await fetch(`${base}/v1/sessions/nonexistent-session/runs`)
    if (notFoundRes.status !== 404) {
      throw new Error(`Expected 404 for non-existent session, got: ${notFoundRes.status}`)
    }
    console.log(`  ✓ GET /v1/sessions/nonexistent/runs → 404`)

    console.log('test:session-runs passed ✓')
  } finally {
    child.kill('SIGTERM')
    await new Promise((r) => setTimeout(r, 200))
    try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* ignore */ }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
