import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import net from 'node:net'
import { drainChildStdioForBackpressure, fetchRunStreamSseText } from './lib/integration-test-helpers.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const V1 = 'theworld:msg:v1:'

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

async function waitForServer(child, label) {
  let bootLog = ''
  await new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`${label}: server start timeout (last log: ${bootLog.slice(-400)})`)),
      20_000,
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
        reject(new Error(`${label}: server exited early code=${code} signal=${signal} log=${bootLog}`))
      }
    })
  })
  drainChildStdioForBackpressure(child)
}

async function main() {
  const tmpBase = mkdtempSync(join(tmpdir(), 'theworld-mm-'))
  const envBase = { ...process.env, THEWORLD_WORKSPACE_DIR: tmpBase }

  const port = await getFreePort()
  const child = spawn('pnpm', ['exec', 'tsx', 'packages/server/src/cli.ts'], {
    cwd: root,
    env: { ...envBase, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const base = `http://127.0.0.1:${port}`

  try {
    await waitForServer(child, 'mm')

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

    const bad = await fetch(`${base}/v1/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, input: { text: '' } }),
    })
    if (bad.ok) {
      throw new Error('expected 400 for empty text and no attachments')
    }

    const runRes = await fetch(`${base}/v1/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        input: { text: '', attachments: [{ kind: 'image', url: 'https://example.com/pic.png' }] },
      }),
    })
    const runJson = await runRes.json()
    if (!runRes.ok || !runJson.ok || !runJson.data?.traceId) {
      throw new Error(`POST /v1/runs (image-only) failed: ${JSON.stringify(runJson)}`)
    }

    await fetchRunStreamSseText(`${base}/v1/runs/${encodeURIComponent(runJson.data.traceId)}/stream`)

    const msgsRes = await fetch(`${base}/v1/sessions/${encodeURIComponent(sessionId)}/messages?limit=10`)
    const msgsJson = await msgsRes.json()
    if (!msgsRes.ok || !msgsJson.ok || !Array.isArray(msgsJson.data?.messages)) {
      throw new Error(`GET messages failed: ${JSON.stringify(msgsJson)}`)
    }
    const userRow = [...msgsJson.data.messages].reverse().find((m) => m.role === 'user')
    if (!userRow?.content || typeof userRow.content !== 'string') {
      throw new Error('expected user message in DB')
    }
    if (!userRow.content.startsWith(V1)) {
      throw new Error(`expected v1 stored user message, got: ${userRow.content.slice(0, 80)}`)
    }
    const parsed = JSON.parse(userRow.content.slice(V1.length))
    if (!Array.isArray(parsed.parts) || parsed.parts.length !== 1) {
      throw new Error(`unexpected parts: ${userRow.content}`)
    }
    if (parsed.parts[0].type !== 'image' || parsed.parts[0].url !== 'https://example.com/pic.png') {
      throw new Error(`unexpected image part: ${JSON.stringify(parsed.parts[0])}`)
    }

    const run2 = await fetch(`${base}/v1/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        input: { text: 'ok', attachments: [{ kind: 'file', ref: 'ref://blob/1', name: 'a.txt' }] },
      }),
    })
    const run2Json = await run2.json()
    if (!run2.ok || !run2Json.ok) {
      throw new Error(`second POST /v1/runs failed: ${JSON.stringify(run2Json)}`)
    }

    console.log('test:multimodal passed (L3 run input + v1 user persistence + rehydration path).')
  } finally {
    try {
      child.kill('SIGTERM')
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
