import { appendFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import type {
  Logger,
  LogEvent,
  ConversationLogEvent,
  LLMRequestLogEvent,
  LLMResponseLogEvent,
  ToolCallLogEvent,
  ToolResultLogEvent,
  SkillRunLogEvent,
  McpCallLogEvent,
  ErrorLogEvent,
} from '@theworld/core'
import { readCompatEnv } from '@theworld/core'

// ── ANSI colour helpers (TTY only) ───────────────────────────────────────────

const isTTY = process.stderr.isTTY === true

function ansi(code: string, text: string): string {
  return isTTY ? `\x1b[${code}m${text}\x1b[0m` : text
}

const C = {
  grey:    (s: string) => ansi('90', s),
  blue:    (s: string) => ansi('34', s),
  cyan:    (s: string) => ansi('36', s),
  green:   (s: string) => ansi('32', s),
  yellow:  (s: string) => ansi('33', s),
  red:     (s: string) => ansi('31', s),
  magenta: (s: string) => ansi('35', s),
  bold:    (s: string) => ansi('1',  s),
  dim:     (s: string) => ansi('2',  s),
}

// ── Level → colour mapping ────────────────────────────────────────────────────

function levelTag(level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'): string {
  switch (level) {
    case 'DEBUG': return C.grey(`[DBG]`)
    case 'INFO':  return C.cyan(`[INF]`)
    case 'WARN':  return C.yellow(`[WRN]`)
    case 'ERROR': return C.red(  `[ERR]`)
  }
}

// ── Timestamp ────────────────────────────────────────────────────────────────

function ts(): string {
  return C.grey(new Date().toISOString().replace('T', ' ').slice(0, 23))
}

function shortId(traceId: string): string {
  return C.dim(`[${traceId.slice(-8)}]`)
}

// ── File logger ───────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 100 * 1024 * 1024 // 100 MB

function getLogsDir(): string {
  const workspaceDir =
    readCompatEnv('THEWORLD_WORKSPACE_DIR', 'OPENKIN_WORKSPACE_DIR') ?? join(process.cwd(), 'workspace')
  return join(workspaceDir, 'logs')
}

function todayLogPath(logsDir: string): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return join(logsDir, `agent-${yyyy}-${mm}-${dd}.log`)
}

const writtenBytes = new Map<string, number>()

async function appendLine(logPath: string, event: LogEvent): Promise<void> {
  const current = writtenBytes.get(logPath) ?? 0
  if (current >= MAX_FILE_BYTES) return
  const line = JSON.stringify(event) + '\n'
  const lineBytes = Buffer.byteLength(line)
  try {
    await mkdir(dirname(logPath), { recursive: true })
    await appendFile(logPath, line, 'utf8')
    writtenBytes.set(logPath, current + lineBytes)
  } catch {
    // best-effort
  }
}

// ── Server log bus (for SSE streaming to web console) ────────────────────────

type LogLineListener = (line: string) => void

class ServerLogBus {
  private listeners = new Set<LogLineListener>()

