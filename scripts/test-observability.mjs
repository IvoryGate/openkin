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
}

async function main() {
  const tmpBase = mkdtempSync(join(tmpdir(), 'openkin-obs-'))
  const port = await getFreePort()
  let stderrLog = ''
  const env = {
    ...process.env,
    PORT: String(port),
    OPENKIN_WORKSPACE_DIR: tmpBase,
    OPENKIN_SLOW_RUN_THRESHOLD_MS: '0',
  }
  delete env.OPENKIN_API_KEY

  const child = spawn('pnpm', ['exec', 'tsx', 'packages/server/src/cli.ts'], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stderr.on('data', (chunk) => {
    stderrLog += chunk.toString()
  })

  await waitForServer(child)
  const base = `http://127.0.0.1:${port}`

  try {
    const created = await fetch(`${base}/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'chat' }),
    })
    const createdJson = await created.json()
    const sessionId = createdJson.data?.session?.id
    if (!sessionId) throw new Error('no session')

    const runRes = await fetch(`${base}/v1/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, input: { text: 'observability ping' } }),
    })
    const xTrace = runRes.headers.get('x-trace-id')
    if (!xTrace) throw new Error('missing X-Trace-Id header on POST /v1/runs')
    const runJson = await runRes.json()
    const traceId = runJson.data?.traceId
    if (!traceId) throw new Error('no traceId in body')

    const streamRes = await fetch(`${base}/v1/runs/${encodeURIComponent(traceId)}/stream`)
    const sseText = await streamRes.text()
    const terminal = parseSseTerminal(sseText)
    if (!terminal) throw new Error('no terminal SSE')

    const traceGet = await fetch(`${base}/v1/runs/${encodeURIComponent(traceId)}`)
    const traceJson = await traceGet.json()
    if (!traceGet.ok || !traceJson.ok || !traceJson.data?.steps?.length) {
      throw new Error(`GET trace failed: ${JSON.stringify(traceJson)}`)
    }

    const listTr = await fetch(`${base}/v1/sessions/${encodeURIComponent(sessionId)}/traces`)
    const listJson = await listTr.json()
    if (!listTr.ok || !listJson.ok || !listJson.data?.traces?.some((t) => t.traceId === traceId)) {
      throw new Error(`session traces missing run: ${JSON.stringify(listJson)}`)
    }

    const met = await fetch(`${base}/metrics`)
    const metText = await met.text()
    if (!met.ok || !metText.includes('openkin_agent_run_total')) {
      throw new Error(`metrics failed: ${met.status} ${metText.slice(0, 200)}`)
    }
    if (!metText.includes('openkin_agent_run_total{status="completed"}')) {
      // failed or other status on mock edge cases — accept any agent run counter line
      if (!metText.match(/openkin_agent_run_total\{status="/)) {
        throw new Error('missing openkin_agent_run_total')
      }
    }
    if (!stderrLog.includes('[WARN] Slow run detected')) {
      throw new Error('missing slow run warning in stderr log')
    }

    console.log('test:observability passed (X-Trace-Id, GET trace, session traces, metrics).')
  } finally {
    child.kill('SIGTERM')
    await new Promise((r) => setTimeout(r, 300))
    rmSync(tmpBase, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
