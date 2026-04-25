import { createTheWorldClient } from '@theworld/client-sdk'
import { createTheWorldOperatorClient } from '@theworld/operator-client'
import type { CliContext } from './args.js'
import { formatCliError } from './errors.js'
import { formatGetRunContextHuman } from './l4-context-view.js'
import { formatSessionRunsHuman } from './l4-background-resume.js'
import { formatListApprovalsHuman } from './l4-approval-surface.js'
import { formatGetRunContextMemoryHuman } from './l4-layered-memory.js'
import { setSessionAlias } from './session-alias.js'
import { line } from './style.js'

export type SlashResult =
  | { kind: 'handled' }
  | { kind: 'exit' }
  | { kind: 'new_session'; sessionId: string }
  | { kind: 'banner_refresh' }

function tokens(line: string): string[] {
  return line
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function formatTs(ts?: number): string {
  if (!ts) return '-'
  return new Date(ts).toISOString()
}

export function printSlashHelp(emit: (s: string) => void): void {
  emit(line('-', 52))
  emit('Slash commands (handled in this CLI only; not sent to the server)')
  emit(line('-', 52))
  emit('/help')
  emit('/exit')
  emit('/clear                     → clear screen')
  emit('/skills                    → list available skills (same data as: theworld inspect skills)')
  emit('/compact [note]            → ask agent to summarize context')
  emit('/context                  → L4: context report for latest completed run (this session)')
  emit('/memory                   → L4: memory slice (same run as /context, memory-focused text)')
  emit('/approvals                 → L3 approval queue (this session’s rows if any; same as inspect)')
  emit('/runs                      → session run list (L4 104; same as sessions runs <id>)')
  emit('/rename <name>             → set local alias for this session')
  emit('/rewind                    → (not yet supported)')
  emit('/session show')
  emit('/session messages [limit]')
  emit('/session delete   → deletes this session, starts a new one')
  emit('/inspect health')
  emit('/inspect status')
  emit('/tasks list')
  emit('/tasks show <task-id>')
  emit('/tasks runs <task-id>')
  emit(line('-', 52))
  emit('Tools list: theworld inspect tools  ·  Full CLI: theworld help · sessions | inspect | tasks …')
  emit(line('-', 52))
}

export async function runSlashCommand(
  ctx: CliContext,
  currentSessionId: string,
  line: string,
  emit: (s: string) => void,
): Promise<SlashResult> {
  const parts = tokens(line)
  if (parts.length === 0) {
    return { kind: 'handled' }
  }

  const head = parts[0].toLowerCase()
  if (!head.startsWith('/')) {
    return { kind: 'handled' }
  }

  if (head === '/exit' || head === '/quit') {
    return { kind: 'exit' }
  }

  if (head === '/help') {
    printSlashHelp(emit)
    return { kind: 'handled' }
  }

  if (head === '/clear') {
    // Visual clear only — does NOT delete any DB data
    process.stderr.write('\x1b[2J\x1b[H')
    return { kind: 'handled' }
  }

  const client = createTheWorldClient({
    baseUrl: ctx.baseUrl,
    apiKey: ctx.apiKey,
  })

  try {
    if (head === '/session') {
      const sub = parts[1]?.toLowerCase()
      if (sub === 'show') {
        const session = await client.getSession(currentSessionId)
        emit(`id:        ${session.id}`)
        emit(`kind:      ${session.kind}`)
        emit(`agentId:   ${session.agentId ?? '-'}`)
        emit(`createdAt: ${formatTs(session.createdAt)}`)
        return { kind: 'handled' }
      }
      if (sub === 'messages') {
        const lim = parts[2] != null ? Number(parts[2]) : undefined
        const data = await client.getMessages(
          currentSessionId,
          lim != null && Number.isFinite(lim) && lim > 0 ? { limit: lim } : undefined,
        )
        emit(
          `Messages (${data.messages.length} shown${data.hasMore ? ', more available' : ''})`,
        )
        for (const m of data.messages) {
          const preview = m.content.slice(0, 100)
          emit(`[${m.role}] ${formatTs(m.createdAt)}  ${preview}${preview.length >= 100 ? '...' : ''}`)
        }
        return { kind: 'handled' }
      }
      if (sub === 'delete') {
        await client.deleteSession(currentSessionId)
        emit(`Deleted session ${currentSessionId}.`)
        const next = await client.createSession({ kind: 'chat' })
        emit(`Started new session ${next.id}.`)
        return { kind: 'new_session', sessionId: next.id }
      }
      emit('Usage: /session show | /session messages [limit] | /session delete')
      return { kind: 'handled' }
    }

    if (head === '/inspect') {
      const sub = parts[1]?.toLowerCase()
      if (sub === 'health') {
        const h = await client.getHealth()
        emit(`ok: ${h.ok}  version: ${h.version}  db: ${h.db}  uptime: ${h.uptime}`)
        emit(`ts: ${new Date(h.ts).toISOString()}`)
        return { kind: 'handled' }
      }
      if (sub === 'status') {
        const op = createTheWorldOperatorClient({
          baseUrl: ctx.baseUrl,
          apiKey: ctx.apiKey,
        })
        const s = await op.getSystemStatus()
        emit(
          `version=${s.version} uptime=${s.uptime}s db=${s.db} activeSessions=${s.activeSessions}`,
        )
        emit(
          `tools builtin=${s.tools.builtin} mcp=${s.tools.mcp} total=${s.tools.total} skills=${s.skills.loaded}`,
        )
        return { kind: 'handled' }
      }
      emit('Usage: /inspect health | /inspect status')
      return { kind: 'handled' }
    }

    if (head === '/skills') {
      const op = createTheWorldOperatorClient({
        baseUrl: ctx.baseUrl,
        apiKey: ctx.apiKey,
      })
      const data = await op.listSkills()
      emit(`Skills: ${data.skills.length}`)
      for (const sk of data.skills) {
        const desc = sk.description ? `  — ${sk.description.slice(0, 80)}` : ''
        emit(`  ${sk.id}  [${sk.title}]${desc}`)
      }
      return { kind: 'handled' }
    }

    if (head === '/context') {
      const op = createTheWorldOperatorClient({
        baseUrl: ctx.baseUrl,
        apiKey: ctx.apiKey,
      })
      try {
        const { runs } = await op.listSessionRuns(currentSessionId, {
          limit: 8,
          status: 'completed',
        })
        if (runs.length === 0) {
          emit('No completed runs yet. Send a message, wait for the reply, then try /context.')
          return { kind: 'handled' }
        }
        const traceId = runs[0]!.traceId
        const data = await op.getRunContext(traceId)
        for (const ln of formatGetRunContextHuman(traceId, data).split('\n')) {
          emit(ln)
        }
      } catch (e: unknown) {
        emit(`Error: ${formatCliError(e)}`)
        emit('Tip: theworld inspect context <traceId>  (copy trace from stream or `sessions` tools)')
      }
      return { kind: 'handled' }
    }

    if (head === '/runs') {
      const op = createTheWorldOperatorClient({
        baseUrl: ctx.baseUrl,
        apiKey: ctx.apiKey,
      })
      try {
        const data = await op.listSessionRuns(currentSessionId, { limit: 20 })
        for (const ln of formatSessionRunsHuman(data).split('\n')) {
          emit(ln)
        }
      } catch (e: unknown) {
        emit(`Error: ${formatCliError(e)}`)
        emit('Tip: theworld sessions runs <sessionId>')
      }
      return { kind: 'handled' }
    }

    if (head === '/approvals') {
      const op = createTheWorldOperatorClient({
        baseUrl: ctx.baseUrl,
        apiKey: ctx.apiKey,
      })
      try {
        const data = await op.listApprovals()
        const rows = data.approvals.filter((a) => a.sessionId === currentSessionId)
        for (const ln of formatListApprovalsHuman({ approvals: rows }).split('\n')) {
          emit(ln)
        }
      } catch (e: unknown) {
        emit(`Error: ${formatCliError(e)}`)
        emit('Tip: theworld inspect approvals')
      }
      return { kind: 'handled' }
    }

    if (head === '/memory') {
      const op = createTheWorldOperatorClient({
        baseUrl: ctx.baseUrl,
        apiKey: ctx.apiKey,
      })
      try {
        const { runs } = await op.listSessionRuns(currentSessionId, {
          limit: 8,
          status: 'completed',
        })
        if (runs.length === 0) {
          emit('No completed runs yet. Send a message, wait for the reply, then try /memory.')
          return { kind: 'handled' }
        }
        const traceId = runs[0]!.traceId
        const data = await op.getRunContext(traceId)
        for (const ln of formatGetRunContextMemoryHuman(traceId, data).split('\n')) {
          emit(ln)
        }
      } catch (e: unknown) {
        emit(`Error: ${formatCliError(e)}`)
        emit('Tip: theworld inspect memory <traceId>  ·  full context: theworld inspect context <traceId>')
      }
      return { kind: 'handled' }
    }

    if (head === '/compact') {
      const note = parts.slice(1).join(' ')
      const systemBody = `Please summarize the conversation so far into a compact context summary. Note: ${note || '(none)'}`
      emit(`Sending compact request to session ${currentSessionId}...`)
      const streamClient = createTheWorldClient({ baseUrl: ctx.baseUrl, apiKey: ctx.apiKey })
      await streamClient.createSessionMessage(currentSessionId, {
        role: 'system',
        content: systemBody,
      })
      let gotAny = false
      emit('')
      await streamClient.streamRun({ sessionId: currentSessionId, input: { text: 'Proceed with the compact instruction above.' } }, (event) => {
        if (event.type === 'text_delta') {
          const payload = event.payload as { delta?: string }
          if (payload.delta) {
            process.stderr.write(payload.delta)
            gotAny = true
          }
        }
        if (event.type === 'run_completed' || event.type === 'run_failed') {
          if (gotAny) process.stderr.write('\n')
        }
      })
      return { kind: 'handled' }
    }

    if (head === '/rename') {
      const name = parts.slice(1).join(' ').trim()
      if (!name) {
        emit('Usage: /rename <name>')
        return { kind: 'handled' }
      }
      setSessionAlias(currentSessionId, name)
      emit(`Session ${currentSessionId} aliased as "${name}" (use with --resume / --session).`)
      return { kind: 'banner_refresh' }
    }

    if (head === '/rewind') {
      emit('/rewind is not yet supported. It requires a server-side message deletion API.')
      emit('To start fresh, use /session delete  or  theworld chat --session <new-id>')
      return { kind: 'handled' }
    }

    if (head === '/tasks') {
      const op = createTheWorldOperatorClient({
        baseUrl: ctx.baseUrl,
        apiKey: ctx.apiKey,
      })
      const sub = parts[1]?.toLowerCase()
      if (sub === 'list') {
        const data = await op.listTasks()
        emit(`Tasks: ${data.tasks.length}`)
        for (const t of data.tasks) {
          emit(`  ${t.id}  ${t.enabled ? 'on' : 'off'}  ${t.name}  (${t.triggerType})`)
        }
        return { kind: 'handled' }
      }
      if (sub === 'show') {
        const id = parts[2]
        if (!id) {
          emit('Usage: /tasks show <task-id>')
          return { kind: 'handled' }
        }
        const task = await op.getTask(id)
        emit(`id: ${task.id}  name: ${task.name}  enabled: ${task.enabled}`)
        emit(`trigger: ${task.triggerType}  agentId: ${task.agentId}`)
        return { kind: 'handled' }
      }
      if (sub === 'runs') {
        const id = parts[2]
        if (!id) {
          emit('Usage: /tasks runs <task-id>')
          return { kind: 'handled' }
        }
        const data = await op.listTaskRuns(id)
        emit(`Runs for ${id}: ${data.runs.length}`)
        for (const r of data.runs.slice(0, 20)) {
          emit(`  ${r.id}  ${r.status}  started=${formatTs(r.startedAt)}`)
        }
        if (data.runs.length > 20) {
          emit(`  ... ${data.runs.length - 20} more`)
        }
        return { kind: 'handled' }
      }
      emit('Usage: /tasks list | /tasks show <id> | /tasks runs <id>')
      return { kind: 'handled' }
    }
  } catch (e: unknown) {
    emit(`Error: ${formatCliError(e)}`)
    return { kind: 'handled' }
  }

  emit(`Unknown slash command ${head}. Type /help for built-in commands.`)
  return { kind: 'handled' }
}
