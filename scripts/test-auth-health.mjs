import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import net from 'node:net'
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
        reject(new Error(`server exited early code=${code} signal=${signal} log=${bootLog}`))
      }
    })
  })
  drainChildStdioForBackpressure(child)
}

async function withServer(envExtra, fn, opts = {}) {
  const omitApiKey = opts.omitApiKey === true
  const tmpBase = mkdtempSync(join(tmpdir(), 'theworld-auth-'))
  const port = await getFreePort()
  const env = {
    ...process.env,
    ...envExtra,
    PORT: String(port),
    THEWORLD_WORKSPACE_DIR: tmpBase,
  }
  if (omitApiKey) delete env.THEWORLD_API_KEY
  const child = spawn('pnpm', ['exec', 'tsx', 'packages/server/src/cli.ts'], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  await waitForServer(child)
  const base = `http://127.0.0.1:${port}`
  try {
    await fn(base)
  } finally {
    child.kill('SIGTERM')
    await new Promise((r) => setTimeout(r, 300))
    rmSync(tmpBase, { recursive: true, force: true })
  }
}

async function main() {
  // A: no API key — public routes work
  await withServer(
    {},
    async (base) => {
      const r = await fetch(`${base}/v1/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'chat' }),
      })
      const j = await r.json()
      if (!r.ok || !j.ok) throw new Error(`A: expected 201 session, got ${r.status} ${JSON.stringify(j)}`)
    },
    { omitApiKey: true },
  )

  // B & C & D & E: with API key
  const secret = 'test-auth-health-secret-key-32charsxx'
  await withServer({ THEWORLD_API_KEY: secret }, async (base) => {
    const post = await fetch(`${base}/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'chat' }),
    })
    if (post.status !== 401) throw new Error(`B: expected 401 without key, got ${post.status}`)

    const ok = await fetch(`${base}/v1/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ kind: 'chat' }),
    })
    const okJson = await ok.json()
    if (!ok.ok || !okJson.ok) throw new Error(`C: expected session with key, got ${ok.status} ${JSON.stringify(okJson)}`)

    const health = await fetch(`${base}/health`)
    const healthJson = await health.json()
    if (!health.ok || healthJson.ok !== true) {
      throw new Error(`D: health should be ok without auth header, got ${health.status} ${JSON.stringify(healthJson)}`)
    }

    const big = 'x'.repeat(1024 * 1024 + 1)
    const bigRes = await fetch(`${base}/v1/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ kind: 'chat', _pad: big }),
    })
    if (bigRes.status !== 413) throw new Error(`E: expected 413 for large body, got ${bigRes.status}`)
  })

  console.log('test:auth-health passed (A–E).')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
