/**
 * TUI session list data plane (exec-plan 078) — no Ink.
 */
import { createTheWorldClient, type SessionDto } from '@theworld/client-sdk'
import type { CliContext } from '../args.js'
import { formatCliError } from '../errors.js'
import { getSessionAlias } from '../session-alias.js'
import { shortSessionIdLabel } from '../chat-status.js'

export const TUI_SESSION_LIST_DEFAULT_LIMIT = 20

export type TuiSessionRow = {
  id: string
  label: string
  createdAt?: number
}

function buildTuiLabel(session: SessionDto): string {
  const id = session.id
  const dn = session.displayName?.trim()
  const alias = getSessionAlias(id)
  if (dn) {
    if (alias && alias !== dn) {
      return `${dn} · ${shortSessionIdLabel(id)} (${alias})`
    }
    return `${dn} · ${shortSessionIdLabel(id)}`
  }
  if (alias) {
    return `${shortSessionIdLabel(id)} (${alias})`
  }
  return shortSessionIdLabel(id)
}

export type FetchTuiSessionListResult = { ok: true; rows: TuiSessionRow[] } | { ok: false; message: string }

/**
 * List chat sessions for TUI pickers. Errors are normalized to a string (see {@link formatCliError}).
 */
export async function fetchTuiSessionList(
  ctx: CliContext,
  opts?: { limit?: number },
): Promise<FetchTuiSessionListResult> {
  const limit = opts?.limit ?? TUI_SESSION_LIST_DEFAULT_LIMIT
  try {
    const client = createTheWorldClient({
      baseUrl: ctx.baseUrl,
      apiKey: ctx.apiKey,
    })
    const { sessions } = await client.listSessions({ limit, kind: 'chat' })
    const rows = sessions.map(s => ({
      id: s.id,
      label: buildTuiLabel(s),
      createdAt: s.createdAt,
    }))
    return { ok: true, rows }
  } catch (e: unknown) {
    return { ok: false, message: formatCliError(e) }
  }
}
