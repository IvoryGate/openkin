import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  MockLLMProvider,
  OpenAiCompatibleChatProvider,
  InMemoryToolRuntime,
  McpToolProvider,
  createBuiltinToolProvider,
  createSkillToolProvider,
  createSelfManagementToolProvider,
  listSkills,
  type LLMProvider,
} from '@openkin/core'
import { createDb, type Db } from './db/index.js'
import { createOpenKinHttpServer } from './http-server.js'
import { createMetricsStore } from './metrics.js'
import { createTaskScheduler } from './scheduler.js'
import { FileLogger } from './logger.js'
import { createLogHook } from './log-hook.js'

const port = Number(process.env.PORT ?? '3333')

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

/** Build LLM provider from environment variables.
 *
 * Reads:
 *   OPENAI_API_KEY   (or OPENKIN_LLM_API_KEY)
 *   OPENKIN_LLM_BASE_URL  (default: https://api.openai.com/v1)
 *   OPENKIN_LLM_MODEL     (default: gpt-4o-mini)
 *
 * Falls back to MockLLMProvider when no API key is set.
 */
function buildLLMProvider(): LLMProvider {
  const apiKey = process.env.OPENKIN_LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? ''
  const baseUrl = process.env.OPENKIN_LLM_BASE_URL ?? process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
  const model = process.env.OPENKIN_LLM_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

  if (!apiKey) {
    console.error('[cli] No LLM API key found (OPENAI_API_KEY or OPENKIN_LLM_API_KEY). Using MockLLMProvider.')
    console.error('[cli] Set OPENAI_API_KEY to connect a real LLM.')
    return new MockLLMProvider()
  }

  console.error(`[cli] LLM provider: ${baseUrl}  model=${model}`)
  return new OpenAiCompatibleChatProvider({ apiKey, baseUrl, model })
}

