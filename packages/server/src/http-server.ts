import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { readFile, readdir, stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type AgentDto,
  type ApiEnvelope,
  type CreateAgentRequest,
  type CreateRunRequest,
  type CreateSessionRequest,
  type CreateTaskRequest,
  type HealthResponseBody,
  type Message,
  type SessionDto,
  type TaskDto,
  type TaskRunDto,
  type UpdateAgentRequest,
  type UpdateTaskRequest,
  type ListLogsResponseBody,
  type ListToolsResponseBody,
  type ListSkillsApiResponseBody,
  type GetSkillContentResponseBody,
  type ListDbTablesResponseBody,
  type DbQueryResponseBody,
  type McpStatusResponseBody,
  type SystemStatusResponseBody,
  type McpProviderStatusDto,
  type SkillEntryDto,
  type ToolEntryDto,
  createRunError,
  formatSseEvent,
  type StreamEvent,
  apiPathAgents,
  apiPathHealth,
  apiPathRuns,
  apiPathSessions,
  apiPathTasks,
  apiPathSystemStatus,
  apiPathLogs,
  apiPathTools,
  apiPathSkills,
  apiPathDbTables,
  apiPathDbQuery,
} from '@openkin/shared-contracts'
import { formatPrometheusText, type MetricsStore } from './metrics.js'
import { createObservabilityHook } from './observability-hook.js'
import {
  InMemorySessionRegistry,
  OpenKinAgent,
  type AgentDefinition,
  type AgentLifecycleHook,
  type LLMProvider,
  type RunOptions,
  type ToolRuntime,
  type ToolProvider,
  InMemoryToolRuntime,
  McpToolProvider,
} from '@openkin/core'
import type { Db } from './db/index.js'
import type { DbAgentRow, DbScheduledTask, DbTaskRun } from './db/repositories.js'
import { createPersistenceHook } from './persistence-hook.js'
import { computeInitialNextRun, executeTaskRun, validateTaskTrigger } from './scheduler.js'
import { createSseStreamingHook } from './sse-hooks.js'
import { TraceStreamHub } from './trace-stream-hub.js'
import { dbTraceToSummaryDto, dbTraceToTraceDto } from './trace-dto.js'

function flattenMessageContent(msg: Message): string {
  const parts: string[] = []
  for (const p of msg.content) {
    if (p.type === 'text') parts.push(p.text)
    else parts.push(JSON.stringify((p as { type: 'json'; value: unknown }).value))
  }
  return parts.join('')
}

function jsonResponse(
  res: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders?: Record<string, string | number>,
): void {
  const payload = JSON.stringify(body)
  const headers: Record<string, string | number> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...extraHeaders,
  }
  res.writeHead(status, headers)
  res.end(payload)
}

class PayloadTooLargeError extends Error {
  override readonly name = 'PayloadTooLargeError'
}

let cachedPkgVersion: string | null = null
function readRootPackageVersion(): string {
  if (cachedPkgVersion) return cachedPkgVersion
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '../../../package.json')
    cachedPkgVersion = (JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string }).version ?? '0.0.0'
  } catch {
    cachedPkgVersion = '0.0.0'
  }
  return cachedPkgVersion
}

