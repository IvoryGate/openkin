import { exitWithCliError } from './errors.js'
import { createTheWorldClient } from '@theworld/client-sdk'
import { createTheWorldOperatorClient } from '@theworld/operator-client'
import type { CliContext } from './args.js'
import { formatSessionRunsHuman } from './l4-background-resume.js'
import { exitWithError, printJsonLine, println } from './io.js'
import { S } from './style.js'

function formatTimestamp(ts?: number): string {
  if (!ts) return '-'
  return new Date(ts).toISOString()
}

function parseSessionRunsArgs(args: string[]): {
  sessionId: string
  status?: 'running' | 'completed' | 'failed'
  limit?: number
} {
  const sessionId = args[0]
  if (!sessionId) {
    exitWithError('Usage: theworld sessions runs <sessionId> [--status running|completed|failed] [--limit <n>] [--json]')
  }
  let status: 'running' | 'completed' | 'failed' | undefined
  let limit: number | undefined
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--status') {
      const v = args[i + 1] as 'running' | 'completed' | 'failed' | undefined
      if (!v) exitWithError('Missing value for --status')
      if (v !== 'running' && v !== 'completed' && v !== 'failed') {
        exitWithError('--status must be running | completed | failed')
      }
      status = v
      i++
      continue
    }
    if (args[i] === '--limit') {
      const v = args[i + 1]
      if (!v) exitWithError('Missing value for --limit')
      limit = Number(v)
      if (!Number.isFinite(limit) || limit < 1) {
        exitWithError('--limit must be a positive number')
      }
      i++
    }
  }
  return { sessionId, status, limit }
}

function parseMessagesArgs(args: string[]): { sessionId: string; limit?: number } {
  const id = args[0]
  if (!id) {
    exitWithError('Usage: theworld sessions messages <id> [--limit <n>] [--json]')
  }
  let limit: number | undefined
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--limit') {
      const v = args[i + 1]
      if (!v) exitWithError('Missing value for --limit')
      limit = Number(v)
      if (!Number.isFinite(limit) || limit < 1) {
        exitWithError('--limit must be a positive number')
      }
      i++
    }
  }
  return { sessionId: id, limit }
}

export async function runSessionsCommand(ctx: CliContext, args: string[]): Promise<void> {
  const sub = args[0]
  if (!sub) {
    exitWithError(
      'Usage: theworld sessions list | show | messages | delete | runs | cancel-run ...\nRun `theworld help sessions`.',
    )
  }

  const client = createTheWorldClient({
    baseUrl: ctx.baseUrl,
    apiKey: ctx.apiKey,
  })

  if (sub === 'list') {
    try {
      const result = await client.listSessions()
      if (ctx.json) {
        printJsonLine(JSON.stringify(result, null, 2))
        return
      }
      println(`Sessions: ${result.total}`)
      if (result.sessions.length === 0) {
        println('No sessions found.')
        println(
          `${S.dim}Start a thread: theworld chat  ·  then: theworld sessions list${S.reset}`,
        )
        return
      }
      for (const session of result.sessions) {
        const display = session.displayName?.trim()
        const idPart = display ? `${display}  ${session.id}` : session.id
        println(
          [
            idPart,
            `kind=${session.kind}`,
            session.agentId ? `agent=${session.agentId}` : undefined,
            `created=${formatTimestamp(session.createdAt)}`,
          ]
            .filter(Boolean)
            .join('  '),
        )
      }
    } catch (e: unknown) {
      exitWithCliError('sessions list', e)
    }
    return
  }

  if (sub === 'show') {
    const id = args[1]
    if (!id) {
      exitWithError('Usage: theworld sessions show <id> [--json]')
    }
    try {
      const session = await client.getSession(id)
      if (ctx.json) {
        printJsonLine(JSON.stringify(session, null, 2))
        return
      }
      println(`id:          ${session.id}`)
      if (session.displayName?.trim()) {
        println(`displayName: ${session.displayName}`)
      }
      println(`kind:        ${session.kind}`)
      println(`agentId:     ${session.agentId ?? '-'}`)
      println(`createdAt:   ${formatTimestamp(session.createdAt)}`)
    } catch (e: unknown) {
      exitWithCliError('sessions show', e)
    }
    return
  }

  if (sub === 'runs') {
    const op = createTheWorldOperatorClient({
      baseUrl: ctx.baseUrl,
      apiKey: ctx.apiKey,
    })
    const { sessionId, status, limit } = parseSessionRunsArgs(args.slice(1))
    try {
      const data = await op.listSessionRuns(sessionId, {
        status,
        limit,
      })
      if (ctx.json) {
        printJsonLine(JSON.stringify({ runs: data.runs, hasMore: data.hasMore }, null, 2))
        return
      }
      println(formatSessionRunsHuman(data))
    } catch (e: unknown) {
      exitWithCliError('sessions runs', e)
    }
    return
  }

  if (sub === 'cancel-run') {
    const traceId = args[1]
    if (!traceId) {
      exitWithError('Usage: theworld sessions cancel-run <traceId> [--json]')
    }
    try {
      const res = await client.cancelRun(traceId)
      if (ctx.json) {
        printJsonLine(JSON.stringify(res, null, 2))
        return
      }
      println(
        res.cancelled
          ? `Cancel requested for ${traceId} (L3: run may end as cancelled).`
          : `Not cancelled: ${res.reason ?? 'already finished or unknown'}`,
      )
    } catch (e: unknown) {
      exitWithCliError('sessions cancel-run', e)
    }
    return
  }

  if (sub === 'messages') {
    const { sessionId, limit } = parseMessagesArgs(args.slice(1))
    try {
      const data = await client.getMessages(sessionId, limit != null ? { limit } : undefined)
      if (ctx.json) {
        printJsonLine(JSON.stringify(data, null, 2))
        return
      }
      println(
        `Messages for ${sessionId} (${data.messages.length} shown${data.hasMore ? ', more available' : ''})`,
      )
      for (const m of data.messages) {
        const preview = m.content.slice(0, 120)
        println(`[${m.role}] ${formatTimestamp(m.createdAt)}  ${preview}${preview.length >= 120 ? '...' : ''}`)
      }
    } catch (e: unknown) {
      exitWithCliError('sessions messages', e)
    }
    return
  }

  if (sub === 'delete') {
    const id = args[1]
    if (!id) {
      exitWithError('Usage: theworld sessions delete <id> [--json]')
    }
    try {
      await client.deleteSession(id)
      if (ctx.json) {
        printJsonLine(JSON.stringify({ ok: true, sessionId: id }, null, 2))
        return
      }
      println(`Deleted session ${id}`)
    } catch (e: unknown) {
      exitWithCliError('sessions delete', e)
    }
    return
  }

  exitWithError(`Unknown sessions subcommand: ${sub}\nRun \`theworld help sessions\`.`)
}
