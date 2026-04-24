import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, renameSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import net from 'node:net'
import Database from 'better-sqlite3'

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

async function waitForServer(child, label) {
  let bootLog = ''
  await new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`${label}: server start timeout (last log: ${bootLog.slice(-400)})`)),
      20_000,
    )
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
        reject(new Error(`${label}: server exited early code=${code} signal=${signal} log=${bootLog}`))
      }
    })
  })
}

async function main() {
  const tmpBase = mkdtempSync(join(tmpdir(), 'theworld-persist-'))
  const dbPath = join(tmpBase, 'theworld.db')
  const legacyDbPath = join(tmpBase, 'openkin.db')

  const envBase = {
    ...process.env,
    THEWORLD_WORKSPACE_DIR: tmpBase,
  }

  async function startServer(label) {
    const port = await getFreePort()
    const child = spawn('pnpm', ['exec', 'tsx', 'packages/server/src/cli.ts'], {
      cwd: root,
      env: { ...envBase, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    await waitForServer(child, label)
    return { child, port, base: `http://127.0.0.1:${port}` }
  }

  let s1
  try {
    s1 = await startServer('s1')
    const { base } = s1

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

    const runRes = await fetch(`${base}/v1/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, input: { text: 'hello persistence' } }),
    })
    const runJson = await runRes.json()
    if (!runRes.ok || !runJson.ok || !runJson.data?.traceId) {
      throw new Error(`POST /v1/runs failed: ${JSON.stringify(runJson)}`)
    }
    const { traceId } = runJson.data

    const streamRes = await fetch(`${base}/v1/runs/${encodeURIComponent(traceId)}/stream`)
    const sseText = await streamRes.text()
    const terminal = parseSseTerminal(sseText)
    if (!terminal) {
      throw new Error(`Expected terminal SSE: ${sseText.slice(0, 500)}`)
    }

    const raw = new Database(dbPath)
    try {
      const row = raw.prepare('SELECT status, steps, duration_ms FROM agent_run_traces WHERE trace_id = ?').get(traceId)
      if (!row) throw new Error('trace row missing in SQLite')
      if (!row.status) throw new Error('trace status missing')
      if (!row.steps || row.steps === '[]') throw new Error('trace steps missing')
      if (row.duration_ms == null) throw new Error('trace duration_ms missing')
    } finally {
      raw.close()
    }

    s1.child.kill('SIGTERM')
    await new Promise((r) => setTimeout(r, 400))

    renameSync(dbPath, legacyDbPath)
    if (existsSync(`${dbPath}-wal`)) renameSync(`${dbPath}-wal`, `${legacyDbPath}-wal`)
    if (existsSync(`${dbPath}-shm`)) renameSync(`${dbPath}-shm`, `${legacyDbPath}-shm`)

    const s2 = await startServer('s2')
    try {
      if (!existsSync(dbPath)) {
        throw new Error('expected legacy openkin.db to migrate to theworld.db on restart')
      }
      const got = await fetch(`${s2.base}/v1/sessions/${encodeURIComponent(sessionId)}`)
      const gotJson = await got.json()
      if (!got.ok || !gotJson.ok || gotJson.data.session.id !== sessionId) {
        throw new Error(`GET /v1/sessions/:id after restart failed: ${JSON.stringify(gotJson)}`)
      }

      // Session row survives restart but the agent registry is empty — POST /v1/runs must rehydrate.
      const run2 = await fetch(`${s2.base}/v1/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, input: { text: 'after restart' } }),
      })
      const run2Json = await run2.json()
      if (!run2.ok || !run2Json.ok || !run2Json.data?.traceId) {
        throw new Error(`POST /v1/runs after restart failed: ${JSON.stringify(run2Json)}`)
      }
      const stream2 = await fetch(
        `${s2.base}/v1/runs/${encodeURIComponent(run2Json.data.traceId)}/stream`,
      )
      if (!stream2.ok) {
        throw new Error(`GET stream after restart failed: ${stream2.status}`)
      }
      await stream2.text()
    } finally {
      s2.child.kill('SIGTERM')
      await new Promise((r) => setTimeout(r, 200))
    }

    console.log('test:persistence passed (session + run + trace in DB + session survives restart).')
  } finally {
    try {
      s1?.child?.kill('SIGTERM')
    } catch {
      // ignore
    }
    rmSync(tmpBase, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
