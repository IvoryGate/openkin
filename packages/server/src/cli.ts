import { setDefaultResultOrder } from 'node:dns'
import { copyFileSync, existsSync, renameSync, unlinkSync } from 'node:fs'
import { readFile } from 'node:fs/promises'

/** Prefer IPv4 for outbound HTTPS (reduces flaky TLS to some OpenAI-compatible hosts). */
setDefaultResultOrder('ipv4first')
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
  readEnv,
  type LLMProvider,
  type LLMGenerateRequest,
  type LLMGenerateResponse,
} from '@theworld/core'
import { createDb, type Db } from './db/index.js'
import { createTheWorldHttpServer } from './http-server.js'
import { createMetricsStore } from './metrics.js'
import { createTaskScheduler } from './scheduler.js'
import { CompositeTaskNotifier, WebhookNotifier } from './webhook-notifier.js'
import { ConfigService } from './config-service.js'
import { FileLogger, serverLog } from './logger.js'
import { createLogHook } from './log-hook.js'
import { createTaskInfraToolProvider } from './task-infra-tool-provider.js'
import { markHeartbeat } from './heartbeat-registry.js'

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

const DB_FILENAME = 'theworld.db'
const LEGACY_DB_FILENAME = 'openkin.db'

function getWorkspaceDir(): string {
  return readEnv('THEWORLD_WORKSPACE_DIR') ?? join(process.cwd(), 'workspace')
}

function moveFileIfExists(fromPath: string, toPath: string): void {
  if (!existsSync(fromPath) || existsSync(toPath)) return
  try {
    renameSync(fromPath, toPath)
  } catch {
    copyFileSync(fromPath, toPath)
    unlinkSync(fromPath)
  }
}

function migrateLegacyDbFiles(workspaceDir: string): void {
  const currentDbPath = join(workspaceDir, DB_FILENAME)
  const legacyDbPath = join(workspaceDir, LEGACY_DB_FILENAME)
  if (!existsSync(legacyDbPath) || existsSync(currentDbPath)) return

  moveFileIfExists(legacyDbPath, currentDbPath)
  moveFileIfExists(`${legacyDbPath}-wal`, `${currentDbPath}-wal`)
  moveFileIfExists(`${legacyDbPath}-shm`, `${currentDbPath}-shm`)
  moveFileIfExists(`${legacyDbPath}-journal`, `${currentDbPath}-journal`)
}

/** Build LLM provider from environment variables.
 *
 * Reads:
 *   OPENAI_API_KEY   (or THEWORLD_LLM_API_KEY)
 *   THEWORLD_LLM_BASE_URL
 *   THEWORLD_LLM_MODEL
 *
 * Falls back to MockLLMProvider when no API key is set.
 */
function buildLLMProviderFromConfig(cfg: ConfigService): LLMProvider {
  const apiKey = cfg.getLlmApiKey()
  const baseUrl = cfg.getLlmBaseUrl()
  const model = cfg.getLlmModel()

  if (!apiKey) {
    serverLog('WARN', 'cli', 'No LLM API key found. Using MockLLMProvider.')
    serverLog(
      'WARN',
      'cli',
      'Configure via Settings page (LLM → API Key) or set THEWORLD_LLM_API_KEY.',
    )
    return new MockLLMProvider()
  }

  serverLog('INFO', 'cli', `LLM provider: ${baseUrl}  model=${model}`)
  return new OpenAiCompatibleChatProvider({ apiKey, baseUrl, model })
}

/**
 * A proxy LLM provider that delegates to an inner provider.
 * The inner provider can be hot-swapped at runtime (e.g. when API key changes via Settings).
 */
class HotSwappableLLMProvider implements LLMProvider {
  private inner: LLMProvider

  constructor(initial: LLMProvider) {
    this.inner = initial
  }

  swap(next: LLMProvider): void {
    this.inner = next
  }

