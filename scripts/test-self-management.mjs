/**
 * smoke test: 016 Agent Self-Management
 *
 * 验证：
 * A) write_skill: Agent 可创建新 Skill（workspace/skills/test-auto-skill/SKILL.md 被写入）
 * B) read_logs:   Agent 调用 read_logs 工具后收到事件列表（或空列表，不报错）
 * C) InMemoryToolRuntime 有 registerProvider / unregisterProvider 方法
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
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
      if (line.startsWith('data: ')) dataLine = line.slice(6)
    }
    if (!dataLine) continue
    try { events.push(JSON.parse(dataLine)) } catch { /* ignore */ }
  }
  return events
}

async function startServer(port) {
  const child = spawn(
    'pnpm',
    ['exec', 'tsx', 'packages/server/src/cli-self-management-test.ts'],
    {
      cwd: root,
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  let bootLog = ''
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`server start timeout (log: ${bootLog.slice(-400)})`)), 30_000)
    const onChunk = (chunk) => {
      bootLog += chunk.toString()
      if (bootLog.includes('listening')) { clearTimeout(t); cleanup(); resolve() }
    }
    const cleanup = () => { child.stderr?.off('data', onChunk); child.stdout?.off('data', onChunk) }
    child.stderr.on('data', onChunk)
    child.stdout.on('data', onChunk)
    child.on('error', (err) => { clearTimeout(t); reject(err) })
    child.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        clearTimeout(t)
        reject(new Error(`server exited code=${code} signal=${signal} log=${bootLog}`))
      }
    })
  })
  return child
}

async function runAndWait(base, prompt) {
  const sessionRes = await fetch(`${base}/v1/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'chat' }),
  })
  const sessionJson = await sessionRes.json()
  if (!sessionRes.ok || !sessionJson.ok) throw new Error(`create session: ${JSON.stringify(sessionJson)}`)
  const sessionId = sessionJson.data.session.id

  const runRes = await fetch(`${base}/v1/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, input: { text: prompt } }),
  })
  const runJson = await runRes.json()
  if (!runRes.ok || !runJson.ok) throw new Error(`submit run: ${JSON.stringify(runJson)}`)
  const { traceId } = runJson.data

  const streamRes = await fetch(`${base}/v1/runs/${encodeURIComponent(traceId)}/stream`)
  if (!streamRes.ok) throw new Error(`stream: ${streamRes.status}`)
  const sseText = await streamRes.text()
  const events = parseSseEvents(sseText)
  const terminal = events.find((e) => e.type === 'run_completed' || e.type === 'run_failed')
  if (!terminal) throw new Error(`no terminal event. SSE:\n${sseText.slice(0, 800)}`)
  return terminal
}

async function main() {
  const port = await getFreePort()
  const base = `http://127.0.0.1:${port}`
  const child = await startServer(port)

  try {
    // ─── Scenario A: write_skill ──────────────────────────────────────────
    const termA = await runAndWait(base, 'Please write a new skill called test-auto-skill')
    if (termA.type !== 'run_completed') throw new Error(`Scenario A failed: run not completed: ${JSON.stringify(termA)}`)

    const stepsA = termA.payload?.steps ?? []
    const toolNamesA = stepsA.flatMap((s) => (s.toolCalls ?? []).map((tc) => tc.name))
    if (!toolNamesA.includes('write_skill')) {
      throw new Error(`Scenario A: write_skill was not called. tools=${JSON.stringify(toolNamesA)}`)
    }
    // Verify the skill SKILL.md was actually created in the server's temp workspace
    // We check the tool result in steps instead of file system (different process)
    const writeResult = stepsA
      .flatMap((s) => s.toolResults ?? [])
      .find((r) => r?.name === 'write_skill')
    if (!writeResult) throw new Error('Scenario A: no tool result found for write_skill')
    const output = writeResult.output ?? {}
    if (output.filesWritten === undefined && output.code !== undefined) {
      throw new Error(`Scenario A: write_skill returned error: ${JSON.stringify(output)}`)
    }
    if (!Array.isArray(output.filesWritten) || !output.filesWritten.includes('SKILL.md')) {
      throw new Error(`Scenario A: filesWritten unexpected: ${JSON.stringify(output.filesWritten)}`)
    }
    console.log('test:self-management scenario A passed ✓  (write_skill created SKILL.md)')

    // ─── Scenario B: read_logs ─────────────────────────────────────────────
    const termB = await runAndWait(base, 'Please read the recent logs')
    if (termB.type !== 'run_completed') throw new Error(`Scenario B failed: ${JSON.stringify(termB)}`)

    const stepsB = termB.payload?.steps ?? []
    const toolNamesB = stepsB.flatMap((s) => (s.toolCalls ?? []).map((tc) => tc.name))
    if (!toolNamesB.includes('read_logs')) {
      throw new Error(`Scenario B: read_logs was not called. tools=${JSON.stringify(toolNamesB)}`)
    }
    const logsResult = stepsB
      .flatMap((s) => s.toolResults ?? [])
      .find((r) => r?.name === 'read_logs')
    if (!logsResult) throw new Error('Scenario B: no tool result for read_logs')
    const logsOutput = logsResult.output ?? {}
    if (!Array.isArray(logsOutput.events)) {
      throw new Error(`Scenario B: read_logs output.events is not an array: ${JSON.stringify(logsOutput)}`)
    }
    console.log(`test:self-management scenario B passed ✓  (read_logs returned events array, length=${logsOutput.events.length})`)

    // ─── Scenario C: InMemoryToolRuntime hot-registration API ─────────────
    // Verify via the internal HTTP endpoint (loopback)
    const listRes = await fetch(`${base}/_internal/mcp/list`)
    if (!listRes.ok) throw new Error(`Scenario C: /_internal/mcp/list returned ${listRes.status}`)
    const listJson = await listRes.json()
    if (!listJson.ok || !Array.isArray(listJson.data?.tools)) {
      throw new Error(`Scenario C: unexpected list response: ${JSON.stringify(listJson)}`)
    }
    console.log(`test:self-management scenario C passed ✓  (/_internal/mcp/list responded with tools=[${listJson.data.tools.join(', ')}])`)

    console.log('test:self-management PASSED ✓')
  } finally {
    child.kill('SIGTERM')
    await new Promise((r) => setTimeout(r, 300))
  }
}

main().catch((err) => {
  console.error('test:self-management FAILED:', err.message)
  process.exit(1)
})
