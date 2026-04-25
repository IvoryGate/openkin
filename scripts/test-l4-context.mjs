/**
 * L4 101: CLI `theworld inspect context <traceId>` reads the same L3 report as GET /v1/runs/.../context.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import net from 'node:net'
import { drainChildStdioForBackpressure, fetchRunStreamSseText } from './lib/integration-test-helpers.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const cli = join(root, 'packages/cli/src/index.ts')

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

function runCliInspectContext(base, traceId) {
  const r = spawnSync(
    process.execPath,
    [
      '--import=tsx/esm',
      cli,
      'inspect',
      'context',
      traceId,
      '--server-url',
      base,
    ],
    { encoding: 'utf8', cwd: root, maxBuffer: 5 * 1024 * 1024, env: { ...process.env, THEWORLD_API_KEY: '' } },
  )
  return `${r.stdout ?? ''}${r.stderr ?? ''}`
}

async function main() {
  const port = await getFreePort()
  const tmpBase = mkdtempSync(join(tmpdir(), 'theworld-l4ctx-'))
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
    assert(cr.status === 201 && cj.ok, `session: ${cr.status}`)

    const sessionId = cj.data.session.id
    for (let i = 0; i < 4; i += 1) {
      const rr = await fetch(`${base}/v1/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, input: { text: `seed turn ${i}` } }),
      })
      const rj = await rr.json()
      assert(rr.status === 202 && rj.ok, `run seed ${i}`)
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
    assert(fr.status === 202 && fj.ok, 'final run')
    const traceId = fj.data.traceId
    await runUntilTerminal(base, traceId)

    const out = runCliInspectContext(base, traceId)
    for (const needle of ['traceId:', 'Step 0', 'Blocks:', 'Compact:']) {
      assert(out.includes(needle), `CLI output missing: ${needle}\n${out.slice(0, 1200)}`)
    }

    const slashSrc = readFileSync(join(root, 'packages/cli/src/slash-chat.ts'), 'utf8')
    assert(slashSrc.includes("head === '/context'"), 'slash /context should exist')

    console.log('test:l4-context passed')
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