  generate(request: LLMGenerateRequest): Promise<LLMGenerateResponse> {
    return this.inner.generate(request)
  }
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
    serverLog('ERROR', 'cli', `Failed to parse mcp-registry.json: ${msg}`)
    return
  }

  if (!Array.isArray(registry.servers)) return

  for (const entry of registry.servers) {
    if (!entry.id || !entry.command) {
      serverLog('WARN', 'cli', `Skipping invalid MCP registry entry: ${JSON.stringify(entry)}`)
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
      serverLog('INFO', 'cli', `MCP server connected: ${entry.id}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      serverLog('ERROR', 'cli', `Failed to connect MCP server "${entry.id}": ${msg}`)
    }
  }
}

/**
 * Build the dynamic portion of the system prompt.
 * Called on every LLM turn so:
 *  - Newly created Skills are visible without restart.
 *  - Actual filesystem paths are always up-to-date.
 */
async function buildDynamicSystemPrompt(): Promise<string> {
  const workspaceDir = getWorkspaceDir()
  const projectDir = process.cwd()

  const contextBlock = [
    '',
    '## Runtime Environment',
    `- projectDir (server root): ${projectDir}`,
    `- workspaceDir (data/skills/logs): ${workspaceDir}`,
    `- skillsDir: ${join(workspaceDir, 'skills')}`,
    `- logsDir: ${join(workspaceDir, 'logs')}`,
    '',
    'When using run_command or list_dir, always use these absolute paths.',
    'Do NOT guess paths like "/workspace" — use the values above.',
  ].join('\n')

  const skills = await listSkills()
  const skillBlock =
    skills.length === 0
      ? ''
      : [
          '',
          'You have access to the following Skills (call read_skill to get the full usage doc, then run_script to execute):',
          ...skills.map((s) => `- ${s.skillId}: ${s.description.replace(/\n/g, ' ').trim()}`),
          '',
          'If the Skill you need is not listed above, call list_skills to see the full list.',
        ].join('\n')

  return [contextBlock, skillBlock].filter(Boolean).join('\n')
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
  '- run_script: execute a Skill script (runs once immediately)',
  '- write_skill: create or update a reusable Skill (for future use, NOT for scheduling)',
  '- create_task: create a cron/interval/once task in infrastructure scheduler (preferred for periodic/future requests)',
  '- read_logs: review recent tool-call history',
  '',
  'Important filesystem guidelines:',
  '- Always use ABSOLUTE paths for run_command (cwd), read_file, write_file, list_dir.',
  '- The exact workspaceDir and projectDir are injected below in "## Runtime Environment" — use those values, never guess paths like "/workspace".',
  '',
  '## Task Scheduling vs. One-time Execution',
  '',
  'IMPORTANT: This section applies ONLY when responding to a live user message.',
  'If the ## AUTOMATED TASK EXECUTION section is present below, ignore this scheduling section entirely.',
  '',
  'CRITICAL — Always distinguish between these two scenarios before acting:',
  '',
  '1. User wants something done NOW (one-time): use run_command, read_file, write_file, or run_script directly.',
  '   Example: "帮我查一下天气" → call a tool immediately, respond with the result.',
  '',
  '2. User wants something done PERIODICALLY or in the FUTURE (scheduled): use the built-in "create_task" tool.',
  '   Keywords that indicate scheduling: 每天/每小时/每分钟/每隔/定时/定期/周期性/循环/以后/下次/明天/每周/提醒我/remind me/schedule/recurring.',
  '   Example: "每30分钟提醒我喝水" → call create_task directly.',
  '   Example: "每天早上9点发日报" → call create_task directly.',
  '',
  '   create_task args: {name, agentId:"default", input:"<message to send when task triggers>", triggerType:"interval"|"cron"|"once", triggerConfig:{...}}',
  '   - interval: triggerConfig={"interval_seconds": N} (e.g. 1800 = 30 minutes)',
  '   - cron: triggerConfig={"cron": "0 9 * * 1-5"} (standard 5-field cron, UTC)',
  '   - once: triggerConfig={"once_at": <unix_ms_timestamp>}',
  '   Scheduled tasks run in the background — no immediate response is shown; results appear in Web Console → "定时任务".',
  '',
  '3. write_skill is for creating REUSABLE tool extensions, NOT for reminders or recurring tasks.',
  '   Only use write_skill when the user explicitly asks to "create a skill", "build a tool", or "extend capabilities".',
  '   Do NOT use write_skill to implement a reminder or a periodic action — use create_task instead.',
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
  const workspaceDir = getWorkspaceDir()
  migrateLegacyDbFiles(workspaceDir)

  // Initialise DB first so ConfigService can read persisted overrides
  const db = createDb(join(workspaceDir, DB_FILENAME))
  const configService = new ConfigService(db)
  serverLog('INFO', 'cli', `Config loaded from DB. LLM model: ${configService.getLlmModel()}`)

  // Use a hot-swappable proxy so LLM provider updates when Settings change at runtime
  const llm = new HotSwappableLLMProvider(buildLLMProviderFromConfig(configService))
  configService.onLlmConfigChanged(() => {
    const next = buildLLMProviderFromConfig(configService)
    llm.swap(next)
    serverLog('INFO', 'cli', `LLM provider hot-swapped: model=${configService.getLlmModel()} hasKey=${Boolean(configService.getLlmApiKey())}`)
  })

  const runtime = new InMemoryToolRuntime([
    createBuiltinToolProvider(),
    createTaskInfraToolProvider(db),
    createSkillToolProvider(),
    createSelfManagementToolProvider(),
  ])

  // Restore persisted MCP servers
  await loadMcpRegistry(runtime)

  ensureBuiltinDefaultAgent(db, STATIC_SYSTEM_PROMPT)
  const apiKey = configService.getServerApiKey() || readEnv('THEWORLD_API_KEY')
  const maxBodyBytes = configService.getServerMaxBodyBytes()
  const metrics = createMetricsStore()
  const metricsLlmProviderLabel =
    readEnv('THEWORLD_METRICS_LLM_PROVIDER') ??
    (configService.getLlmApiKey() ? 'openai' : 'mock')

  const { server, streamHub, agent, taskEventBus } = createTheWorldHttpServer({
    definition: {
      id: 'default',
      name: 'HTTP Server Agent',
      // Dynamic factory: re-scans workspace/skills/ on every LLM turn (hot-reload)
      systemPrompt: async () => {
        const dynamicBlock = await buildDynamicSystemPrompt()
        return [STATIC_SYSTEM_PROMPT, dynamicBlock].filter(Boolean).join('\n')
      },
      // maxSteps on AgentDefinition is read at run time via RunOptions; the definition
      // value acts as a fallback only — live value comes from configService getter in taskCtx.
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
    workspaceDir,
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
    defaultMaxSteps: () => configService.getLlmMaxSteps(),
    notifier,
    onTick: ({ ts }) => markHeartbeat('scheduler', ts),
  })

  // Heartbeat: keep SSE connections alive and evict dead clients every 30s
  markHeartbeat('taskSse')
  const heartbeatTimer = setInterval(() => {
    taskEventBus.heartbeat()
    markHeartbeat('taskSse')
  }, 30_000)

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

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      serverLog(
        'ERROR',
        'cli',
        `Port ${port} is already in use. Either stop the other process (e.g. pkill -f "packages/server/src/cli.ts") or start on another port: PORT=3340 pnpm dev:server`,
      )
    } else {
      serverLog('ERROR', 'cli', `Server error: ${err.message}`)
    }
    process.exit(1)
  })

  server.listen(port, () => {
    serverLog('INFO', 'cli', `theworld server listening on http://127.0.0.1:${port}`)
    serverLog('INFO', 'cli', `Logs → ${join(getWorkspaceDir(), 'logs')}`)
    serverLog('INFO', 'cli', `THEWORLD_INTERNAL_PORT=${port}`)
  })
}

void main().catch((err: unknown) => {
  serverLog('ERROR', 'cli', `startup error: ${String(err)}`)
  process.exit(1)
})
