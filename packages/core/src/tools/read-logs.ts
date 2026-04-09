import { open } from 'node:fs/promises'
import { join } from 'node:path'
import { createRunError } from '@theworld/shared-contracts'
import type { ToolDefinition, ToolExecutor, ToolExecutionContext } from '../tool-runtime.js'
import type { ToolResult } from '@theworld/shared-contracts'
import { readEnv } from '../env.js'
import type { LogEvent } from '../logger.js'

const MAX_LIMIT = 100
const DEFAULT_LIMIT = 20
/** Max bytes to read from the end of the log file (4 MB) */
const TAIL_BYTES = 4 * 1024 * 1024

function getLogsDir(): string {
  const workspaceDir =
    readEnv('THEWORLD_WORKSPACE_DIR') ?? join(process.cwd(), 'workspace')
  return join(workspaceDir, 'logs')
}

function todayLogPath(logsDir: string): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return join(logsDir, `agent-${yyyy}-${mm}-${dd}.log`)
}

/**
 * Read the tail of a file (up to TAIL_BYTES) and return the content.
 * Returns empty string if the file does not exist or cannot be read.
 */
async function readTail(filePath: string): Promise<string> {
  let fh: Awaited<ReturnType<typeof open>> | null = null
  try {
    fh = await open(filePath, 'r')
    const stat = await fh.stat()
    const size = stat.size
    if (size === 0) return ''
    const start = Math.max(0, size - TAIL_BYTES)
    const buf = Buffer.alloc(Math.min(size, TAIL_BYTES))
    await fh.read(buf, 0, buf.length, start)
    return buf.toString('utf8')
  } catch {
    return ''
  } finally {
    if (fh) await fh.close().catch(() => {})
  }
}

export const readLogsToolDefinition: ToolDefinition = {
  name: 'read_logs',
  description:
    "Read the Agent's recent structured tool-call logs. Use this to review your own actions, trace an error, or understand what happened in a previous run. Returns JSON-Lines events from today's log file.",
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: `Maximum number of log events to return (default ${DEFAULT_LIMIT}, max ${MAX_LIMIT}).`,
      },
      type: {
        type: 'string',
        description: 'Filter by event type: tool_call | tool_result | skill_run | mcp_call | error',
      },
      traceId: {
        type: 'string',
        description: 'Filter events belonging to a specific trace.',
      },
    },
  },
}

export const readLogsToolExecutor: ToolExecutor = {
  async execute(input: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const rawLimit = input.limit
    const typeFilter = typeof input.type === 'string' ? input.type : undefined
    const traceFilter = typeof input.traceId === 'string' ? input.traceId : undefined

    let limit = DEFAULT_LIMIT
    if (rawLimit !== undefined) {
      if (typeof rawLimit !== 'number' || !Number.isFinite(rawLimit) || rawLimit < 1) {
        return {
          toolCallId: `read_logs-${context.stepIndex}`,
          name: 'read_logs',
          output: createRunError('TOOL_INVALID_INPUT', 'read_logs: limit must be a positive number', 'tool'),
          isError: true,
        }
      }
      limit = Math.min(Math.floor(rawLimit), MAX_LIMIT)
    }

    const logsDir = getLogsDir()
    const logPath = todayLogPath(logsDir)

    let content: string
    try {
      content = await readTail(logPath)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        toolCallId: `read_logs-${context.stepIndex}`,
        name: 'read_logs',
        output: createRunError('TOOL_EXECUTION_FAILED', `read_logs: failed to read log file: ${msg}`, 'tool'),
        isError: true,
      }
    }

    if (!content.trim()) {
      return {
        toolCallId: `read_logs-${context.stepIndex}`,
        name: 'read_logs',
        output: { events: [], total: 0, note: 'No log entries found for today.' },
        isError: false,
      }
    }

    // Parse JSON Lines
    const allEvents: LogEvent[] = []
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const parsed = JSON.parse(trimmed) as LogEvent
        allEvents.push(parsed)
      } catch {
        // Skip malformed lines
      }
    }

    // Apply filters
    let filtered = allEvents
    if (typeFilter) {
      filtered = filtered.filter((e) => e.type === typeFilter)
    }
    if (traceFilter) {
      filtered = filtered.filter((e) => {
        const event = e as unknown as Record<string, unknown>
        return event.traceId === traceFilter
      })
    }

    // Return last `limit` events
    const events = filtered.slice(-limit)

    return {
      toolCallId: `read_logs-${context.stepIndex}`,
      name: 'read_logs',
      output: { events, total: filtered.length },
      isError: false,
    }
  },
}
