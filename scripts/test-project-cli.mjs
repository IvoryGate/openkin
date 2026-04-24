import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
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

/** Like runCommand but resolves with exit code (060: --pick TTY-only error path). */
function runCommandWithCode(args, envExtra = {}, stdinText = null) {
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
      resolve({ code: code ?? 1, stdout, stderr })
    })

    if (stdinText != null) {
      child.stdin.write(stdinText)
    }
    child.stdin.end()
  })
}

/** Human-readable CLI output (059) is on stderr; stdout is reserved for `--json`. */
function human(r) {
  return r.stdout + r.stderr
}

/** Exec-plan 076: `.theworld/tui.yaml` load smoke (no server). */
async function assertTuiFileConfig() {
  const emptyDir = mkdtempSync(join(tmpdir(), 'tui076-empty-'))
  try {
    const out = await new Promise((resolve, reject) => {
      const child = spawn(
        'node',
        ['--import=tsx/esm', join(root, 'scripts/verify-tui-file-config.mjs'), emptyDir],
        { cwd: root, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] },
      )
      let s = ''
      child.stdout.on('data', c => {
        s += c.toString()
      })
      child.on('error', reject)
      child.on('exit', code => (code === 0 ? resolve(s.trim()) : reject(new Error(`tui config probe exit ${code}`))))
    })
    const c = JSON.parse(String(out))
    if (c.theme !== 'dark' || c.showSidebar != null || c.configFilePath != null) {
      throw new Error(`expected default tui config, got: ${out}`)
    }
  } finally {
    rmSync(emptyDir, { recursive: true, force: true })
  }

  const withFile = mkdtempSync(join(tmpdir(), 'tui076-yaml-'))
  try {
    mkdirSync(join(withFile, '.theworld'), { recursive: true })
    writeFileSync(
      join(withFile, '.theworld', 'tui.yaml'),
      'tui:\n  theme: tokyonight\n  display:\n    show_sidebar: true\n',
    )
    const out2 = await new Promise((resolve, reject) => {
      const child = spawn(
        'node',
        ['--import=tsx/esm', join(root, 'scripts/verify-tui-file-config.mjs'), withFile],
        { cwd: root, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] },
      )
      let s = ''
      child.stdout.on('data', c => {
        s += c.toString()
      })
      child.on('error', reject)
      child.on('exit', code => (code === 0 ? resolve(s.trim()) : reject(new Error(`tui config probe 2 exit ${code}`))))
    })
    const c2 = JSON.parse(String(out2))
    if (c2.theme !== 'tokyonight' || c2.showSidebar !== true || c2.configFilePath == null) {
      throw new Error(`expected parsed tui config, got: ${out2}`)
    }
  } finally {
    rmSync(withFile, { recursive: true, force: true })
  }
}

