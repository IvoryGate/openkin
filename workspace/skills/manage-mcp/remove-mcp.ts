/**
 * remove-mcp.ts — unregister an MCP server
 *
 * Removes the entry from mcp-registry.json and hot-unregisters it via
 * the internal HTTP API.
 *
 * Usage (via run_script):
 *   SKILL_ARGS='{"id":"my-mcp"}' SKILL_ID="manage-mcp" tsx remove-mcp.ts
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

function getWorkspaceDir(): string {
  return process.env.THEWORLD_WORKSPACE_DIR ?? join(process.cwd(), 'workspace')
}

function getInternalPort(): number {
  return Number(process.env.THEWORLD_INTERNAL_PORT ?? '3333')
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

async function hotUnregister(port: number, id: string): Promise<void> {
  const url = `http://127.0.0.1:${port}/_internal/mcp/unregister`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Hot-unregister failed (HTTP ${res.status}): ${text}`)
  }
}

async function main(): Promise<void> {
  const rawArgs = process.env.SKILL_ARGS ?? '{}'
  let args: Record<string, unknown>
  try {
    args = JSON.parse(rawArgs) as Record<string, unknown>
  } catch {
    process.stderr.write('remove-mcp: SKILL_ARGS is not valid JSON\n')
    process.exit(1)
  }

  const id = args.id
  if (typeof id !== 'string' || !id) {
    process.stderr.write('remove-mcp: id is required\n')
    process.exit(1)
  }

  const registryPath = join(getWorkspaceDir(), 'mcp-registry.json')
  const registry = await loadRegistry(registryPath)

  const beforeCount = registry.servers.length
  registry.servers = registry.servers.filter((s) => s.id !== id)
  const removed = registry.servers.length < beforeCount

  if (!removed) {
    process.stderr.write(`remove-mcp: server "${id}" not found in registry\n`)
    console.log(JSON.stringify({ id, unregistered: false, persisted: false, warning: 'id not found in registry' }))
    return
  }

  await saveRegistry(registryPath, registry)

  // Hot-unregister
  const port = getInternalPort()
  try {
    await hotUnregister(port, id)
    console.log(JSON.stringify({ id, unregistered: true, persisted: true }))
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`remove-mcp: hot-unregister failed (will take effect on next restart): ${msg}\n`)
    console.log(JSON.stringify({ id, unregistered: false, persisted: true, warning: msg }))
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  process.stderr.write(`remove-mcp: ${msg}\n`)
  process.exit(1)
})
