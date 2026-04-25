import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import net from 'node:net'
import Database from 'better-sqlite3'
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

async function main() {
  const tmpBase = mkdtempSync(join(tmpdir(), 'theworld-sched-'))
  let successServer = null
  let failingServer = null
  async function startServer(extraEnv = {}) {
    const port = await getFreePort()
    const env = {
      ...process.env,
      PORT: String(port),
      THEWORLD_WORKSPACE_DIR: tmpBase,
      ...extraEnv,
    }
    const child = spawn('pnpm', ['exec', 'tsx', 'packages/server/src/cli.ts'], {
      cwd: root,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    await waitForServer(child)
    return {
      child,
      base: `http://127.0.0.1:${port}`,
    }
  }

  try {
    successServer = await startServer({ THEWORLD_API_KEY: '' })
    const base = successServer.base

    // 092: `once` must execute via scheduler tick (no manual trigger)
    const onceAt = Date.now() + 1200
    const onceCreate = await fetch(`${base}/v1/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'scheduler-once-092',
        triggerType: 'once',
        triggerConfig: { once_at: onceAt },
        agentId: 'default',
        input: { text: 'once smoke' },
      }),
    })
    const onceJson = await onceCreate.json()
    if (!onceCreate.ok || !onceJson.ok || !onceJson.data?.task?.id) {
      throw new Error(`create once task: ${onceCreate.status} ${JSON.stringify(onceJson)}`)
    }
    const onceTaskId = onceJson.data.task.id
    let onceDone = null
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 400))
      const rRes = await fetch(`${base}/v1/tasks/${encodeURIComponent(onceTaskId)}/runs`)
      const rJson = await rRes.json()
      if (!rRes.ok || !rJson.ok) {
        throw new Error(`list once runs: ${rRes.status} ${JSON.stringify(rJson)}`)
      }
      const runs = rJson.data?.runs ?? []
      onceDone = runs.find((x) => x.taskId === onceTaskId && x.status === 'completed')
      if (onceDone) break
    }
    if (!onceDone) {
      throw new Error('expected scheduled once task to complete without trigger (092)')
    }
    const tGet = await fetch(`${base}/v1/tasks/${encodeURIComponent(onceTaskId)}`)
    const tJson = await tGet.json()
    if (!tGet.ok || !tJson.ok || !tJson.data?.task) {
      throw new Error(`get once task: ${tGet.status} ${JSON.stringify(tJson)}`)
    }
    if (tJson.data.task.enabled !== false) {
      throw new Error('expected once task to auto-disable after success (092)')
    }
    console.log('  ✓ once task completed on schedule and disabled')

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

    successServer.child.kill('SIGTERM')
    await new Promise((r) => setTimeout(r, 400))

    failingServer = await startServer({
      THEWORLD_LLM_API_KEY: 'scheduler-retry-smoke',
      THEWORLD_LLM_BASE_URL: 'http://127.0.0.1:9',
      THEWORLD_LLM_MODEL: 'offline-smoke',
    })
    const failingBase = failingServer.base

    const failingTaskRes = await fetch(`${failingBase}/v1/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'scheduler-retry-smoke',
        triggerType: 'interval',
        triggerConfig: { interval_seconds: 1 },
        agentId: 'default',
        input: { text: 'retry ping' },
      }),
    })
    const failingTaskJson = await failingTaskRes.json()
    if (!failingTaskRes.ok || !failingTaskJson.ok || !failingTaskJson.data?.task?.id) {
      throw new Error(`create failing task failed: ${failingTaskRes.status} ${JSON.stringify(failingTaskJson)}`)
    }
    const failingTaskId = failingTaskJson.data.task.id

    let failedRun = null
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 500))
      const runsRes = await fetch(`${failingBase}/v1/tasks/${encodeURIComponent(failingTaskId)}/runs`)
      const runsJson = await runsRes.json()
      if (!runsRes.ok || !runsJson.ok) {
        throw new Error(`list failing runs failed: ${runsRes.status} ${JSON.stringify(runsJson)}`)
      }
      failedRun = (runsJson.data?.runs ?? []).find((x) => x.status === 'failed')
      if (failedRun) break
    }
    if (!failedRun) {
      throw new Error('expected at least one failed retry task run within ~20s')
    }
    if (failedRun.retryCount !== 0) {
      throw new Error(`expected first failed retryCount=0, got ${failedRun.retryCount}`)
    }

    const rawDb = new Database(join(tmpBase, 'theworld.db'))
    try {
      const row = rawDb.prepare('SELECT trigger_config FROM scheduled_tasks WHERE id = ?').get(failingTaskId)
      const triggerConfig = JSON.parse(row?.trigger_config ?? '{}')
      triggerConfig._openkin_fail_streak = 1
      delete triggerConfig._theworld_fail_streak
      rawDb
        .prepare('UPDATE scheduled_tasks SET next_run_at = ?, trigger_config = ? WHERE id = ?')
        .run(Date.now() - 1000, JSON.stringify(triggerConfig), failingTaskId)
    } finally {
      rawDb.close()
    }

    let secondFailedRun = null
    for (let i = 0; i < 80; i++) {
      await new Promise((r) => setTimeout(r, 500))
      const runsRes = await fetch(`${failingBase}/v1/tasks/${encodeURIComponent(failingTaskId)}/runs`)
      const runsJson = await runsRes.json()
      if (!runsRes.ok || !runsJson.ok) {
        throw new Error(`list retry runs failed: ${runsRes.status} ${JSON.stringify(runsJson)}`)
      }
      secondFailedRun = (runsJson.data?.runs ?? []).find((x) => x.retryCount === 1)
      if (secondFailedRun) break
    }
    if (!secondFailedRun) {
      throw new Error('expected a retried failed task run with retryCount=1')
    }

    failingServer.child.kill('SIGTERM')
    await new Promise((r) => setTimeout(r, 400))

    console.error('scheduler smoke: ok')
  } finally {
    try {
      successServer?.child?.kill('SIGTERM')
    } catch {
      // ignore
    }
    try {
      failingServer?.child?.kill('SIGTERM')
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 200))
    rmSync(tmpBase, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