async function main() {
  const workspaceDir = mkdtempSync(join(tmpdir(), 'theworld-project-cli-'))
  const port = await getFreePort()
  const serverEnv = {
    ...process.env,
    PORT: String(port),
    THEWORLD_WORKSPACE_DIR: workspaceDir,
  }
  delete serverEnv.THEWORLD_API_KEY

  const server = spawn('node', ['--import=tsx/esm', 'packages/server/src/cli.ts'], {
    cwd: root,
    env: serverEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  try {
    await waitForServer(server)
    await assertTuiFileConfig()
    const aliasFile = join(workspaceDir, 'session-aliases.json')
    const cliEnv = {
      THEWORLD_SERVER_URL: `http://127.0.0.1:${port}`,
      THEWORLD_SESSION_ALIASES_PATH: aliasFile,
    }

    const help = await runCommand(['help'], cliEnv)
    const helpOut = human(help)
    if (help.stdout.trim() !== '') {
      throw new Error(`help should not write to stdout (059); got:\n${help.stdout}`)
    }
    if (!helpOut.includes('TheWorld CLI')) {
      throw new Error(`help output missing TheWorld CLI header:\n${helpOut}`)
    }
    if (!helpOut.includes('pnpm theworld')) {
      throw new Error(`help should mention pnpm theworld:\n${helpOut}`)
    }
    if (!helpOut.includes('THEWORLD_SERVER_URL')) {
      throw new Error(`help should mention THEWORLD_SERVER_URL:\n${helpOut}`)
    }
    if (!helpOut.includes('THEWORLD_SESSION_ALIASES_PATH')) {
      throw new Error(`help should mention THEWORLD_SESSION_ALIASES_PATH:\n${helpOut}`)
    }
    if (!helpOut.includes('THEWORLD_CHAT_STATUS')) {
      throw new Error(`help should mention THEWORLD_CHAT_STATUS:\n${helpOut}`)
    }
    if (!helpOut.includes('THEWORLD_CHAT_SPINNER')) {
      throw new Error(`help should mention THEWORLD_CHAT_SPINNER:\n${helpOut}`)
    }
    if (!helpOut.includes('THEWORLD_CHAT_TUI')) {
      throw new Error(`help should mention THEWORLD_CHAT_TUI:\n${helpOut}`)
    }
    if (!helpOut.includes('THEWORLD_TUI_SPLASH')) {
      throw new Error(`help should mention THEWORLD_TUI_SPLASH:\n${helpOut}`)
    }
    if (!helpOut.includes('.theworld/tui.yaml')) {
      throw new Error(`help should mention .theworld/tui.yaml:\n${helpOut}`)
    }
    if (!helpOut.includes('NO_COLOR') || !helpOut.includes('TERM')) {
      throw new Error(`help should mention NO_COLOR / TERM for styling:\n${helpOut}`)
    }
    if (!helpOut.includes('Chat shorthand') || !helpOut.includes('pnpm world')) {
      throw new Error(`help should document world shorthand:\n${helpOut}`)
    }
    if (!helpOut.includes('--pick')) {
      throw new Error(`help should document --pick:\n${helpOut}`)
    }
    if (!helpOut.includes('Shell entry') || !helpOut.includes('displayName')) {
      throw new Error(`help should document shell entry + thread identity (067/069):\n${helpOut}`)
    }

    const pickNonTty = await runCommandWithCode(['chat', '--pick'], cliEnv)
    if (pickNonTty.code === 0) {
      throw new Error(`expected chat --pick to fail in non-TTY, got code 0:\n${human(pickNonTty)}`)
    }
    const pickMsg = human(pickNonTty)
    if (!pickMsg.includes('--resume') || !/tty/i.test(pickMsg)) {
      throw new Error(`expected --pick non-TTY error to mention TTY and --resume:\n${pickMsg}`)
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
    const chatH = human(chat)
    if (!chatH.includes('TheWorld Chat') || !chatH.includes('id ·')) {
      throw new Error(`chat output missing expected markers:\n${chatH}`)
    }
    if (!chatH.includes('Home shell')) {
      throw new Error(`line chat should print home shell hints (067):\n${chatH}`)
    }

    const slashChat = await runCommand(['chat'], cliEnv, '/help\n/inspect health\nexit\n')
    const slashChatH = human(slashChat)
    if (!slashChatH.includes('Slash commands')) {
      throw new Error(`slash /help missing marker:\n${slashChatH}`)
    }
    if (!slashChatH.includes('ok:') && !slashChatH.includes('ok=true')) {
      throw new Error(`slash /inspect health missing health output:\n${slashChatH}`)
    }

    const slashMore = await runCommand(['chat'], cliEnv, '/rewind\n/skills\nexit\n')
    const slashMoreH = human(slashMore)
    if (!slashMoreH.includes('not yet supported')) {
      throw new Error(`slash /rewind missing stub message:\n${slashMoreH}`)
    }
    if (!slashMoreH.includes('Skills:')) {
      throw new Error(`slash /skills missing output:\n${slashMoreH}`)
    }

    const renameOut = await runCommand(['chat'], cliEnv, '/rename smokelabel\nexit\n')
    if (!human(renameOut).includes('(smokelabel)')) {
      throw new Error(`slash /rename should show alias in session banner:\n${human(renameOut)}`)
    }

    const aliasResume = await runCommand(['chat', '--resume', 'smokelabel'], cliEnv, 'exit\n')
    const aliasResumeH = human(aliasResume)
    if (!aliasResumeH.includes('(smokelabel)')) {
      throw new Error(`--resume should accept /rename alias across CLI invocations:\n${aliasResumeH}`)
    }
    if (!aliasResumeH.includes('Resolved')) {
      throw new Error(`--resume via alias should print resolved line:\n${aliasResumeH}`)
    }

    const implicitContinue = await runCommand(['-c'], cliEnv, 'exit\n')
    if (
      !human(implicitContinue).includes('Continuing latest session') &&
      !human(implicitContinue).includes('No recent session')
    ) {
      throw new Error(`implicit -c missing continue/new hint:\n${human(implicitContinue)}`)
    }

    const sessionMatch = chatH.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    )
    if (!sessionMatch) {
      throw new Error(`could not parse session id from chat output:\n${chatH}`)
    }
    const sessionId = sessionMatch[0]

    const implicitResume = await runCommand(['--resume', sessionId], cliEnv, 'exit\n')
    if (!human(implicitResume).includes(sessionId)) {
      throw new Error(`implicit argv without chat for --resume:\n${human(implicitResume)}`)
    }

    const multiTok = await runCommand(['chat', 'alpha', 'beta'], cliEnv, 'exit\n')
    if (!human(multiTok).includes('alpha beta')) {
      throw new Error(`chat with multiple initial tokens should echo joined text:\n${human(multiTok)}`)
    }

    await new Promise((resolve, reject) => {
      const child = spawn('pnpm', ['run', 'world', '--', 'help'], {
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
          reject(new Error(`pnpm world help failed code=${code}\n${out}`))
          return
        }
        if (!out.includes('TheWorld CLI')) {
          reject(new Error(`pnpm world help missing header:\n${out}`))
          return
        }
        resolve()
      })
    })

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
    const taskIdMatch = human(createOut).match(/Created task\s+(\S+)/)
    if (!taskIdMatch) {
      throw new Error(`tasks create output missing task id:\n${human(createOut)}`)
    }
    const taskId = taskIdMatch[1]

    const triggerOut = await runCommand(['tasks', 'trigger', taskId], cliEnv)
    if (!human(triggerOut).includes('traceId')) {
      throw new Error(`tasks trigger missing traceId:\n${human(triggerOut)}`)
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
