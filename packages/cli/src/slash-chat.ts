import { createOpenKinClient } from '@theworld/client-sdk'
import { createOpenKinOperatorClient } from '@theworld/operator-client'
import type { CliContext } from './args.js'
import { formatCliError } from './errors.js'
import { line } from './style.js'

export type SlashResult =
  | { kind: 'handled' }
  | { kind: 'exit' }
  | { kind: 'new_session'; sessionId: string }

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
  emit('/session show')
  emit('/session messages [limit]')
  emit('/session delete   → deletes this session, starts a new one')
  emit('/inspect health')
  emit('/inspect status')
  emit('/tasks list')
  emit('/tasks show <task-id>')
  emit('/tasks runs <task-id>')
  emit(line('-', 52))
  emit('Full CLI: theworld help  ·  theworld sessions | inspect | tasks …')
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

  const client = createOpenKinClient({
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
        const op = createOpenKinOperatorClient({
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

    if (head === '/tasks') {
      const op = createOpenKinOperatorClient({
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
