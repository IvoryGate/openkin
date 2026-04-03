/**
 * list-mcp.ts — list currently registered MCP servers from mcp-registry.json
 *
 * Usage (via run_script):
 *   SKILL_ARGS='{}' SKILL_ID="manage-mcp" tsx list-mcp.ts
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

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
  return process.env.OPENKIN_WORKSPACE_DIR ?? join(process.cwd(), 'workspace')
}

async function main(): Promise<void> {
  const registryPath = join(getWorkspaceDir(), 'mcp-registry.json')

  let registry: McpRegistry = { version: 1, servers: [] }
  try {
    const raw = await readFile(registryPath, 'utf8')
    registry = JSON.parse(raw) as McpRegistry
  } catch {
    // File not found – treat as empty registry
  }

  console.log(JSON.stringify({ servers: registry.servers ?? [] }, null, 2))
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  process.stderr.write(`list-mcp: ${msg}\n`)
  process.exit(1)
})