function readJsonBodyLimited(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    req.on('data', (c) => {
      const buf = c as Buffer
      total += buf.length
      if (total > maxBytes) {
        reject(new PayloadTooLargeError())
        req.resume()
        req.on('data', () => {
          /* discard remainder so the socket can finish */
        })
        return
      }
      chunks.push(buf)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function isExemptFromApiKey(pathname: string): boolean {
  if (pathname === apiPathHealth()) return true
  if (pathname.startsWith('/_internal/')) return true
  return false
}

function buildHealthResponse(options: CreateOpenKinHttpServerOptions, startedAt: number): HealthResponseBody {
  let db: HealthResponseBody['db'] = 'not_configured'
  if (options.db) {
    try {
      options.db.ping()
      db = 'connected'
    } catch {
      db = 'unavailable'
    }
  }
  return {
    ok: true,
    version: readRootPackageVersion(),
    db,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    ts: Date.now(),
  }
}

function mapAgentRow(row: DbAgentRow): AgentDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    systemPrompt: row.systemPrompt,
    model: row.model ?? undefined,
    enabled: row.enabled,
    isBuiltin: row.isBuiltin,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function parseJsonField(raw: string | null | undefined): unknown {
  if (raw == null || raw === '') return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return raw
  }
}

function mapDbTaskToDto(task: DbScheduledTask): TaskDto {
  let triggerConfig: Record<string, unknown>
  try {
    triggerConfig = JSON.parse(task.triggerConfig) as Record<string, unknown>
  } catch {
    triggerConfig = {}
  }
  let input: TaskDto['input']
  try {
    const o = JSON.parse(task.input) as { text?: string }
    input = { text: typeof o.text === 'string' ? o.text : '' }
  } catch {
    input = { text: '' }
  }
  return {
    id: task.id,
    name: task.name,
    triggerType: task.triggerType,
    triggerConfig,
    agentId: task.agentId,
    input,
    enabled: task.enabled,
    createdBy: task.createdBy,
    createdAt: task.createdAt,
    nextRunAt: task.nextRunAt,
  }
}

function mapDbTaskRunToDto(row: DbTaskRun): TaskRunDto {
  return {
    id: row.id,
    taskId: row.taskId,
    status: row.status,
    progress: row.progress,
    progressMsg: row.progressMsg,
    output: parseJsonField(row.output),
    error: parseJsonField(row.error),
    traceId: row.traceId,
    sessionId: row.sessionId,
    retryCount: row.retryCount,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
  }
}

function envelopeError(message: string, code: string): ApiEnvelope<never> {
  return {
    ok: false,
    error: createRunError(code, message, 'runtime'),
  }
}

/** Check whether the request originates from loopback (127.0.0.1 or ::1). */
function isLoopback(req: IncomingMessage): boolean {
  const addr = req.socket.remoteAddress ?? ''
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
}

export interface McpServerEntry {
  id: string
  command: string
  args?: string[]
  env?: Record<string, string>
}

export interface CreateOpenKinHttpServerOptions {
  definition: AgentDefinition
  llm: LLMProvider
  toolRuntime: ToolRuntime
  /** Extra lifecycle hooks to add alongside the SSE streaming hook. */
  extraHooks?: AgentLifecycleHook[]
  /** Optional SQLite persistence (sessions, messages, traces). */
  db?: Db
  /** When set, all routes except `GET /health` and `/_internal/*` require `Authorization: Bearer <key>`. */
  apiKey?: string
  /** Max JSON body size for POST handlers (default 1 MiB). */
  maxBodyBytes?: number
  /** In-process metrics for `/metrics` and observability hooks. */
  metrics?: MetricsStore
  /** Label for `openkin_llm_*` metrics (e.g. `openai` vs `mock`). */
  metricsLlmProviderLabel?: string
  /**
   * Workspace directory used for log file and skill directory scanning in debug APIs.
   * Defaults to `$OPENKIN_WORKSPACE_DIR` or `process.cwd()/workspace`.
   */
  workspaceDir?: string
}

export interface OpenKinHttpServer {
  readonly server: Server
  readonly streamHub: TraceStreamHub
  readonly agent: OpenKinAgent
}

// ── 024 helpers ──────────────────────────────────────────────────────────────

function resolveWorkspaceDir(overrideDir?: string): string {
  return overrideDir ?? process.env.OPENKIN_WORKSPACE_DIR ?? join(process.cwd(), 'workspace')
}

/** Format YYYY-MM-DD for today in local time. */
function todayDateString(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

async function readLogLines(logsDir: string, date: string): Promise<string[]> {
  const filePath = join(logsDir, `agent-${date}.log`)
  try {
    const content = await readFile(filePath, 'utf8')
    return content.split('\n').filter(Boolean)
  } catch {
    return []
  }
}

interface SkillScanEntry {
  id: string
  title: string
  description: string
  hasScript: boolean
}

async function scanSkillsDir(skillsDir: string): Promise<SkillScanEntry[]> {
  let dirents: import('node:fs').Dirent[] = []
  try {
    dirents = await readdir(skillsDir, { withFileTypes: true })
  } catch {
    return []
  }
  // Only process directories — plain files (e.g. tsconfig.json) are not skills
  const entries = dirents.filter((d) => d.isDirectory()).map((d) => d.name)
  const results: SkillScanEntry[] = []
  for (const entry of entries) {
    const skillPath = join(skillsDir, entry)
    const mdPath = join(skillPath, 'SKILL.md')
    let title = entry
    let description = ''
    let hasScript = false
    try {
      const content = await readFile(mdPath, 'utf8')
      // Extract first h1 as title
      const h1Match = content.match(/^#\s+(.+)$/m)
      if (h1Match) title = h1Match[1].trim()
      // Extract first paragraph after frontmatter/h1 as description
      const lines = content.replace(/^---[\s\S]*?---\s*/m, '').split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---')) {
          description = trimmed.slice(0, 200)
          break
        }
      }
    } catch {
      // no SKILL.md → still include entry with empty metadata
    }
    try {
      const scriptPath = join(skillPath, 'run.sh')
      await stat(scriptPath)
      hasScript = true
    } catch {
      // no run.sh
    }
    results.push({ id: entry, title, description, hasScript })
  }
  return results
}

// ─────────────────────────────────────────────────────────────────────────────

export function createOpenKinHttpServer(options: CreateOpenKinHttpServerOptions): OpenKinHttpServer {
  const startedAt = Date.now()
  const maxBodyBytes = options.maxBodyBytes ?? 1048576
  const workspaceDir = resolveWorkspaceDir(options.workspaceDir)
  const streamHub = new TraceStreamHub()
  const sseHook = createSseStreamingHook(streamHub)
  const llmLabel = options.metricsLlmProviderLabel ?? 'default'
  const hooks = [
    sseHook,
    ...(options.extraHooks ?? []),
    ...(options.metrics
      ? [createObservabilityHook(options.metrics, { llmProviderLabel: llmLabel })]
      : []),
    ...(options.db ? [createPersistenceHook(options.db)] : []),
  ]
  const agent = new OpenKinAgent(
    options.definition,
    options.llm,
    options.toolRuntime,
    new InMemorySessionRegistry(),
    hooks,
  )

  // Keep a typed reference to the runtime for hot-registration
  const runtime = options.toolRuntime as InMemoryToolRuntime

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const pathname = url.pathname
    const method = req.method ?? 'GET'
    const httpStarted = Date.now()
    res.on('finish', () => {
      const hdr = res.getHeader('x-trace-id')
      const traceId =
        typeof hdr === 'string' ? hdr : Array.isArray(hdr) ? String(hdr[0]) : undefined
      const line = JSON.stringify({
        type: 'http_request',
        method,
        path: pathname,
        status: res.statusCode ?? 0,
        durationMs: Date.now() - httpStarted,
        traceId,
        ts: Date.now(),
      })
      console.error(line)
    })

    // ── CORS ──────────────────────────────────────────────────────────────────
    const origin = req.headers.origin ?? '*'
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }
    // ──────────────────────────────────────────────────────────────────────────

    if (method === 'GET' && pathname === apiPathHealth()) {
      jsonResponse(res, 200, buildHealthResponse(options, startedAt))
      return
    }

    if (options.apiKey && !isExemptFromApiKey(pathname)) {
      if (req.headers.authorization !== `Bearer ${options.apiKey}`) {
        jsonResponse(res, 401, envelopeError('Unauthorized', 'UNAUTHORIZED'))
        return
      }
    }

    try {
      if (method === 'GET' && pathname === '/metrics') {
        if (!options.metrics) {
          jsonResponse(res, 503, envelopeError('Metrics not configured', 'UNAVAILABLE'))
          return
        }
        const body = formatPrometheusText(options.metrics)
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': Buffer.byteLength(body) })
        res.end(body)
        return
      }

      // ──────────────────────────────────────────────────────────────────────
      // Debug & Introspection API (exec plan 024)
      // ──────────────────────────────────────────────────────────────────────

      // GET /v1/system/status
      if (method === 'GET' && pathname === apiPathSystemStatus()) {
        let dbStatus: SystemStatusResponseBody['db'] = 'not_configured'
        if (options.db) {
          try {
            options.db.ping()
            dbStatus = 'connected'
          } catch {
            dbStatus = 'unavailable'
          }
        }
        const providers = typeof runtime.getProviders === 'function' ? runtime.getProviders() : []
        let builtinCount = 0
        let mcpCount = 0
        for (const p of providers) {
          const tools = await p.listTools()
          if (p.sourceType === 'mcp') mcpCount += tools.length
          else builtinCount += tools.length
        }
        const skillsDir = join(workspaceDir, 'skills')
        const skillEntries = await scanSkillsDir(skillsDir)
        const mcpProviders: McpProviderStatusDto[] = []
        for (const p of providers) {
          if (p.sourceType !== 'mcp') continue
          let toolCount = 0
          try {
            const tools = await p.listTools()
            toolCount = tools.length
          } catch {
            // ignore
          }
          const mcpP = p as unknown as { _connected?: boolean }
          mcpProviders.push({
            id: p.id,
            status: mcpP._connected === true ? 'connected' : 'disconnected',
            toolCount,
          })
        }
        const statusBody: SystemStatusResponseBody = {
          version: readRootPackageVersion(),
          uptime: Math.floor((Date.now() - startedAt) / 1000),
          db: dbStatus,
          activeSessions: agent.activeSessionCount(),
          tools: {
            builtin: builtinCount,
            mcp: mcpCount,
            total: builtinCount + mcpCount,
          },
          skills: {
            loaded: skillEntries.length,
            list: skillEntries.map((s) => s.id),
          },
          mcpProviders,
          ts: Date.now(),
        }
        jsonResponse(res, 200, { ok: true, data: statusBody })
        return
      }

      // GET /v1/logs
      if (method === 'GET' && pathname === apiPathLogs()) {
        const logsDir = join(workspaceDir, 'logs')
        const params = url.searchParams
        const date = params.get('date') ?? todayDateString()
        // Validate date format to prevent path traversal
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          jsonResponse(res, 400, envelopeError('Invalid date format (expected YYYY-MM-DD)', 'INVALID_REQUEST'))
          return
        }
        const levelFilter = params.get('level')
        const limitParam = params.get('limit')
        const beforeParam = params.get('before')
        const searchParam = params.get('search')
        const limit = Math.min(Number(limitParam ?? 100), 500)
        const before = beforeParam ? Number(beforeParam) : undefined
        const rawLines = await readLogLines(logsDir, date)
        const parsed = rawLines.flatMap((line) => {
          try {
            return [JSON.parse(line) as Record<string, unknown>]
          } catch {
            return []
          }
        })
        const filtered = parsed.filter((entry) => {
          if (levelFilter && entry.level !== levelFilter) return false
          if (before !== undefined) {
            const ts = typeof entry.ts === 'number' ? entry.ts : 0
            if (ts >= before) return false
          }
          if (searchParam) {
            const msg = typeof entry.message === 'string' ? entry.message : JSON.stringify(entry)
            if (!msg.includes(searchParam)) return false
          }
          return true
        })
        const hasMore = filtered.length > limit
        const slice = filtered.slice(0, limit)
        const logs = slice.map((entry) => {
          const dto: Record<string, unknown> = { ...entry }
          if (typeof dto.message === 'string' && dto.message.length > 500) {
            dto.message = dto.message.slice(0, 500)
          }
          return dto
        })
        const logsBody: ListLogsResponseBody = { logs: logs as import('@openkin/shared-contracts').LogEntryDto[], hasMore }
        jsonResponse(res, 200, { ok: true, data: logsBody })
        return
      }

      // GET /v1/tools
      if (method === 'GET' && pathname === apiPathTools()) {
        const providers = typeof runtime.getProviders === 'function' ? runtime.getProviders() : []
        const toolEntries: ToolEntryDto[] = []
        for (const provider of providers) {
          const tools = await provider.listTools()
          for (const tool of tools) {
            const metaSource = (tool.metadata as Record<string, unknown> | undefined)?.sourceType
            const source: ToolEntryDto['source'] =
              metaSource === 'mcp' ? 'mcp'
              : metaSource === 'skill' ? 'skill'
              : provider.sourceType === 'mcp' ? 'mcp'
              : provider.sourceType === 'skill' ? 'skill'
              : provider.sourceType === 'custom' ? 'custom'
              : 'builtin'
            const providerId = source === 'mcp' ? provider.id : undefined
            toolEntries.push({
              name: tool.name,
              description: tool.description,
              source,
              ...(providerId !== undefined ? { providerId } : {}),
              ...(tool.inputSchema ? { parameters: tool.inputSchema } : {}),
            })
          }
        }
        const toolsBody: ListToolsResponseBody = { tools: toolEntries }
        jsonResponse(res, 200, { ok: true, data: toolsBody })
        return
      }

      // GET /v1/skills
      if (method === 'GET' && pathname === apiPathSkills()) {
        const skillsDir = join(workspaceDir, 'skills')
        const skills = await scanSkillsDir(skillsDir)
        const skillEntries: SkillEntryDto[] = skills.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          hasScript: s.hasScript,
        }))
        const skillsBody: ListSkillsApiResponseBody = { skills: skillEntries }
        jsonResponse(res, 200, { ok: true, data: skillsBody })
        return
      }

      // GET /v1/skills/:id/content — return SKILL.md raw text
      {
        const skillContentMatch = pathname.match(/^\/v1\/skills\/([^/]+)\/content$/)
        if (method === 'GET' && skillContentMatch) {
          const skillId = decodeURIComponent(skillContentMatch[1])
          // Prevent path traversal
          if (skillId.includes('..') || skillId.includes('/')) {
            jsonResponse(res, 400, envelopeError('Invalid skill id', 'INVALID_REQUEST'))
            return
          }
          const mdPath = join(workspaceDir, 'skills', skillId, 'SKILL.md')
          try {
            const content = await readFile(mdPath, 'utf8')
            const skillContentBody: GetSkillContentResponseBody = { id: skillId, content }
            jsonResponse(res, 200, { ok: true, data: skillContentBody })
          } catch {
            jsonResponse(res, 404, envelopeError('Skill not found', 'NOT_FOUND'))
          }
          return
        }
      }

      // ── DB Inspect API (read-only) ────────────────────────────────────────

      // GET /v1/db/tables
      if (method === 'GET' && pathname === apiPathDbTables()) {
        if (!options.db) {
          jsonResponse(res, 503, envelopeError('Database not configured', 'UNAVAILABLE'))
          return
        }
        const tables = options.db.listTables()
        const body: ListDbTablesResponseBody = { tables }
        jsonResponse(res, 200, { ok: true, data: body })
        return
      }

      // POST /v1/db/query
      if (method === 'POST' && pathname === apiPathDbQuery()) {
        if (!options.db) {
          jsonResponse(res, 503, envelopeError('Database not configured', 'UNAVAILABLE'))
          return
        }
        const rawBody = (await readJsonBodyLimited(req, maxBodyBytes)) as { sql?: unknown; limit?: unknown }
        const sql = typeof rawBody.sql === 'string' ? rawBody.sql.trim() : ''
        if (!sql) {
          jsonResponse(res, 400, envelopeError('sql is required', 'INVALID_REQUEST'))
          return
        }
        const maxRows = typeof rawBody.limit === 'number' ? Math.min(rawBody.limit, 500) : 200
        try {
          const { columns, rows } = options.db.rawQuery(sql, maxRows)
          const body: DbQueryResponseBody = {
            columns,
            rows,
            rowCount: rows.length,
            truncated: rows.length >= maxRows,
          }
          jsonResponse(res, 200, { ok: true, data: body })
        } catch (e) {
          jsonResponse(res, 400, envelopeError(e instanceof Error ? e.message : String(e), 'INVALID_REQUEST'))
        }
        return
      }

      // ──────────────────────────────────────────────────────────────────────
      // /_internal/mcp/* — loopback-only management API
      // ──────────────────────────────────────────────────────────────────────
      if (pathname.startsWith('/_internal/mcp/')) {
        if (!isLoopback(req)) {
          jsonResponse(res, 403, envelopeError('Forbidden: internal API is loopback-only', 'FORBIDDEN'))
          return
        }

        // GET /_internal/mcp/list
        if (method === 'GET' && pathname === '/_internal/mcp/list') {
          // Return provider ids that are MCP-type (we track in the runtime)
          const view = await runtime.getRuntimeView({
            agent: options.definition,
            session: { id: '__internal__', kind: 'chat' },
            state: {
              traceId: '__internal__',
              sessionId: '__internal__',
              agentId: options.definition.id,
              stepIndex: 0,
              toolCallCount: 0,
              status: 'running',
              steps: [],
              startedAt: Date.now(),
            },
          })
          const tools = view.getToolSchemaList()
          jsonResponse(res, 200, { ok: true, data: { tools: tools.map((t) => t.name) } })
          return
        }

        // POST /_internal/mcp/register
        if (method === 'POST' && pathname === '/_internal/mcp/register') {
          const body = (await readJsonBodyLimited(req, maxBodyBytes)) as unknown as McpServerEntry
          const { id, command, args, env } = body

          if (!id || !command) {
            jsonResponse(res, 400, envelopeError('id and command are required', 'INVALID_REQUEST'))
            return
          }

          const provider = new McpToolProvider({
            id: String(id),
            command: String(command),
            args: Array.isArray(args) ? (args as string[]) : [],
            env: (env as Record<string, string>) ?? {},
          })

          try {
            await provider.connect()
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            jsonResponse(res, 500, envelopeError(`Failed to connect MCP server: ${msg}`, 'MCP_CONNECT_FAILED'))
            return
          }

          if (typeof runtime.registerProvider === 'function') {
            runtime.registerProvider(provider as unknown as ToolProvider)
          }
          jsonResponse(res, 200, { ok: true, data: { id } })
          return
        }

        // POST /_internal/mcp/unregister
        if (method === 'POST' && pathname === '/_internal/mcp/unregister') {
          const body = (await readJsonBodyLimited(req, maxBodyBytes)) as Record<string, unknown>
          const id = body.id

          if (!id || typeof id !== 'string') {
            jsonResponse(res, 400, envelopeError('id is required', 'INVALID_REQUEST'))
            return
          }

          if (typeof runtime.unregisterProvider === 'function') {
            runtime.unregisterProvider(id)
          }
          jsonResponse(res, 200, { ok: true, data: { id } })
          return
        }

        // GET /_internal/mcp/status
        if (method === 'GET' && pathname === '/_internal/mcp/status') {
          const providers = typeof runtime.getProviders === 'function' ? runtime.getProviders() : []
          const mcpProviders: McpProviderStatusDto[] = []
          for (const p of providers) {
            if (p.sourceType !== 'mcp') continue
            let toolCount = 0
            try {
              const tools = await p.listTools()
              toolCount = tools.length
            } catch {
              // ignore
            }
            // McpToolProvider exposes _connected via duck-typing; cast to access it
            const mcpP = p as unknown as { _connected?: boolean }
            mcpProviders.push({
              id: p.id,
              status: mcpP._connected === true ? 'connected' : 'disconnected',
              toolCount,
            })
          }
          const body: McpStatusResponseBody = { providers: mcpProviders }
          jsonResponse(res, 200, { ok: true, data: body })
          return
        }

        jsonResponse(res, 404, envelopeError('Not found', 'NOT_FOUND'))
        return
      }

      // ──────────────────────────────────────────────────────────────────────
      // Public API
      // ──────────────────────────────────────────────────────────────────────
      // --- /v1/agents (operator surface; requires DB) ---
      if (pathname === apiPathAgents() || pathname.startsWith(`${apiPathAgents()}/`)) {
        if (!options.db) {
          jsonResponse(res, 503, envelopeError('Agents API requires database', 'UNAVAILABLE'))
          return
        }
        const db = options.db

        if (method === 'GET' && pathname === apiPathAgents()) {
          const agents = db.agents.listAll().map(mapAgentRow)
          jsonResponse(res, 200, { ok: true, data: { agents } })
          return
        }

        if (method === 'POST' && pathname === apiPathAgents()) {
          const raw = (await readJsonBodyLimited(req, maxBodyBytes)) as CreateAgentRequest
          if (!raw.name || !raw.systemPrompt) {
            jsonResponse(res, 400, envelopeError('name and systemPrompt are required', 'INVALID_REQUEST'))
            return
          }
          const id = raw.id ?? randomUUID()
          if (db.agents.findById(id)) {
            jsonResponse(res, 409, envelopeError('Agent id already exists', 'CONFLICT'))
            return
          }
          const now = Date.now()
          db.agents.insert({
            id,
            name: raw.name,
            description: raw.description ?? null,
            systemPrompt: raw.systemPrompt,
            model: raw.model ?? null,
            enabled: true,
            isBuiltin: false,
            createdAt: now,
            updatedAt: now,
          })
          const row = db.agents.findById(id)
          jsonResponse(res, 201, { ok: true, data: { agent: mapAgentRow(row!) } })
          return
        }

        const rest = pathname.slice(apiPathAgents().length + 1)
        const parts = rest.split('/').filter(Boolean)

        if (parts.length === 2 && parts[1] === 'enable' && method === 'POST') {
          const agentId = decodeURIComponent(parts[0])
          const now = Date.now()
          if (!db.agents.setEnabled(agentId, true, now)) {
            jsonResponse(res, 404, envelopeError('Agent not found', 'NOT_FOUND'))
            return
          }
          jsonResponse(res, 200, { ok: true, data: { id: agentId, enabled: true } })
          return
        }

        if (parts.length === 2 && parts[1] === 'disable' && method === 'POST') {
          const agentId = decodeURIComponent(parts[0])
          const now = Date.now()
          if (!db.agents.setEnabled(agentId, false, now)) {
            jsonResponse(res, 404, envelopeError('Agent not found', 'NOT_FOUND'))
            return
          }
          jsonResponse(res, 200, { ok: true, data: { id: agentId, enabled: false } })
          return
        }

        if (parts.length === 1) {
          const agentId = decodeURIComponent(parts[0])

          if (method === 'GET') {
            const row = db.agents.findById(agentId)
            if (!row) {
              jsonResponse(res, 404, envelopeError('Agent not found', 'NOT_FOUND'))
              return
            }
            jsonResponse(res, 200, { ok: true, data: { agent: mapAgentRow(row) } })
            return
          }

          if (method === 'PUT') {
            const raw = (await readJsonBodyLimited(req, maxBodyBytes)) as UpdateAgentRequest
            const row = db.agents.findById(agentId)
            if (!row) {
              jsonResponse(res, 404, envelopeError('Agent not found', 'NOT_FOUND'))
              return
            }
            const now = Date.now()
            db.agents.update(agentId, {
              name: raw.name,
              description: raw.description,
              systemPrompt: raw.systemPrompt,
              model: raw.model,
              updatedAt: now,
            })
            const next = db.agents.findById(agentId)
            jsonResponse(res, 200, { ok: true, data: { agent: mapAgentRow(next!) } })
            return
          }

          if (method === 'DELETE') {
            const result = db.agents.deleteById(agentId)
            if (result === 'not_found') {
              jsonResponse(res, 404, envelopeError('Agent not found', 'NOT_FOUND'))
              return
            }
            if (result === 'forbidden_builtin') {
              jsonResponse(res, 403, envelopeError('Cannot delete built-in agent', 'FORBIDDEN'))
              return
            }
            res.writeHead(204)
            res.end()
            return
          }
        }

        jsonResponse(res, 404, envelopeError('Not found', 'NOT_FOUND'))
        return
      }

      // --- /v1/tasks (requires DB) ---
      {
        const tasksPrefix = apiPathTasks()
        if (pathname === tasksPrefix || pathname.startsWith(`${tasksPrefix}/`)) {
          if (!options.db) {
            jsonResponse(res, 503, envelopeError('Tasks API requires database', 'UNAVAILABLE'))
            return
          }
          const db = options.db
          const defaultMaxSteps = options.definition.maxSteps ?? 12
          const taskCtx = { db, agent, streamHub, defaultMaxSteps }

          const rest = pathname.slice(tasksPrefix.length + 1)
          const parts = rest.split('/').filter(Boolean)

          if (parts.length === 0) {
            if (method === 'GET') {
              const tasks = db.tasks.listAll().map(mapDbTaskToDto)
              jsonResponse(res, 200, { ok: true, data: { tasks } })
              return
            }
            if (method === 'POST') {
              const raw = (await readJsonBodyLimited(req, maxBodyBytes)) as CreateTaskRequest
              if (!raw.name || !raw.triggerType || !raw.agentId || !raw.input?.text) {
                jsonResponse(res, 400, envelopeError('name, triggerType, agentId, and input.text are required', 'INVALID_REQUEST'))
                return
              }
              const triggerConfigObj = raw.triggerConfig ?? {}
              const err = validateTaskTrigger(raw.triggerType, triggerConfigObj)
              if (err) {
                jsonResponse(res, 400, envelopeError(err, 'INVALID_REQUEST'))
                return
              }
              if (!db.agents.findById(raw.agentId)) {
                jsonResponse(res, 404, envelopeError('Agent not found', 'NOT_FOUND'))
                return
              }
              const id = randomUUID()
              const now = Date.now()
              const cfgStr = JSON.stringify(triggerConfigObj)
              const inputStr = JSON.stringify({ text: raw.input.text })
              const nextRunAt = computeInitialNextRun(raw.triggerType, cfgStr, now)
              db.tasks.insert({
                id,
                name: raw.name,
                triggerType: raw.triggerType,
                triggerConfig: cfgStr,
                agentId: raw.agentId,
                input: inputStr,
                enabled: raw.enabled !== false,
                createdBy: raw.createdBy ?? 'user',
                createdAt: now,
                nextRunAt,
              })
              const row = db.tasks.findById(id)
              jsonResponse(res, 201, { ok: true, data: { task: mapDbTaskToDto(row!) } })
              return
            }
          }

          if (parts.length === 1) {
            const taskId = decodeURIComponent(parts[0])
            if (method === 'GET') {
              const row = db.tasks.findById(taskId)
              if (!row) {
                jsonResponse(res, 404, envelopeError('Task not found', 'NOT_FOUND'))
                return
              }
              jsonResponse(res, 200, { ok: true, data: { task: mapDbTaskToDto(row) } })
              return
            }
            if (method === 'PUT') {
              const raw = (await readJsonBodyLimited(req, maxBodyBytes)) as UpdateTaskRequest
              const cur = db.tasks.findById(taskId)
              if (!cur) {
                jsonResponse(res, 404, envelopeError('Task not found', 'NOT_FOUND'))
                return
              }
              const nextType = raw.triggerType ?? cur.triggerType
              let nextCfgStr = cur.triggerConfig
              if (raw.triggerConfig !== undefined) {
                nextCfgStr = JSON.stringify(raw.triggerConfig)
              }
              let cfgObj: Record<string, unknown>
              try {
                cfgObj =
                  raw.triggerConfig !== undefined
                    ? (raw.triggerConfig as Record<string, unknown>)
                    : (JSON.parse(cur.triggerConfig) as Record<string, unknown>)
              } catch {
                jsonResponse(res, 400, envelopeError('Invalid trigger_config JSON', 'INVALID_REQUEST'))
                return
              }
              const err = validateTaskTrigger(nextType, cfgObj)
              if (err) {
                jsonResponse(res, 400, envelopeError(err, 'INVALID_REQUEST'))
                return
              }
              if (raw.agentId !== undefined && !db.agents.findById(raw.agentId)) {
                jsonResponse(res, 404, envelopeError('Agent not found', 'NOT_FOUND'))
                return
              }
              const patchInput =
                raw.input !== undefined ? JSON.stringify({ text: raw.input.text }) : undefined
              db.tasks.update(taskId, {
                name: raw.name,
                triggerType: raw.triggerType,
                triggerConfig: raw.triggerConfig !== undefined ? nextCfgStr : undefined,
                agentId: raw.agentId,
                input: patchInput,
                enabled: raw.enabled,
              })
              let nextRunPatch: number | null | undefined
              if (raw.triggerType !== undefined || raw.triggerConfig !== undefined) {
                const t = db.tasks.findById(taskId)!
                nextRunPatch = computeInitialNextRun(t.triggerType, t.triggerConfig, Date.now())
              }
              if (nextRunPatch !== undefined) {
                db.tasks.update(taskId, { nextRunAt: nextRunPatch })
              }
              const row = db.tasks.findById(taskId)
              jsonResponse(res, 200, { ok: true, data: { task: mapDbTaskToDto(row!) } })
              return
            }
            if (method === 'DELETE') {
              const ok = db.tasks.deleteById(taskId)
              if (!ok) {
                jsonResponse(res, 404, envelopeError('Task not found', 'NOT_FOUND'))
                return
              }
              res.writeHead(204)
              res.end()
              return
            }
          }

          if (parts.length === 2) {
            const taskId = decodeURIComponent(parts[0])
            const sub = parts[1]
            if (sub === 'enable' && method === 'POST') {
              if (!db.tasks.findById(taskId)) {
                jsonResponse(res, 404, envelopeError('Task not found', 'NOT_FOUND'))
                return
              }
              db.tasks.update(taskId, { enabled: true })
              jsonResponse(res, 200, { ok: true, data: { id: taskId, enabled: true } })
              return
            }
            if (sub === 'disable' && method === 'POST') {
              if (!db.tasks.findById(taskId)) {
                jsonResponse(res, 404, envelopeError('Task not found', 'NOT_FOUND'))
                return
              }
              db.tasks.update(taskId, { enabled: false })
              jsonResponse(res, 200, { ok: true, data: { id: taskId, enabled: false } })
              return
            }
            if (sub === 'trigger' && method === 'POST') {
              const row = db.tasks.findById(taskId)
              if (!row) {
                jsonResponse(res, 404, envelopeError('Task not found', 'NOT_FOUND'))
                return
              }
              try {
                const out = await executeTaskRun(taskCtx, row, 'manual')
                jsonResponse(res, 202, { ok: true, data: out })
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e)
                jsonResponse(res, 400, envelopeError(msg, 'INVALID_REQUEST'))
              }
              return
            }
            if (sub === 'runs' && method === 'GET') {
              if (!db.tasks.findById(taskId)) {
                jsonResponse(res, 404, envelopeError('Task not found', 'NOT_FOUND'))
                return
              }
              const runs = db.taskRuns.listByTaskId(taskId).map(mapDbTaskRunToDto)
              jsonResponse(res, 200, { ok: true, data: { runs } })
              return
            }
          }

          if (parts.length === 3 && parts[1] === 'runs' && method === 'GET') {
            const taskId = decodeURIComponent(parts[0])
            const runId = decodeURIComponent(parts[2])
            if (!db.tasks.findById(taskId)) {
              jsonResponse(res, 404, envelopeError('Task not found', 'NOT_FOUND'))
              return
            }
            const run = db.taskRuns.findById(runId)
            if (!run || run.taskId !== taskId) {
              jsonResponse(res, 404, envelopeError('Run not found', 'NOT_FOUND'))
              return
            }
            jsonResponse(res, 200, { ok: true, data: { run: mapDbTaskRunToDto(run) } })
            return
          }

          jsonResponse(res, 404, envelopeError('Not found', 'NOT_FOUND'))
          return
        }
      }

      if (method === 'POST' && pathname === apiPathSessions()) {
        const raw = (await readJsonBodyLimited(req, maxBodyBytes)) as CreateSessionRequest
        const kind = raw.kind ?? 'chat'
        const id = randomUUID()
        const createdAt = Date.now()
        agent.createSession({ id, kind })
        if (options.db) {
          options.db.sessions.insert({
            id,
            kind,
            agentId: options.definition.id,
            createdAt,
          })
        }
        const body: ApiEnvelope<{ session: { id: string; kind: typeof kind } }> = {
          ok: true,
          data: { session: { id, kind } },
        }
        jsonResponse(res, 201, body)
        return
      }

      if (method === 'GET' && pathname === apiPathSessions()) {
        if (!options.db) {
          jsonResponse(res, 200, { ok: true, data: { sessions: [], total: 0 } })
          return
        }
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20))
        const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0)
        const all = options.db.sessions.listAll().sort((a, b) => b.createdAt - a.createdAt)
        const total = all.length
        const page = all.slice(offset, offset + limit)
        const sessions: SessionDto[] = page.map((s) => ({
          id: s.id,
          kind: s.kind as SessionDto['kind'],
        }))
        jsonResponse(res, 200, { ok: true, data: { sessions, total } })
        return
      }

      {
        const sessPrefix = `${apiPathSessions()}/`
        if (pathname.startsWith(sessPrefix)) {
          const rest = pathname.slice(sessPrefix.length)
          const parts = rest.split('/').filter(Boolean)

          if (method === 'GET' && parts.length === 2 && parts[1] === 'traces') {
            const sessionId = decodeURIComponent(parts[0])
            if (!options.db) {
              jsonResponse(res, 200, { ok: true, data: { traces: [], hasMore: false } })
              return
            }
            if (!options.db.sessions.findById(sessionId)) {
              jsonResponse(res, 404, envelopeError('Session not found', 'NOT_FOUND'))
              return
            }
            const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20))
            const beforeParam = url.searchParams.get('before')
            const before =
              beforeParam != null && beforeParam !== '' ? Number(beforeParam) : undefined
            const all = options.db.traces.listBySession(sessionId)
            const sorted = all.slice().sort((a, b) => b.createdAt - a.createdAt)
            let windowList = sorted
            if (before !== undefined && !Number.isNaN(before)) {
              windowList = sorted.filter((t) => t.createdAt < before)
            }
            const hasMore = windowList.length > limit
            const chunk = windowList.slice(0, limit)
            const traces = chunk.map(dbTraceToSummaryDto)
            jsonResponse(res, 200, { ok: true, data: { traces, hasMore } })
            return
          }

          if (method === 'GET' && parts.length === 2 && parts[1] === 'messages') {
            const sessionId = decodeURIComponent(parts[0])
            if (!options.db) {
              jsonResponse(res, 200, { ok: true, data: { messages: [], hasMore: false } })
              return
            }
            if (!options.db.sessions.findById(sessionId)) {
              jsonResponse(res, 404, envelopeError('Session not found', 'NOT_FOUND'))
              return
            }
            const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 50))
            const beforeParam = url.searchParams.get('before')
            const before =
              beforeParam != null && beforeParam !== '' ? Number(beforeParam) : undefined
            const all = options.db.messages.listBySession(sessionId)
            const sorted = all.slice().sort((a, b) => a.createdAt - b.createdAt)
            let windowMsgs = sorted
            if (before !== undefined && !Number.isNaN(before)) {
              windowMsgs = sorted.filter((m) => m.createdAt < before)
            }
            const hasMore = windowMsgs.length > limit
            const chunk = windowMsgs.slice(-limit)
            const messages = chunk.map((m) => ({
              id: m.id,
              sessionId: m.sessionId,
              role: m.role,
              content: m.content,
              createdAt: m.createdAt,
            }))
            jsonResponse(res, 200, { ok: true, data: { messages, hasMore } })
            return
          }

          if (method === 'DELETE' && parts.length === 1) {
            const sessionId = decodeURIComponent(parts[0])
            if (!options.db) {
              jsonResponse(res, 404, envelopeError('Session not found', 'NOT_FOUND'))
              return
            }
            const deleted = options.db.sessions.deleteById(sessionId)
            if (!deleted) {
              jsonResponse(res, 404, envelopeError('Session not found', 'NOT_FOUND'))
              return
            }
            res.writeHead(204)
            res.end()
            return
          }

          if (method === 'GET' && parts.length === 1) {
            const sessionId = decodeURIComponent(parts[0])
            if (options.db) {
              const row = options.db.sessions.findById(sessionId)
              if (row) {
                jsonResponse(res, 200, {
                  ok: true,
                  data: { session: { id: row.id, kind: row.kind as SessionDto['kind'] } },
                })
                return
              }
              jsonResponse(res, 404, envelopeError('Session not found', 'NOT_FOUND'))
              return
            }
            const session = agent.getSession(sessionId)
            if (session) {
              jsonResponse(res, 200, { ok: true, data: { session: { id: session.id, kind: session.kind } } })
              return
            }
            jsonResponse(res, 404, envelopeError('Session not found', 'NOT_FOUND'))
            return
          }
        }
      }

      if (method === 'POST' && pathname === apiPathRuns()) {
        const raw = (await readJsonBodyLimited(req, maxBodyBytes)) as CreateRunRequest
        const sessionId = raw.sessionId
        const text = raw.input?.text
        if (!sessionId || typeof text !== 'string') {
          jsonResponse(res, 400, envelopeError('sessionId and input.text are required', 'INVALID_REQUEST'))
          return
        }
        if (!agent.getSession(sessionId)) {
          jsonResponse(res, 404, envelopeError('Session not found', 'NOT_FOUND'))
          return
        }
        const traceId = `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        streamHub.reserve(traceId)

        const runOpts: RunOptions = { traceId }
        if (raw.agentId !== undefined && raw.agentId !== null && raw.agentId !== '') {
          if (!options.db) {
            jsonResponse(res, 503, envelopeError('agentId requires database', 'UNAVAILABLE'))
            return
          }
          const arow = options.db.agents.findById(String(raw.agentId))
          if (!arow) {
            jsonResponse(res, 404, envelopeError('Agent not found', 'NOT_FOUND'))
            return
          }
          if (!arow.enabled) {
            jsonResponse(res, 400, envelopeError('Agent is disabled', 'AGENT_DISABLED'))
            return
          }
          runOpts.agentDefinition = {
            id: arow.id,
            name: arow.name,
            systemPrompt: arow.systemPrompt,
            maxSteps: options.definition.maxSteps,
          }
        }

        if (options.db) {
          options.db.messages.insert({
            id: randomUUID(),
            sessionId,
            role: 'user',
            content: text,
            createdAt: Date.now(),
          })
        }

        const db = options.db
        void agent
          .run(sessionId, text, runOpts)
          .then((result) => {
            if (!db) return
            if (result.status === 'completed' && result.output) {
              const content = flattenMessageContent(result.output)
              if (content) {
                db.messages.insert({
                  id: randomUUID(),
                  sessionId,
                  role: 'assistant',
                  content,
                  createdAt: Date.now(),
                })
              }
            }
          })
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err)
            const failed: StreamEvent = {
              type: 'run_failed',
              traceId,
              payload: { message, raw: String(err) },
            }
            streamHub.emit(traceId, failed)
          })

        jsonResponse(
          res,
          202,
          {
            ok: true,
            data: { traceId, sessionId },
          },
          { 'X-Trace-Id': traceId },
        )
        return
      }

      if (
        method === 'GET' &&
        pathname.startsWith(`${apiPathRuns()}/`) &&
        !pathname.endsWith('/stream')
      ) {
        const rest = pathname.slice(apiPathRuns().length + 1)
        if (!rest || rest.includes('/')) {
          jsonResponse(res, 404, envelopeError('Not found', 'NOT_FOUND'))
          return
        }
        const traceId = decodeURIComponent(rest)
        if (!options.db) {
          jsonResponse(res, 404, envelopeError('Trace not found', 'NOT_FOUND'))
          return
        }
        const row = options.db.traces.findByTraceId(traceId)
        if (!row) {
          jsonResponse(res, 404, envelopeError('Trace not found', 'NOT_FOUND'))
          return
        }
        const dto = dbTraceToTraceDto(row)
        jsonResponse(res, 200, { ok: true, data: dto })
        return
      }

      if (method === 'GET' && pathname.endsWith('/stream') && pathname.startsWith(`${apiPathRuns()}/`)) {
        const withoutRuns = pathname.slice(apiPathRuns().length + 1)
        const traceId = decodeURIComponent(withoutRuns.replace(/\/stream$/, ''))
        if (!traceId || !streamHub.isKnown(traceId)) {
          jsonResponse(res, 404, envelopeError('Run stream not found', 'NOT_FOUND'))
          return
        }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        })

        streamHub.subscribe(traceId, (event) => {
          res.write(formatSseEvent(event))
          if (event.type === 'run_completed' || event.type === 'run_failed') {
            res.end()
          }
        })
        return
      }

      jsonResponse(res, 404, envelopeError('Not found', 'NOT_FOUND'))
    } catch (e) {
      if (e instanceof PayloadTooLargeError) {
        jsonResponse(res, 413, envelopeError('Payload Too Large', 'PAYLOAD_TOO_LARGE'))
        return
      }
      jsonResponse(res, 400, envelopeError('Invalid JSON body', 'INVALID_REQUEST'))
    }
  })

  return { server, streamHub, agent }
}
