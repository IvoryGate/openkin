/**
 * L3 091: proves two event streams emit `EventPlaneEnvelopeV1` on the wire
 * (task SSE + log SSE `?v=1`). Run stream remains legacy `StreamEvent` (map via `streamEventToPlaneEnvelope` in contracts).
 */
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
    child.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        clearTimeout(t)
        reject(new Error(`server exited early code=${code} log=${bootLog}`))
      }
    })
  })
  drainChildStdioForBackpressure(child)
}

function isPlane(x) {
  return (
    x &&
    typeof x === 'object' &&
    x.v === 1 &&
    typeof x.domain === 'string' &&
    typeof x.kind === 'string' &&
    typeof x.ts === 'number' &&
    x.subject &&
    typeof x.subject === 'object' &&
    'payload' in x
  )
}

function firstPlaneDataLine(sseBuffer) {
  for (const block of sseBuffer.split('\n\n')) {
    if (!block.trim() || block.startsWith(':')) continue
    for (const line of block.split('\n')) {
      if (line.startsWith('data: ')) {
        try {
          const j = JSON.parse(line.slice(6))
          if (isPlane(j)) return j
        } catch {
          // ignore
        }
      }
    }
  }
  return null
}

async function readSseFirstPlane(url, { timeoutMs = 15_000 } = {}) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ac.signal })
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`)
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (value) buf += dec.decode(value, { stream: true })
      const p = firstPlaneDataLine(buf)
      if (p) return p
      if (done) break
    }
    return null
  } finally {
    clearTimeout(t)
  }
}

async function main() {
  const port = await getFreePort()
  const tmpBase = mkdtempSync(join(tmpdir(), 'theworld-evtplane-'))
  const child = spawn('pnpm', ['exec', 'tsx', 'packages/server/src/cli.ts'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), THEWORLD_WORKSPACE_DIR: tmpBase, THEWORLD_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  try {
    await waitForServer(child)
    const base = `http://127.0.0.1:${port}`

    // A) log plane: open stream, then hit an endpoint that logs
    const logPromise = readSseFirstPlane(`${base}/v1/logs/stream?v=1`, { timeoutMs: 12_000 })
    await new Promise((r) => setTimeout(r, 100))
    await fetch(`${base}/health`)
    const logPlane = await logPromise
    if (!logPlane || logPlane.domain !== 'log') {
      throw new Error(`expected log plane event, got ${JSON.stringify(logPlane)}`)
    }
    console.log('  ✓ GET /v1/logs/stream?v=1  domain=log kind=%s', logPlane.kind)

    // B) task plane: subscribe before trigger
    const taskPromise = readSseFirstPlane(`${base}/v1/tasks/events`, { timeoutMs: 45_000 })
    const createRes = await fetch(`${base}/v1/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'evtplane-smoke',
        triggerType: 'once',
        triggerConfig: { once_at: Date.now() + 200 },
        agentId: 'default',
        input: { text: 'ping' },
      }),
    })
    const createJson = await createRes.json()
    if (!createRes.ok || !createJson.ok || !createJson.data?.task?.id) {
      throw new Error(`create task: ${createRes.status} ${JSON.stringify(createJson)}`)
    }
    const taskId = createJson.data.task.id
    const tr = await fetch(`${base}/v1/tasks/${encodeURIComponent(taskId)}/trigger`, { method: 'POST' })
    const trJson = await tr.json()
    if (!tr.ok || !trJson.ok) {
      throw new Error(`trigger: ${tr.status} ${JSON.stringify(trJson)}`)
    }

    const taskPlane = await taskPromise
    if (!taskPlane || taskPlane.domain !== 'task' || taskPlane.kind !== 'task_run_finished') {
      throw new Error(`expected task plane event, got ${JSON.stringify(taskPlane)}`)
    }
    if (taskPlane.payload?.taskId !== taskId) {
      throw new Error(`task payload mismatch: ${JSON.stringify(taskPlane.payload)}`)
    }
    if (taskPlane.payload?.runSource !== 'trigger') {
      throw new Error(`expected runSource=trigger, got ${JSON.stringify(taskPlane.payload)}`)
    }
    console.log('  ✓ GET /v1/tasks/events  domain=task kind=task_run_finished runSource=trigger')

    console.log('test:event-plane passed ✓')
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

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
