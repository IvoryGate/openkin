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
} from '@openkin/core'

const MAX_FILE_BYTES = 100 * 1024 * 1024 // 100 MB

function getLogsDir(): string {
  const workspaceDir = process.env.OPENKIN_WORKSPACE_DIR ?? join(process.cwd(), 'workspace')
  return join(workspaceDir, 'logs')
}

function todayLogPath(logsDir: string): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return join(logsDir, `agent-${yyyy}-${mm}-${dd}.log`)
}

/** Track approximate written bytes per log path to enforce file size limit. */
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
    // Best-effort: swallow write errors so the server stays up
  }
}

function shortId(traceId: string): string {
  return traceId.slice(-8)
}

function formatStderr(event: LogEvent): string {
  switch (event.type) {
    case 'conversation': {
      const id = shortId(event.traceId)
      if (event.turn === 'user_message') {
        const content = event.message.content.slice(0, 300)
        return `[${id}] 👤 USER      ${content}`
      }
      // assistant_reply: just mark the turn end; full text already in LLM RESPONSE above
      return `[${id}] 🤖 ASSISTANT ✓ (reply logged above)`
    }
    case 'llm_request': {
      const id = shortId(event.traceId)
      // Print full messages in a readable way
      const lines = [`[${id}] ── LLM REQUEST (step=${event.stepIndex}, msgs=${event.messageCount}) ──`]
      for (const m of event.messages) {
        const role = m.role.toUpperCase().padEnd(9)
        const content = m.content.length > 400 ? m.content.slice(0, 400) + '…' : m.content
        lines.push(`         ${role} ${content}`)
      }
      return lines.join('\n')
    }
    case 'llm_response': {
      const id = shortId(event.traceId)
      if (event.toolCalls?.length) {
        return `[${id}] ── LLM RESPONSE (step=${event.stepIndex}, ${event.durationMs}ms) → TOOL_CALLS: ${event.toolCalls.join(', ')}`
      }
      const text = (event.text ?? '').slice(0, 300)
      return `[${id}] ── LLM RESPONSE (step=${event.stepIndex}, ${event.durationMs}ms) → ${text}`
    }
    case 'tool_call':
      if (event.toolName.startsWith('__')) return '' // suppress internal events from stderr
      return `[${shortId(event.traceId)}] 🔧 TOOL CALL  ${event.toolName}  ${JSON.stringify(event.input).slice(0, 200)}`
    case 'tool_result':
      if (event.toolName.startsWith('__')) return ''
      return `[${shortId(event.traceId)}] ✅ TOOL RESULT ${event.toolName}  ${event.durationMs}ms  ${event.isError ? '❌' : ''}  ${event.outputSummary.slice(0, 200)}`
    case 'skill_run':
      return `[${shortId(event.traceId)}] 📦 SKILL  ${event.skillId}/${event.script}  ${event.durationMs}ms  exit=${event.exitCode}`
    case 'mcp_call':
      return `[${shortId(event.traceId)}] 🔌 MCP  ${event.providerId}/${event.toolName}  ${event.durationMs}ms  ${event.isError ? '❌' : '✅'}`
    case 'error':
      return `[${shortId(event.traceId ?? '')}] ❌ ERROR  ${event.message}${event.stack ? '\n' + event.stack : ''}`
  }
}

/**
 * FileLogger: writes structured JSON-Lines events to
 * `$OPENKIN_WORKSPACE_DIR/logs/agent-YYYY-MM-DD.log` and emits
 * human-readable lines to stderr.
 *
 * The file auto-rotates by date. Single-file limit is 100 MB.
 */
export class FileLogger implements Logger {
  private readonly logsDir: string

  constructor(logsDir?: string) {
    this.logsDir = logsDir ?? getLogsDir()
  }

  private emit(event: LogEvent): void {
    const logPath = todayLogPath(this.logsDir)
    appendLine(logPath, event).catch(() => {})
    const line = formatStderr(event)
    if (line) process.stderr.write(line + '\n')
  }

  conversation(event: ConversationLogEvent): void { this.emit(event) }
  llmRequest(event: LLMRequestLogEvent): void { this.emit(event) }
  llmResponse(event: LLMResponseLogEvent): void { this.emit(event) }
  toolCall(event: ToolCallLogEvent): void { this.emit(event) }
  toolResult(event: ToolResultLogEvent): void { this.emit(event) }
  skillRun(event: SkillRunLogEvent): void { this.emit(event) }
  mcpCall(event: McpCallLogEvent): void { this.emit(event) }
  error(event: ErrorLogEvent): void { this.emit(event) }
}
