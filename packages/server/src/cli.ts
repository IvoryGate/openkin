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
import { CompositeTaskNotifier, WebhookNotifier } from './webhook-notifier.js'
import { ConfigService } from './config-service.js'
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
function buildLLMProviderFromConfig(cfg: ConfigService): LLMProvider {
  const apiKey = cfg.getLlmApiKey()
  const baseUrl = cfg.getLlmBaseUrl()
  const model = cfg.getLlmModel()

  if (!apiKey) {
    console.error('[cli] No LLM API key found. Using MockLLMProvider.')
    console.error('[cli] Configure via Settings page (LLM → API Key) or set OPENKIN_LLM_API_KEY env var.')
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
  '',
  'Important task management guidelines:',
  '- To CREATE a scheduled/recurring task: use the "create-task" Skill (read its SKILL.md first, then run_script). Do NOT try to write task files directly or use run_command for scheduling.',
  '- Scheduled tasks run via the server scheduler and results are stored in the database. Users can view them in the Web Console under "定时任务" (Tasks).',
  '- Task notifications: when a task runs, the Agent\'s response is stored in the task run record. There is NO push notification — users must check the Web Console to see results.',
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

  // Initialise DB first so ConfigService can read persisted overrides
  const db = createDb(join(getWorkspaceDir(), 'openkin.db'))
  const configService = new ConfigService(db)
  console.error('[cli] Config loaded from DB. LLM model:', configService.getLlmModel())

  const llm = buildLLMProviderFromConfig(configService)

  const runtime = new InMemoryToolRuntime([
    createBuiltinToolProvider(),
    createSkillToolProvider(),
    createSelfManagementToolProvider(),
  ])

  // Restore persisted MCP servers
  await loadMcpRegistry(runtime)

  ensureBuiltinDefaultAgent(db, STATIC_SYSTEM_PROMPT)
  const apiKey = configService.getServerApiKey() || process.env.OPENKIN_API_KEY
  const maxBodyBytes = configService.getServerMaxBodyBytes()
  const metrics = createMetricsStore()
  const metricsLlmProviderLabel =
    process.env.OPENKIN_METRICS_LLM_PROVIDER ??
    (configService.getLlmApiKey() ? 'openai' : 'mock')

  const { server, streamHub, agent, taskEventBus } = createOpenKinHttpServer({
    definition: {
      id: 'default',
      name: 'HTTP Server Agent',
      // Dynamic factory: re-scans workspace/skills/ on every LLM turn (hot-reload)
      systemPrompt: async () => {
        const skillBlock = await buildSkillSystemPrompt()
        return [STATIC_SYSTEM_PROMPT, skillBlock].filter(Boolean).join('\n')
      },
      maxSteps: configService.getLlmMaxSteps(),
    },
    configService,
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

  // Build composite notifier: SSE broadcast + per-task webhook
  const webhookNotifier = new WebhookNotifier(
    (taskId) => db.tasks.findById(taskId)?.webhookUrl ?? null,
  )
  const notifier = new CompositeTaskNotifier(taskEventBus, webhookNotifier)

  const stopScheduler = createTaskScheduler({
    db,
    agent,
    streamHub,
    defaultMaxSteps: configService.getLlmMaxSteps(),
    notifier,
  })

  // Heartbeat: keep SSE connections alive and evict dead clients every 30s
  const heartbeatTimer = setInterval(() => taskEventBus.heartbeat(), 30_000)

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
    clearInterval(heartbeatTimer)
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
