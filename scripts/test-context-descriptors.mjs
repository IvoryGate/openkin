/**
 * 094: GET /v1/runs/:traceId/context — context blocks, compact, memory source kind.
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import net from 'node:net'
import { dirname, join } from 'node:path'
import { drainChildStdioForBackpressure, fetchRunStreamSseText } from './lib/integration-test-helpers.mjs'

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

async function runUntilTerminal(base, traceId) {
  const sseText = await fetchRunStreamSseText(`${base}/v1/runs/${encodeURIComponent(traceId)}/stream`)
  const ok = sseText.includes('run_completed') || sseText.includes('run_failed')
  assert(ok, `stream terminal expected for ${traceId}`)
}

async function main() {
  const port = await getFreePort()
  const tmpBase = mkdtempSync(join(tmpdir(), 'theworld-ctxdesc-'))
  const child = spawn('pnpm', ['exec', 'tsx', 'packages/server/src/cli.ts'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), THEWORLD_WORKSPACE_DIR: tmpBase, THEWORLD_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  try {
    await waitForServer(child)
    const base = `http://127.0.0.1:${port}`

    const cr = await fetch(`${base}/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'chat' }),
    })
    const cj = await cr.json()
    assert(cr.status === 201 && cj.ok, `session: ${cr.status} ${JSON.stringify(cj)}`)
    const sessionId = cj.data.session.id

    for (let i = 0; i < 4; i += 1) {
      const rr = await fetch(`${base}/v1/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, input: { text: `seed turn ${i}` } }),
      })
      const rj = await rr.json()
      assert(rr.status === 202 && rj.ok, `run seed ${i}: ${rr.status}`)
      await runUntilTerminal(base, rj.data.traceId)
    }

    const fr = await fetch(`${base}/v1/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        input: { text: 'final turn' },
        maxPromptTokens: 200,
      }),
    })
    const fj = await fr.json()
    assert(fr.status === 202 && fj.ok, `final run: ${fr.status} ${JSON.stringify(fj)}`)
    const traceId = fj.data.traceId
    await runUntilTerminal(base, traceId)

    const gr = await fetch(`${base}/v1/runs/${encodeURIComponent(traceId)}/context`)
    const gj = await gr.json()
    assert(gr.status === 200 && gj.ok && Array.isArray(gj.data?.steps), `GET context: ${gr.status} ${JSON.stringify(gj)}`)
    const steps = gj.data.steps
    assert(steps.length >= 1, 'expected at least one prompt snapshot')
    const s0 = steps[0]
    assert(s0.traceId === traceId, 'traceId in report')
    const layers = s0.blocks.map((b) => b.layer)
    assert(layers.includes('system'), 'system block')
    assert(layers.includes('memory'), 'memory block')
    assert(s0.memoryContributions.length >= 1, 'memory contribution')
    assert(s0.memoryContributions[0].sourceKind === 'session', 'MemoryPort → session (094 default)')
    const compact = s0.compact
    assert(typeof compact.estimatedTokensBeforeFit === 'number', 'before fit')
    assert(typeof compact.estimatedTokensAfterFit === 'number', 'after fit')
    if (compact.droppedBlockIds.includes('history')) {
      assert(compact.droppedTokenEstimate > 0, 'dropped token estimate when history dropped')
    }
    console.log('  ✓ GET /v1/runs/:traceId/context  steps=%d layers=%j memorySource=%s', steps.length, layers, s0.memoryContributions[0].sourceKind)
    console.log('test:context-descriptors passed ✓')
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
