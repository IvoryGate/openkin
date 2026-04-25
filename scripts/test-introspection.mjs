/**
 * Smoke test for exec plan 024 – Debug & Introspection API
 *
 * Assertions:
 *  1. GET /v1/system/status   → 200, tools.total >= 1
 *  2. GET /v1/logs            → 200, logs is array
 *  3. GET /v1/tools           → 200, at least one tool with source='builtin'
 *  4. GET /v1/skills          → 200, skills is array
 *  5. GET /_internal/mcp/status → 200 from loopback
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import net from 'node:net'
import path from 'node:path'
import { drainChildStdioForBackpressure } from './lib/integration-test-helpers.mjs'

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

async function fetchJson(url) {
  const res = await fetch(url)
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  return { status: res.status, json }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
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
      child.stdout.removeListener('data', onChunk)
      child.stderr.removeListener('data', onChunk)
    }
    child.stdout.on('data', onChunk)
    child.stderr.on('data', onChunk)
    child.on('error', (err) => { clearTimeout(t); reject(err) })
    child.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        clearTimeout(t)
        reject(new Error(`Server exited early with code ${code}. Log:\n${bootLog}`))
      }
    })
  })
  drainChildStdioForBackpressure(child)

  const base = `http://127.0.0.1:${port}`

  try {
    // --- 1. GET /v1/system/status ---
    const { status: s1, json: j1 } = await fetchJson(`${base}/v1/system/status`)
    assert(s1 === 200, `GET /v1/system/status expected 200, got ${s1}`)
    assert(j1?.ok === true, 'system/status: ok should be true')
    const sysData = j1?.data
    assert(typeof sysData?.tools?.total === 'number', 'system/status: tools.total should be a number')
    assert(sysData.tools.total >= 1, `system/status: tools.total should be >= 1, got ${sysData.tools.total}`)
    const ts = sysData?.taskScheduler
    assert(ts && ts.active === true, 'system/status: taskScheduler.active (092)')
    assert(typeof ts.lastTickAt === 'number' && ts.lastTickAt > 0, 'system/status: taskScheduler.lastTickAt')
    assert(ts.stale === false, 'system/status: taskScheduler should not be stale on healthy server')
    console.log(
      `✅ GET /v1/system/status  tools.total=${sysData.tools.total} uptime=${sysData.uptime}s taskTick=${ts.tickIntervalMs}ms`,
    )

    // --- 2. GET /v1/logs ---
    const { status: s2, json: j2 } = await fetchJson(`${base}/v1/logs`)
    assert(s2 === 200, `GET /v1/logs expected 200, got ${s2}`)
    assert(j2?.ok === true, 'logs: ok should be true')
    assert(Array.isArray(j2?.data?.logs), 'logs: data.logs should be an array')
    console.log(`✅ GET /v1/logs  count=${j2.data.logs.length}`)

    // --- 3. GET /v1/tools ---
    const { status: s3, json: j3 } = await fetchJson(`${base}/v1/tools`)
    assert(s3 === 200, `GET /v1/tools expected 200, got ${s3}`)
    assert(Array.isArray(j3?.data?.tools), 'tools: data.tools should be an array')
    const builtinTools = j3.data.tools.filter((t) => t.source === 'builtin')
    assert(builtinTools.length >= 1, `tools: expected at least 1 builtin tool, got ${builtinTools.length}`)
    const runCmd = j3.data.tools.find((t) => t.name === 'run_command')
    assert(
      runCmd && runCmd.riskClass === 'shell_command' && runCmd.category === 'shell',
      `096: run_command should expose riskClass=shell_command and category=shell, got ${JSON.stringify(runCmd)}`,
    )
    const writeF = j3.data.tools.find((t) => t.name === 'write_file')
    assert(
      writeF && writeF.riskClass === 'file_mutation' && writeF.category === 'filesystem',
      `096: write_file should expose riskClass + category, got ${JSON.stringify(writeF)}`,
    )
    console.log(`✅ GET /v1/tools  total=${j3.data.tools.length} builtin=${builtinTools.length} (096 metadata)`)

    // --- 4. GET /v1/skills ---
    const { status: s4, json: j4 } = await fetchJson(`${base}/v1/skills`)
    assert(s4 === 200, `GET /v1/skills expected 200, got ${s4}`)
    assert(Array.isArray(j4?.data?.skills), 'skills: data.skills should be an array')
    console.log(`✅ GET /v1/skills  count=${j4.data.skills.length}`)

    // --- 5. GET /_internal/mcp/status ---
    const { status: s5, json: j5 } = await fetchJson(`${base}/_internal/mcp/status`)
    assert(s5 === 200, `GET /_internal/mcp/status expected 200, got ${s5}`)
    assert(Array.isArray(j5?.data?.providers), '_internal/mcp/status: data.providers should be an array')
    console.log(`✅ GET /_internal/mcp/status  providers=${j5.data.providers.length}`)

    console.log('\n🎉 All introspection smoke tests passed.')
  } finally {
    child.kill('SIGTERM')
    await new Promise((resolve) => { child.on('exit', resolve); setTimeout(resolve, 3000) })
  }
}

main().catch((err) => {
  console.error('FAIL:', err.message)
  process.exit(1)
})
