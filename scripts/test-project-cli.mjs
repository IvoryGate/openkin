import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      server.close(err => (err ? reject(err) : resolve(port)))
    })
    server.on('error', reject)
  })
}

async function waitForServer(child) {
  let bootLog = ''
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`server start timeout: ${bootLog.slice(-400)}`))
    }, 20_000)
    const onChunk = chunk => {
      bootLog += chunk.toString()
      if (bootLog.includes('listening')) {
        clearTimeout(timeout)
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
    child.on('error', err => {
      clearTimeout(timeout)
      reject(err)
    })
    child.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        clearTimeout(timeout)
        reject(new Error(`server exited early code=${code} signal=${signal} log=${bootLog}`))
      }
    })
  })
}

function runCommand(args, envExtra = {}, stdinText = null) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['--import=tsx/esm', 'packages/cli/src/index.ts', ...args], {
      cwd: root,
      env: { ...process.env, ...envExtra },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', chunk => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('exit', code => {
      if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        reject(new Error(`cli command failed (${args.join(' ')}): code=${code}\nstdout=${stdout}\nstderr=${stderr}`))
      }
    })

    if (stdinText != null) {
      child.stdin.write(stdinText)
    }
    child.stdin.end()
  })
}

async function main() {
  const workspaceDir = mkdtempSync(join(tmpdir(), 'openkin-project-cli-'))
  const port = await getFreePort()
  const serverEnv = {
    ...process.env,
    PORT: String(port),
    THEWORLD_WORKSPACE_DIR: workspaceDir,
  }
  delete serverEnv.OPENKIN_API_KEY
  delete serverEnv.THEWORLD_API_KEY

  const server = spawn('node', ['--import=tsx/esm', 'packages/server/src/cli.ts'], {
    cwd: root,
    env: serverEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  try {
    await waitForServer(server)
    const cliEnv = {
      THEWORLD_SERVER_URL: `http://127.0.0.1:${port}`,
    }

    const help = await runCommand(['help'], cliEnv)
    if (!help.stdout.includes('TheWorld CLI')) {
      throw new Error(`help output missing TheWorld CLI header:\n${help.stdout}`)
    }
    if (!help.stdout.includes('pnpm theworld')) {
      throw new Error(`help should mention pnpm theworld:\n${help.stdout}`)
    }
    if (!help.stdout.includes('THEWORLD_SERVER_URL')) {
      throw new Error(`help should mention THEWORLD_SERVER_URL:\n${help.stdout}`)
    }

    await new Promise((resolve, reject) => {
      const child = spawn('pnpm', ['run', 'theworld', '--', 'help'], {
        cwd: root,
        env: { ...process.env, ...cliEnv },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let out = ''
      child.stdout.on('data', c => {
        out += c.toString()
      })
      child.stderr.on('data', c => {
        out += c.toString()
      })
      child.on('error', reject)
      child.on('exit', code => {
        if (code !== 0) {
          reject(new Error(`pnpm theworld help failed code=${code}\n${out}`))
          return
        }
        if (!out.includes('TheWorld CLI')) {
          reject(new Error(`pnpm theworld help missing header:\n${out}`))
          return
        }
        resolve()
      })
    })

    const chat = await runCommand(['chat'], cliEnv, 'exit\n')
    if (!chat.stdout.includes('TheWorld Chat') || !chat.stdout.includes('id ·')) {
      throw new Error(`chat output missing expected markers:\n${chat.stdout}`)
    }

    const slashChat = await runCommand(['chat'], cliEnv, '/help\n/inspect health\nexit\n')
    if (!slashChat.stdout.includes('Slash commands')) {
      throw new Error(`slash /help missing marker:\n${slashChat.stdout}`)
    }
    if (!slashChat.stdout.includes('ok:') && !slashChat.stdout.includes('ok=true')) {
      throw new Error(`slash /inspect health missing health output:\n${slashChat.stdout}`)
    }
    const sessionMatch = chat.stdout.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    )
    if (!sessionMatch) {
      throw new Error(`could not parse session id from chat output:\n${chat.stdout}`)
    }
    const sessionId = sessionMatch[0]

    const sessions = JSON.parse((await runCommand(['sessions', 'list', '--json'], cliEnv)).stdout)
    if (!Array.isArray(sessions.sessions) || sessions.total < 1) {
      throw new Error(`sessions list returned unexpected payload: ${JSON.stringify(sessions)}`)
    }

    const show = JSON.parse((await runCommand(['sessions', 'show', sessionId, '--json'], cliEnv)).stdout)
    if (show.id !== sessionId) {
      throw new Error(`sessions show unexpected: ${JSON.stringify(show)}`)
    }

    const messages = JSON.parse(
      (await runCommand(['sessions', 'messages', sessionId, '--limit', '5', '--json'], cliEnv)).stdout,
    )
    if (!Array.isArray(messages.messages)) {
      throw new Error(`sessions messages unexpected: ${JSON.stringify(messages)}`)
    }

    await runCommand(['chat', '--session', sessionId], cliEnv, 'exit\n')

    const health = JSON.parse((await runCommand(['inspect', 'health', '--json'], cliEnv)).stdout)
    if (health.ok !== true || typeof health.version !== 'string') {
      throw new Error(`inspect health returned unexpected payload: ${JSON.stringify(health)}`)
    }

    const status = JSON.parse((await runCommand(['inspect', 'status', '--json'], cliEnv)).stdout)
    if (typeof status.version !== 'string' || !Array.isArray(status.skills?.list)) {
      throw new Error(`inspect status returned unexpected payload: ${JSON.stringify(status)}`)
    }

    const tools = JSON.parse((await runCommand(['inspect', 'tools', '--json'], cliEnv)).stdout)
    if (!Array.isArray(tools.tools)) {
      throw new Error(`inspect tools returned unexpected payload: ${JSON.stringify(tools)}`)
    }

    const logs = JSON.parse((await runCommand(['inspect', 'logs', '--json'], cliEnv)).stdout)
    if (!Array.isArray(logs.logs) || typeof logs.hasMore !== 'boolean') {
      throw new Error(`inspect logs returned unexpected payload: ${JSON.stringify(logs)}`)
    }

    const skills = JSON.parse((await runCommand(['inspect', 'skills', '--json'], cliEnv)).stdout)
    if (!Array.isArray(skills.skills)) {
      throw new Error(`inspect skills returned unexpected payload: ${JSON.stringify(skills)}`)
    }

    const tasksBefore = JSON.parse((await runCommand(['tasks', 'list', '--json'], cliEnv)).stdout)
    if (!Array.isArray(tasksBefore.tasks)) {
      throw new Error(`tasks list returned unexpected payload: ${JSON.stringify(tasksBefore)}`)
    }

    const taskFile = join(workspaceDir, 'cli-smoke-task.json')
    writeFileSync(
      taskFile,
      JSON.stringify({
        name: 'cli-smoke-task',
        triggerType: 'interval',
        triggerConfig: { interval_seconds: 999_999 },
        agentId: 'default',
        input: { text: 'ping' },
        enabled: false,
      }),
    )

    const createOut = await runCommand(['tasks', 'create', '--file', taskFile], cliEnv)
    const taskIdMatch = createOut.stdout.match(/Created task\s+(\S+)/)
    if (!taskIdMatch) {
      throw new Error(`tasks create output missing task id:\n${createOut.stdout}\n${createOut.stderr}`)
    }
    const taskId = taskIdMatch[1]

    const triggerOut = await runCommand(['tasks', 'trigger', taskId], cliEnv)
    if (!triggerOut.stdout.includes('traceId')) {
      throw new Error(`tasks trigger missing traceId:\n${triggerOut.stdout}`)
    }

    const taskShow = JSON.parse((await runCommand(['tasks', 'show', taskId, '--json'], cliEnv)).stdout)
    if (taskShow.id !== taskId) {
      throw new Error(`tasks show unexpected: ${JSON.stringify(taskShow)}`)
    }

    await runCommand(['tasks', 'enable', taskId], cliEnv)
    await runCommand(['tasks', 'disable', taskId], cliEnv)

    const runs = JSON.parse((await runCommand(['tasks', 'runs', taskId, '--json'], cliEnv)).stdout)
    if (!Array.isArray(runs.runs)) {
      throw new Error(`tasks runs unexpected: ${JSON.stringify(runs)}`)
    }

    const delSession = JSON.parse((await runCommand(['sessions', 'delete', sessionId, '--json'], cliEnv)).stdout)
    if (delSession.ok !== true || delSession.sessionId !== sessionId) {
      throw new Error(`sessions delete unexpected: ${JSON.stringify(delSession)}`)
    }

    console.log('test:project-cli passed.')
  } finally {
    server.kill('SIGTERM')
    await new Promise(resolve => setTimeout(resolve, 300))
    rmSync(workspaceDir, { recursive: true, force: true })
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
