/**
 * L4 104: inspect resume vocabulary + `sessions runs` (operator) + product map.
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

function runCli(args, cwd = root) {
  const r = spawnSync(
    process.execPath,
    ['--import=tsx/esm', cli, ...args],
    { encoding: 'utf8', cwd, maxBuffer: 5 * 1024 * 1024, env: { ...process.env, THEWORLD_API_KEY: '' } },
  )
  return `${r.stdout ?? ''}${r.stderr ?? ''}`
}

async function main() {
  const r0 = runCli(['inspect', 'resume'])
  assert(r0.includes('L4 background / resume') && r0.includes('104'), `inspect resume\n${r0.slice(0, 600)}`)

  const rj = runCli(['inspect', 'resume', '--json'])
  const rjLine = rj
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.startsWith('{') && l.includes('l4_background'))
  const j = JSON.parse(rjLine ?? rj.trim())
  assert(j.kind === 'l4_background_resume_vocab', 'json stub')

  const port = await getFreePort()
  const tmpBase = mkdtempSync(join(tmpdir(), 'theworld-l4br-'))
  const child = spawn('pnpm', ['exec', 'tsx', 'packages/server/src/cli.ts'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), THEWORLD_WORKSPACE_DIR: tmpBase, THEWORLD_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  try {
    await waitForServer(child)
    const base = `http://127.0.0.1:${port}`

    const sessRes = await fetch(`${base}/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'chat' }),
    })
    const sessJson = await sessRes.json()
    assert(sessRes.ok && sessJson.ok && sessJson.data?.session?.id, `create session: ${JSON.stringify(sessJson)}`)
    const sessionId = sessJson.data.session.id

    const list = runCli(['sessions', 'runs', sessionId, '--json', '--server-url', base])
    const listLine = list
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('{') && l.includes('runs'))
    const lj = JSON.parse(listLine ?? list.trim())
    assert(Array.isArray(lj.runs), 'sessions runs json shape')

    const human = runCli(['sessions', 'runs', sessionId, '--server-url', base])
    assert(human.includes('Session runs') && human.includes('L4 104'), `human list\n${human.slice(0, 600)}`)

    const getPath = readFileSync(join(root, 'docs/architecture-docs-for-agent/fourth-layer/L4_BACKGROUND_RESUME.md'), 'utf8')
    assert(getPath.includes('104'), 'L4_BACKGROUND_RESUME.md should reference 104')
    const map = readFileSync(join(root, 'packages/cli/src/l4-product-map.ts'), 'utf8')
    assert(map.includes("id: 'sessions:runs'"), 'product map sessions:runs')
    const tui = readFileSync(join(root, 'packages/cli/src/tui/run-chat-tui.tsx'), 'utf8')
    assert(tui.includes('formatL4RunsSessionRailSuffix'), 'TUI run rail')
    const slash = readFileSync(join(root, 'packages/cli/src/slash-chat.ts'), 'utf8')
    assert(slash.includes("head === '/runs'"), 'slash /runs')

    console.log('test:l4-background passed')
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