/** Load and connect all MCP servers from mcp-registry.json, if present. */
async function loadMcpRegistry(runtime: InMemoryToolRuntime): Promise<void> {
  const registryPath = join(getWorkspaceDir(), 'mcp-registry.json')
  let raw: string
  try {
    raw = await readFile(registryPath, 'utf8')
  } catch {
    return
  }

  let registry: McpRegistry
  try {
    registry = JSON.parse(raw) as McpRegistry
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[cli] Failed to parse mcp-registry.json: ${msg}`)
    return
  }

  if (!Array.isArray(registry.servers)) return

  for (const entry of registry.servers) {
    if (!entry.id || !entry.command) {
      console.error(`[cli] Skipping invalid MCP registry entry: ${JSON.stringify(entry)}`)
      continue
    }
    const provider = new McpToolProvider({
      id: entry.id,
      command: entry.command,
      args: entry.args ?? [],
      env: entry.env ?? {},
    })
    try {
      await provider.connect()
      runtime.registerProvider(provider)
      console.error(`[cli] MCP server connected: ${entry.id}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[cli] Failed to connect MCP server "${entry.id}": ${msg}`)
    }
  }
}

/** Scan workspace/skills/ and build the Skill description block for System Prompt.
 * Called on every LLM turn so newly created Skills are visible without restart. */
async function buildSkillSystemPrompt(): Promise<string> {
  const skills = await listSkills()
  if (skills.length === 0) return ''
  const lines = skills.map((s) => `- ${s.skillId}: ${s.description.replace(/\n/g, ' ').trim()}`)
  return [
    '',
    'You have access to the following Skills (call read_skill to get the full usage doc, then run_script to execute):',
    ...lines,
    '',
    'If the Skill you need is not listed above, call list_skills to see the full list.',
  ].join('\n')
}

const STATIC_SYSTEM_PROMPT = [
  'You are a helpful assistant with access to tools for file operations, shell commands, and Skills.',
  '',
  'Built-in tools:',
  '- get_current_time: get the current date and time',
  '- run_command: run any shell command (e.g. `python3 script.py`, `ls -la /path`)',
  '- read_file: read a file by absolute path',
  '- write_file: write content to a file by absolute path (creates parent dirs automatically)',
  '- list_dir: list contents of a directory',
  '- list_skills: discover available Skills',
  '- read_skill: load the SKILL.md document for a Skill',
  '- run_script: execute a Skill script',
  '- write_skill: create or update a Skill',
  '- read_logs: review recent tool-call history',
].join('\n')

function ensureBuiltinDefaultAgent(db: Db, staticSystemPrompt: string): void {
  if (db.agents.listAll().some((a) => a.isBuiltin)) return
  const now = Date.now()
  db.agents.insert({
    id: 'default',
    name: 'HTTP Server Agent',
    description: 'Built-in agent (seeded at startup)',
    systemPrompt: staticSystemPrompt,
    model: null,
    enabled: true,
    isBuiltin: true,
    createdAt: now,
    updatedAt: now,
  })
}

async function main(): Promise<void> {
  const logger = new FileLogger()
  const logHook = createLogHook(logger)
  const llm = buildLLMProvider()

  const runtime = new InMemoryToolRuntime([
    createBuiltinToolProvider(),
    createSkillToolProvider(),
    createSelfManagementToolProvider(),
  ])

  // Restore persisted MCP servers
  await loadMcpRegistry(runtime)

  const db = createDb(join(getWorkspaceDir(), 'openkin.db'))
  ensureBuiltinDefaultAgent(db, STATIC_SYSTEM_PROMPT)
  const apiKey = process.env.OPENKIN_API_KEY
  const maxBodyBytes = Number(process.env.OPENKIN_MAX_BODY_BYTES ?? 1048576)
  const metrics = createMetricsStore()
  const metricsLlmProviderLabel =
    process.env.OPENKIN_METRICS_LLM_PROVIDER ??
    (process.env.OPENAI_API_KEY || process.env.OPENKIN_LLM_API_KEY ? 'openai' : 'mock')

  const { server, streamHub, agent } = createOpenKinHttpServer({
    definition: {
      id: 'default',
      name: 'HTTP Server Agent',
      // Dynamic factory: re-scans workspace/skills/ on every LLM turn (hot-reload)
      systemPrompt: async () => {
        const skillBlock = await buildSkillSystemPrompt()
        return [STATIC_SYSTEM_PROMPT, skillBlock].filter(Boolean).join('\n')
      },
      maxSteps: 12,
    },
    llm,
    toolRuntime: runtime,
    extraHooks: [logHook],
    db,
    apiKey: apiKey || undefined,
    maxBodyBytes,
    metrics,
    metricsLlmProviderLabel,
    workspaceDir: getWorkspaceDir(),
  })

  const stopScheduler = createTaskScheduler({
    db,
    agent,
    streamHub,
    defaultMaxSteps: 12,
  })

  let shuttingDown = false
  const shutdownDb = (): void => {
    try {
      db.close()
    } catch {
      // ignore
    }
  }

  const gracefulShutdown = (): void => {
    if (shuttingDown) return
    shuttingDown = true
    stopScheduler()
    const t = setTimeout(() => {
      shutdownDb()
      process.exit(0)
    }, 30_000)
    server.close(() => {
      clearTimeout(t)
      shutdownDb()
      process.exit(0)
    })
  }

  process.on('SIGINT', gracefulShutdown)
  process.on('SIGTERM', gracefulShutdown)

  server.listen(port, () => {
    console.error(`openkin server listening on http://127.0.0.1:${port}`)
    console.error(`Logs → ${join(getWorkspaceDir(), 'logs')}`)
    console.error(`OPENKIN_INTERNAL_PORT=${port}  (for manage-mcp scripts)`)
  })
}

void main().catch((err: unknown) => {
  console.error('cli startup error:', err)
  process.exit(1)
})
