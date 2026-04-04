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

function parseSseTerminal(sseText) {
  let terminal = null
  for (const line of sseText.split('\n')) {
    if (line.startsWith('data: ')) {
      try {
        const ev = JSON.parse(line.slice(6))
        if (ev.type === 'run_completed' || ev.type === 'run_failed') {
          terminal = ev
        }
      } catch {
        // ignore
      }
    }
  }
  return terminal
}

async function main() {
  const tmpBase = mkdtempSync(join(tmpdir(), 'openkin-agentcfg-'))
  const port = await getFreePort()
  let stderrLog = ''
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
  child.stderr.on('data', (chunk) => {
    stderrLog += chunk.toString()
  })

  await waitForServer(child)
  const base = `http://127.0.0.1:${port}`

  try {
    const list = await fetch(`${base}/v1/agents`)
    const listJson = await list.json()
    if (!list.ok || !listJson.ok || !listJson.data?.agents?.length) {
      throw new Error(`list agents: ${JSON.stringify(listJson)}`)
    }

    const created = await fetch(`${base}/v1/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'smoke-agent',
        name: 'Smoke Agent',
        systemPrompt: 'You are a minimal test agent. Reply with exactly: OK',
      }),
    })
    const createdJson = await created.json()
    if (!created.ok || !createdJson.ok) {
      throw new Error(`create agent: ${JSON.stringify(createdJson)}`)
    }

    const sess = await fetch(`${base}/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'chat' }),
    })
    const sessJson = await sess.json()
    const sessionId = sessJson.data?.session?.id
    if (!sessionId) throw new Error('no session')

    const runRes = await fetch(`${base}/v1/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        input: { text: 'ping' },
        agentId: 'smoke-agent',
      }),
    })
    const runJson = await runRes.json()
    if (!runRes.ok || !runJson.ok || !runJson.data?.traceId) {
      throw new Error(`run with agent: ${JSON.stringify(runJson)}`)
    }
    const { traceId } = runJson.data

    const streamRes = await fetch(`${base}/v1/runs/${encodeURIComponent(traceId)}/stream`)
    const sseText = await streamRes.text()
    if (!parseSseTerminal(sseText)) throw new Error('no terminal event')

    const updateRes = await fetch(`${base}/v1/agents/smoke-agent`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt: 'UPDATED_SMOKE_PROMPT_USE_THIS_FOR_NEXT_RUN',
      }),
    })
    const updateJson = await updateRes.json()
    if (!updateRes.ok || !updateJson.ok || updateJson.data?.agent?.systemPrompt !== 'UPDATED_SMOKE_PROMPT_USE_THIS_FOR_NEXT_RUN') {
      throw new Error(`update agent failed: ${JSON.stringify(updateJson)}`)
    }

    const updatedRunRes = await fetch(`${base}/v1/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        input: { text: 'ping after update' },
        agentId: 'smoke-agent',
      }),
    })
    const updatedRunJson = await updatedRunRes.json()
    if (!updatedRunRes.ok || !updatedRunJson.ok || !updatedRunJson.data?.traceId) {
      throw new Error(`run after update failed: ${JSON.stringify(updatedRunJson)}`)
    }
    const updatedTraceId = updatedRunJson.data.traceId
    const updatedStreamRes = await fetch(`${base}/v1/runs/${encodeURIComponent(updatedTraceId)}/stream`)
    const updatedSseText = await updatedStreamRes.text()
    if (!parseSseTerminal(updatedSseText)) throw new Error('no terminal event after update')
    if (!stderrLog.includes('UPDATED_SMOKE_PROMPT_USE_THIS_FOR_NEXT_RUN')) {
      throw new Error('updated systemPrompt did not appear in server LLM request log')
    }

    const defaultRunRes = await fetch(`${base}/v1/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        input: { text: 'ping default agent' },
      }),
    })
    const defaultRunJson = await defaultRunRes.json()
    if (!defaultRunRes.ok || !defaultRunJson.ok || !defaultRunJson.data?.traceId) {
      throw new Error(`default agent run failed: ${JSON.stringify(defaultRunJson)}`)
    }
    const defaultStreamRes = await fetch(`${base}/v1/runs/${encodeURIComponent(defaultRunJson.data.traceId)}/stream`)
    const defaultSseText = await defaultStreamRes.text()
    if (!parseSseTerminal(defaultSseText)) throw new Error('no terminal event for default agent run')

    await fetch(`${base}/v1/agents/smoke-agent/disable`, { method: 'POST' })

    const badRun = await fetch(`${base}/v1/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        input: { text: 'ping' },
        agentId: 'smoke-agent',
      }),
    })
    const badJson = await badRun.json()
    if (badRun.status !== 400) {
      throw new Error(`expected 400 when agent disabled, got ${badRun.status} ${JSON.stringify(badJson)}`)
    }

    await fetch(`${base}/v1/agents/smoke-agent/enable`, { method: 'POST' })

    const del = await fetch(`${base}/v1/agents/smoke-agent`, { method: 'DELETE' })
    if (!del.ok && del.status !== 204) {
      throw new Error(`delete agent ${del.status}`)
    }

    const builtinDel = await fetch(`${base}/v1/agents/default`, { method: 'DELETE' })
    if (builtinDel.status !== 403) {
      throw new Error(`expected 403 deleting builtin, got ${builtinDel.status}`)
    }

    console.log('test:agent-config passed.')
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