  subscribe(fn: LogLineListener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  publish(line: string): void {
    for (const fn of this.listeners) {
      try { fn(line) } catch { /* ignore */ }
    }
  }
}

export const serverLogBus = new ServerLogBus()

// ── Unified server log (for cli.ts startup messages) ─────────────────────────

export function serverLog(
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
  source: string,
  message: string,
  extra?: Record<string, unknown>,
): void {
  const structured = JSON.stringify({
    type: 'server',
    level,
    source,
    message,
    ts: Date.now(),
    ...extra,
  })
  const formatted = `${ts()} ${levelTag(level)} ${C.bold(C.blue(`[${source}]`))} ${message}`
  process.stderr.write(formatted + '\n')
  serverLogBus.publish(structured)
}

// ── Format a LogEvent to a readable stderr line ───────────────────────────────

function formatStderr(event: LogEvent): { line: string; level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' } | null {
  switch (event.type) {
    case 'conversation': {
      const id = shortId(event.traceId)
      if (event.turn === 'user_message') {
        const content = C.dim(String(event.message.content).slice(0, 300))
        return { level: 'INFO', line: `${id} ${C.bold('👤 USER')}      ${content}` }
      }
      return { level: 'INFO', line: `${id} ${C.bold('🤖 REPLY')}     ✓` }
    }
    case 'llm_request': {
      const id = shortId(event.traceId)
      const hdr = `${id} ${C.cyan('── LLM REQUEST')} step=${event.stepIndex} msgs=${event.messageCount}`
      const bodyLines = event.messages.map((m) => {
        const role = m.role.toUpperCase().padEnd(9)
        const content = C.dim(m.content.length > 300 ? m.content.slice(0, 300) + '…' : m.content)
        return `         ${C.blue(role)} ${content}`
      })
      return { level: 'DEBUG', line: [hdr, ...bodyLines].join('\n') }
    }
    case 'llm_response': {
      const id = shortId(event.traceId)
      if (event.toolCalls?.length) {
        const calls = C.yellow(event.toolCalls.join(', '))
        return {
          level: 'INFO',
          line: `${id} ${C.cyan('── LLM RESP')} step=${event.stepIndex} ${event.durationMs}ms → ${calls}`,
        }
      }
      const text = C.dim((event.text ?? '').slice(0, 200))
      return {
        level: 'INFO',
        line: `${id} ${C.cyan('── LLM RESP')} step=${event.stepIndex} ${event.durationMs}ms → ${text}`,
      }
    }
    case 'tool_call': {
      if (event.toolName.startsWith('__')) return null
      const id = shortId(event.traceId)
      const args = C.dim(JSON.stringify(event.input).slice(0, 160))
      return { level: 'INFO', line: `${id} ${C.yellow('🔧 TOOL')}      ${C.bold(event.toolName)}  ${args}` }
    }
    case 'tool_result': {
      if (event.toolName.startsWith('__')) return null
      const id = shortId(event.traceId)
      const icon = event.isError ? C.red('❌') : C.green('✅')
      const summary = C.dim(event.outputSummary.slice(0, 160))
      return {
        level: event.isError ? 'ERROR' : 'INFO',
        line: `${id} ${icon} ${C.bold(event.toolName)}  ${event.durationMs}ms  ${summary}`,
      }
    }
    case 'skill_run': {
      const id = shortId(event.traceId)
      const status = event.exitCode === 0 ? C.green(`exit=0`) : C.red(`exit=${event.exitCode}`)
      return {
        level: event.exitCode === 0 ? 'INFO' : 'WARN',
        line: `${id} ${C.magenta('📦 SKILL')}     ${event.skillId}/${event.script}  ${event.durationMs}ms  ${status}`,
      }
    }
    case 'mcp_call': {
      const id = shortId(event.traceId)
      const icon = event.isError ? C.red('❌') : C.green('✅')
      return {
        level: event.isError ? 'WARN' : 'DEBUG',
        line: `${id} ${C.magenta('🔌 MCP')}      ${event.providerId}/${event.toolName}  ${event.durationMs}ms  ${icon}`,
      }
    }
    case 'error': {
      const id = shortId(event.traceId ?? '')
      const stack = event.stack ? C.dim('\n' + event.stack) : ''
      return { level: 'ERROR', line: `${id} ${C.red('❌ ERROR')}     ${event.message}${stack}` }
    }
  }
}

// ── FileLogger ────────────────────────────────────────────────────────────────

/**
 * FileLogger: writes structured JSON-Lines to
 * `$OPENKIN_WORKSPACE_DIR/logs/agent-YYYY-MM-DD.log` and emits
 * colour-coded lines to stderr. Also publishes to `serverLogBus`
 * so the web console can stream them via SSE.
 */
export class FileLogger implements Logger {
  private readonly logsDir: string

  constructor(logsDir?: string) {
    this.logsDir = logsDir ?? getLogsDir()
  }

  private emit(event: LogEvent): void {
    // 1. persist to file
    const logPath = todayLogPath(this.logsDir)
    appendLine(logPath, event).catch(() => {})

    // 2. stderr with colour
    const result = formatStderr(event)
    if (!result) return
    const { line, level } = result
    const prefix = `${ts()} ${levelTag(level)} `
    process.stderr.write(prefix + line + '\n')

    // 3. broadcast to SSE clients (plain JSON, no ANSI)
    serverLogBus.publish(JSON.stringify({ ...event, level }))
  }

  conversation(event: ConversationLogEvent): void   { this.emit(event) }
  llmRequest(event: LLMRequestLogEvent): void        { this.emit(event) }
  llmResponse(event: LLMResponseLogEvent): void      { this.emit(event) }
  toolCall(event: ToolCallLogEvent): void            { this.emit(event) }
  toolResult(event: ToolResultLogEvent): void        { this.emit(event) }
  skillRun(event: SkillRunLogEvent): void            { this.emit(event) }
  mcpCall(event: McpCallLogEvent): void              { this.emit(event) }
  error(event: ErrorLogEvent): void                  { this.emit(event) }
}
