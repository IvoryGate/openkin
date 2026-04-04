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
        reject(new Error(`server exited early code=${code} signal=${signal} log=${bootLog}`))
      }
    })
  })
}

async function main() {
  const tmpBase = mkdtempSync(join(tmpdir(), 'openkin-sched-'))
  const port = await getFreePort()
  const env = {
    ...process.env,
    PORT: String(port),
    OPENKIN_WORKSPACE_DIR: tmpBase,
  }
  delete env.OPENKIN_API_KEY

  const child = spawn('pnpm', ['exec', 'tsx', 'packages/server/src/cli.ts'], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  await waitForServer(child)
  const base = `http://127.0.0.1:${port}`

  try {
    const createRes = await fetch(`${base}/v1/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'scheduler-smoke',
        triggerType: 'interval',
        triggerConfig: { interval_seconds: 5 },
        agentId: 'default',
        input: { text: 'ping' },
      }),
    })
    const createJson = await createRes.json()
    if (!createRes.ok || !createJson.ok || !createJson.data?.task?.id) {
      throw new Error(`create task failed: ${createRes.status} ${JSON.stringify(createJson)}`)
    }
    const taskId = createJson.data.task.id

    let completed = null
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 500))
      const runsRes = await fetch(`${base}/v1/tasks/${encodeURIComponent(taskId)}/runs`)
      const runsJson = await runsRes.json()
      if (!runsRes.ok || !runsJson.ok) {
        throw new Error(`list runs failed: ${runsRes.status} ${JSON.stringify(runsJson)}`)
      }
      const runs = runsJson.data?.runs ?? []
      completed = runs.find((x) => x.status === 'completed')
      if (completed) break
    }
    if (!completed) {
      throw new Error('expected at least one completed task run within ~20s')
    }

    const traceId = completed.traceId
    if (!traceId) {
      throw new Error('completed run missing traceId')
    }
    const traceRes = await fetch(`${base}/v1/runs/${encodeURIComponent(traceId)}`)
    const traceJson = await traceRes.json()
    if (!traceRes.ok || !traceJson.ok) {
      throw new Error(`GET /v1/runs/:traceId failed: ${traceRes.status} ${JSON.stringify(traceJson)}`)
    }

    await fetch(`${base}/v1/tasks/${encodeURIComponent(taskId)}/disable`, { method: 'POST' })

    const triggerRes = await fetch(`${base}/v1/tasks/${encodeURIComponent(taskId)}/trigger`, {
      method: 'POST',
    })
    const triggerJson = await triggerRes.json()
    if (!triggerRes.ok || !triggerJson.ok || !triggerJson.data?.traceId) {
      throw new Error(`trigger failed: ${triggerRes.status} ${JSON.stringify(triggerJson)}`)
    }

    console.error('scheduler smoke: ok')
  } finally {
    child.kill('SIGTERM')
    await new Promise((r) => setTimeout(r, 400))
    rmSync(tmpBase, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
