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
  const tmpBase = mkdtempSync(join(tmpdir(), 'openkin-sessmsg-'))
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

  const smoke = spawn('pnpm', ['exec', 'tsx', 'scripts/run-session-message-smoke.ts'], {
    cwd: root,
    env: { ...process.env, OPENKIN_BASE_URL: base, OPENKIN_WORKSPACE_DIR: tmpBase },
    stdio: 'inherit',
  })

  try {
    await new Promise((resolve, reject) => {
      smoke.on('error', reject)
      smoke.on('exit', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`session-message smoke exited ${code}`))
      })
    })
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
