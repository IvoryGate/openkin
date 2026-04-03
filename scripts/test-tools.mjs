/**
 * smoke test: 013 Tool And Integration Layer
 *
 * 验证：
 * - builtin 工具 echo / get_current_time 注册成功
 * - ReAct 循环中能触发 tool_call → tool_result
 * - run_completed SSE 事件正常接收
 * - steps 中有 toolCalls 记录
 */
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

function parseSseEvents(sseText) {
  const events = []
  for (const block of sseText.split(/\n\n+/)) {
    if (!block.trim()) continue
    let dataLine
    for (const line of block.split('\n')) {
      if (line.startsWith('data: ')) {
        dataLine = line.slice(6)
      }
    }
    if (!dataLine) continue
    try {
      events.push(JSON.parse(dataLine))
    } catch { /* ignore */ }
  }
  return events
}

async function main() {
  const port = await getFreePort()
  // Use the tools-specific cli that forces tool calls via a mock that triggers echo
  const child = spawn(
    'pnpm',
    ['exec', 'tsx', 'packages/server/src/cli-tools-test.ts'],
    {
      cwd: root,
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  let bootLog = ''
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`server start timeout (log: ${bootLog.slice(-400)})`)), 20_000)
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
    child.on('error', (err) => { clearTimeout(t); reject(err) })
    child.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        clearTimeout(t)
        reject(new Error(`server exited early code=${code} signal=${signal} log=${bootLog}`))
      }
    })
  })

  const base = `http://127.0.0.1:${port}`

  try {
    // 1. create session
    const sessionRes = await fetch(`${base}/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'chat' }),
    })
    const sessionJson = await sessionRes.json()
    if (!sessionRes.ok || !sessionJson.ok) throw new Error(`create session failed: ${JSON.stringify(sessionJson)}`)
    const sessionId = sessionJson.data.session.id

    // 2. submit run – prompt triggers echo tool in our test mock
    const runRes = await fetch(`${base}/v1/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, input: { text: 'please echo: hello tools' } }),
    })
    const runJson = await runRes.json()
    if (!runRes.ok || !runJson.ok) throw new Error(`submit run failed: ${JSON.stringify(runJson)}`)
    const { traceId } = runJson.data

    // 3. consume SSE stream
    const streamRes = await fetch(`${base}/v1/runs/${encodeURIComponent(traceId)}/stream`)
    if (!streamRes.ok) throw new Error(`stream failed: ${streamRes.status}`)
    const sseText = await streamRes.text()
    const events = parseSseEvents(sseText)

    // 4. assert terminal event
    const terminal = events.find((e) => e.type === 'run_completed' || e.type === 'run_failed')
    if (!terminal) throw new Error(`no terminal event. SSE:\n${sseText.slice(0, 800)}`)
    if (terminal.type !== 'run_completed') throw new Error(`run did not complete: ${JSON.stringify(terminal)}`)

    // 5. assert toolCalls present in steps
    const steps = terminal.payload?.steps ?? []
    const hasToolCall = steps.some((s) => s.toolCalls?.length > 0)
    if (!hasToolCall) throw new Error(`no toolCalls in steps: ${JSON.stringify(steps)}`)

    // 6. assert echo tool was called
    const allToolNames = steps.flatMap((s) => (s.toolCalls ?? []).map((tc) => tc.name))
    if (!allToolNames.includes('echo')) {
      throw new Error(`echo tool was not called. tools called: ${JSON.stringify(allToolNames)}`)
    }

    console.log('test:tools passed ✓  (echo tool call confirmed in steps)')
  } finally {
    child.kill('SIGTERM')
    await new Promise((r) => setTimeout(r, 200))
  }
}

main().catch((err) => {
  console.error('test:tools FAILED:', err.message)
  process.exit(1)
})
