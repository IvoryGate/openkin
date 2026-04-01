import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import net from 'node:net'
import path from 'node:path'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

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

function parseSseTerminal(sseText) {
  let terminal = null
  for (const line of sseText.split('\n')) {
    if (line.startsWith('data: ')) {
      try {
        const ev = JSON.parse(line.slice(6))
        if (ev.type === 'run_completed' || ev.type === 'run_failed') {
          terminal = ev
        }
      } catch {
        // ignore
      }
    }
  }
  return terminal
}

async function main() {
  const port = await getFreePort()
  const child = spawn(
    'pnpm',
    ['exec', 'tsx', 'packages/server/src/cli.ts'],
    {
      cwd: root,
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  let bootLog = ''
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`server start timeout (last log: ${bootLog.slice(-400)})`)), 20_000)
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

  const base = `http://127.0.0.1:${port}`

  try {
    const created = await fetch(`${base}/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'chat' }),
    })
    const createdJson = await created.json()
    if (!created.ok || !createdJson.ok || !createdJson.data?.session?.id) {
      throw new Error(`POST /v1/sessions failed: ${JSON.stringify(createdJson)}`)
    }
    const sessionId = createdJson.data.session.id

    const got = await fetch(`${base}/v1/sessions/${encodeURIComponent(sessionId)}`)
    const gotJson = await got.json()
    if (!got.ok || !gotJson.ok || gotJson.data.session.id !== sessionId) {
      throw new Error(`GET /v1/sessions/:id failed: ${JSON.stringify(gotJson)}`)
    }

    const runRes = await fetch(`${base}/v1/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, input: { text: 'hello from smoke' } }),
    })
    const runJson = await runRes.json()
    if (!runRes.ok || !runJson.ok || !runJson.data?.traceId) {
      throw new Error(`POST /v1/runs failed: ${JSON.stringify(runJson)}`)
    }
    const { traceId } = runJson.data

    const streamRes = await fetch(`${base}/v1/runs/${encodeURIComponent(traceId)}/stream`)
    if (!streamRes.ok) {
      throw new Error(`GET stream failed: ${streamRes.status}`)
    }
    const sseText = await streamRes.text()
    const terminal = parseSseTerminal(sseText)
    if (!terminal || (terminal.type !== 'run_completed' && terminal.type !== 'run_failed')) {
      throw new Error(`Expected terminal SSE event, got: ${sseText.slice(0, 500)}`)
    }
    if (terminal.traceId !== traceId) {
      throw new Error(`traceId mismatch: ${terminal.traceId} vs ${traceId}`)
    }

    const evLine = sseText.split('\n').find((l) => l.startsWith('event: '))
    if (!evLine || !evLine.startsWith(`event: ${terminal.type}`)) {
      throw new Error(`SSE event: line should match StreamEvent.type: ${evLine}`)
    }

    console.log('test:server passed (session + run + SSE terminal).')
  } finally {
    child.kill('SIGTERM')
    await new Promise((r) => setTimeout(r, 200))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
