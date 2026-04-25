/**
 * L4 103: CLI inspect approvals / approval <id> * over GET /v1/approvals + L3 approval routes.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import net from 'node:net'
import { drainChildStdioForBackpressure } from './lib/integration-test-helpers.mjs'

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

function runCli(args) {
  const r = spawnSync(
    process.execPath,
    ['--import=tsx/esm', cli, ...args],
    { encoding: 'utf8', cwd: root, maxBuffer: 5 * 1024 * 1024, env: { ...process.env, THEWORLD_API_KEY: '' } },
  )
  return `${r.stdout ?? ''}${r.stderr ?? ''}`
}

async function main() {
  const port = await getFreePort()
  const tmpBase = mkdtempSync(join(tmpdir(), 'theworld-l4ap-'))
  const child = spawn('pnpm', ['exec', 'tsx', 'packages/server/src/cli.ts'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), THEWORLD_WORKSPACE_DIR: tmpBase, THEWORLD_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  try {
    await waitForServer(child)
    const base = `http://127.0.0.1:${port}`

    const list0 = runCli(['inspect', 'approvals', '--server-url', base])
    assert(list0.includes('count: 0') || list0.includes('count:0'), `expected empty list\n${list0.slice(0, 800)}`)

    const cr = await fetch(`${base}/v1/approvals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        traceId: 'trace-l4-103',
        sessionId: 'session-l4-103',
        runId: 'run-l4-103',
        riskClass: 'shell_command',
        toolName: 'run_command',
        summary: 'l4-approval smoke',
        ttlMs: 60_000,
      }),
    })
    const cj = await cr.json()
    assert(cr.status === 201 && cj.ok && cj.data?.approval?.id, `create: ${cr.status} ${JSON.stringify(cj)}`)
    const id = cj.data.approval.id

    const list1 = runCli(['inspect', 'approvals', '--server-url', base])
    assert(list1.includes('pending'), `expected pending in list\n${list1.slice(0, 1200)}`)
    assert(list1.includes(id), `expected id in list\n${list1.slice(0, 1200)}`)

    const show = runCli(['inspect', 'approval', id, '--server-url', base])
    assert(show.includes('status:') && show.includes('pending'), `show\n${show.slice(0, 800)}`)

    const ap = runCli(['inspect', 'approval', id, 'approve', '--server-url', base])
    assert(ap.includes('approved'), `approve output\n${ap.slice(0, 800)}`)

    const getPath = readFileSync(join(root, 'docs/architecture-docs-for-agent/fourth-layer/L4_APPROVAL_PRODUCT_FLOW.md'), 'utf8')
    assert(getPath.includes('103'), 'L4_APPROVAL_PRODUCT_FLOW.md should reference 103')

    const slash = readFileSync(join(root, 'packages/cli/src/slash-chat.ts'), 'utf8')
    assert(slash.includes("head === '/approvals'"), 'slash /approvals')
    const map = readFileSync(join(root, 'packages/cli/src/l4-product-map.ts'), 'utf8')
    assert(map.includes('inspect:approvals'), 'product map approvals')

    const list2 = runCli(['inspect', 'approvals', '--json', '--server-url', base])
    const j = JSON.parse(list2.trim())
    assert(Array.isArray(j.approvals) && j.approvals.some((a) => a.id === id), 'json list shape')

    console.log('test:l4-approval passed')
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
