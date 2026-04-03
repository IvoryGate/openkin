/**
 * add-mcp.ts — register a new MCP server
 *
 * Writes the entry to mcp-registry.json and hot-registers it via the
 * internal HTTP API so tools are immediately available (no restart needed).
 *
 * Usage (via run_script):
 *   SKILL_ARGS='{"id":"my-mcp","command":"npx","args":["-y","some-mcp"],"env":{}}' \
 *     SKILL_ID="manage-mcp" tsx add-mcp.ts
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'

interface McpRegistryEntry {
  id: string
  command: string
  args?: string[]
  env?: Record<string, string>
}

interface McpRegistry {
  version: number
  servers: McpRegistryEntry[]
}

const MCP_ID_RE = /^[a-z0-9-]+$/

function getWorkspaceDir(): string {
  return process.env.OPENKIN_WORKSPACE_DIR ?? join(process.cwd(), 'workspace')
}

function getInternalPort(): number {
  return Number(process.env.OPENKIN_INTERNAL_PORT ?? '3333')
}

async function loadRegistry(path: string): Promise<McpRegistry> {
  try {
    const raw = await readFile(path, 'utf8')
    return JSON.parse(raw) as McpRegistry
  } catch {
    return { version: 1, servers: [] }
  }
}

async function saveRegistry(path: string, registry: McpRegistry): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(registry, null, 2) + '\n', 'utf8')
}

async function hotRegister(port: number, entry: McpRegistryEntry): Promise<void> {
  const url = `http://127.0.0.1:${port}/_internal/mcp/register`
  const body = JSON.stringify(entry)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Hot-register failed (HTTP ${res.status}): ${text}`)
  }
}

async function main(): Promise<void> {
  const rawArgs = process.env.SKILL_ARGS ?? '{}'
  let args: Record<string, unknown>
  try {
    args = JSON.parse(rawArgs) as Record<string, unknown>
  } catch {
    process.stderr.write('add-mcp: SKILL_ARGS is not valid JSON\n')
    process.exit(1)
  }

  const id = args.id
  const command = args.command

  if (typeof id !== 'string' || !id) {
    process.stderr.write('add-mcp: id is required\n')
    process.exit(1)
  }
  if (!MCP_ID_RE.test(id)) {
    process.stderr.write(`add-mcp: id "${id}" is invalid. Must match [a-z0-9-]+.\n`)
    process.exit(1)
  }
  if (typeof command !== 'string' || !command) {
    process.stderr.write('add-mcp: command is required\n')
    process.exit(1)
  }

  const entry: McpRegistryEntry = {
    id,
    command,
    args: Array.isArray(args.args) ? (args.args as string[]) : [],
    env: (args.env as Record<string, string>) ?? {},
  }

  const registryPath = join(getWorkspaceDir(), 'mcp-registry.json')
  const registry = await loadRegistry(registryPath)

  // Upsert
  const existingIdx = registry.servers.findIndex((s) => s.id === id)
  if (existingIdx >= 0) {
    registry.servers[existingIdx] = entry
  } else {
    registry.servers.push(entry)
  }

  await saveRegistry(registryPath, registry)

  // Hot-register via internal API
  const port = getInternalPort()
  try {
    await hotRegister(port, entry)
    console.log(JSON.stringify({ id, registered: true, persisted: true }))
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    // Still persisted – but hot-register failed (server might be restarting)
    process.stderr.write(`add-mcp: hot-register failed (will take effect on next restart): ${msg}\n`)
    console.log(JSON.stringify({ id, registered: false, persisted: true, warning: msg }))
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  process.stderr.write(`add-mcp: ${msg}\n`)
  process.exit(1)
})
