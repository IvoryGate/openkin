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
  for (const line of sseText.split('\n')) {
    if (line.startsWith('data: ')) {
      try {
        const ev = JSON.parse(line.slice(6))
        events.push(ev)
      } catch {
        // ignore
      }
    }
  }
  return events
}

function findTerminal(events) {
  return events.find((ev) => ev.type === 'run_completed' || ev.type === 'run_failed') ?? null
}

async function main() {
  const port = await getFreePort()
  const child = spawn(
    'pnpm',
    ['exec', 'tsx', 'packages/server/src/cli.ts'],
    {
      cwd: root,
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  let bootLog = ''
  await new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`server start timeout (last log: ${bootLog.slice(-400)})`)),
      120_000,
    )
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

  const base = `http://127.0.0.1:${port}`

  try {
    console.log('test:skills — Skill tool provider smoke test')

    // Create session
    const created = await fetch(`${base}/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'chat' }),
    })
    const createdJson = await created.json()
    if (!created.ok || !createdJson.ok || !createdJson.data?.session?.id) {
      throw new Error(`POST /v1/sessions failed: ${JSON.stringify(createdJson)}`)
    }
    const sessionId = createdJson.data.session.id

    // Trigger "get_weather" tool — provided by the demo-weather skill
    // MockLLMProvider triggers get_weather when message includes "weather"
    const runRes = await fetch(`${base}/v1/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, input: { text: 'What is the weather in Beijing today?' } }),
    })
    const runJson = await runRes.json()
    if (!runRes.ok || !runJson.ok || !runJson.data?.traceId) {
      throw new Error(`POST /v1/runs failed: ${JSON.stringify(runJson)}`)
    }
    const { traceId } = runJson.data

    // Stream SSE
    const streamRes = await fetch(`${base}/v1/runs/${encodeURIComponent(traceId)}/stream`)
    if (!streamRes.ok) {
      throw new Error(`GET stream failed: ${streamRes.status}`)
    }
    const sseText = await streamRes.text()
    const events = parseSseEvents(sseText)
    const terminal = findTerminal(events)

    if (!terminal) {
      throw new Error(`Expected terminal SSE event, got: ${sseText.slice(0, 500)}`)
    }
    if (terminal.type !== 'run_completed') {
      throw new Error(`Expected run_completed, got: ${terminal.type} — ${JSON.stringify(terminal)}`)
    }
    if (terminal.traceId !== traceId) {
      throw new Error(`traceId mismatch: ${terminal.traceId} vs ${traceId}`)
    }

    // Assert the skill's get_weather tool was called
    // StreamEvent.payload is AgentResult which contains steps
    const steps = (terminal.payload?.steps) ?? terminal.steps ?? []
    const hasWeatherToolCall = steps.some(
      (step) =>
        Array.isArray(step.toolCalls) &&
        step.toolCalls.some((tc) => tc.name === 'get_weather'),
    )
    if (!hasWeatherToolCall) {
      throw new Error(
        `Expected at least one toolCall with name="get_weather" in steps. steps=${JSON.stringify(steps)}`,
      )
    }

    console.log('  ✓ Skill provider: run_completed with get_weather tool call (demo-weather skill)')
    console.log('test:skills passed (SkillToolProvider with demo-weather skill verified).')
  } finally {
    child.kill('SIGTERM')
    await new Promise((r) => setTimeout(r, 500))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
