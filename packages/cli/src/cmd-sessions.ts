import { formatCliError } from './errors.js'
import { createTheWorldClient } from '@theworld/client-sdk'
import type { CliContext } from './args.js'
import { exitWithError, println } from './io.js'

function formatTimestamp(ts?: number): string {
  if (!ts) return '-'
  return new Date(ts).toISOString()
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
    exitWithError('Usage: theworld sessions list | show | messages | delete ...\nRun `theworld help sessions`.')
  }

  const client = createTheWorldClient({
    baseUrl: ctx.baseUrl,
    apiKey: ctx.apiKey,
  })

  if (sub === 'list') {
    const result = await client.listSessions()
    if (ctx.json) {
      println(JSON.stringify(result, null, 2))
      return
    }
    println(`Sessions: ${result.total}`)
    if (result.sessions.length === 0) {
      println('No sessions found.')
      return
    }
    for (const session of result.sessions) {
      println(
        [
          session.id,
          `kind=${session.kind}`,
          session.agentId ? `agent=${session.agentId}` : undefined,
          `created=${formatTimestamp(session.createdAt)}`,
        ]
          .filter(Boolean)
          .join('  '),
      )
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
        println(JSON.stringify(session, null, 2))
        return
      }
      println(`id:          ${session.id}`)
      println(`kind:        ${session.kind}`)
      println(`agentId:     ${session.agentId ?? '-'}`)
      println(`createdAt:   ${formatTimestamp(session.createdAt)}`)
    } catch (e: unknown) {
      exitWithError(`sessions show: ${formatCliError(e)}`)
    }
    return
  }

  if (sub === 'messages') {
    const { sessionId, limit } = parseMessagesArgs(args.slice(1))
    try {
      const data = await client.getMessages(sessionId, limit != null ? { limit } : undefined)
      if (ctx.json) {
        println(JSON.stringify(data, null, 2))
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
      exitWithError(`sessions messages: ${formatCliError(e)}`)
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
        println(JSON.stringify({ ok: true, sessionId: id }, null, 2))
        return
      }
      println(`Deleted session ${id}`)
    } catch (e: unknown) {
      exitWithError(`sessions delete: ${formatCliError(e)}`)
    }
    return
  }

  exitWithError(`Unknown sessions subcommand: ${sub}\nRun \`theworld help sessions\`.`)
}
