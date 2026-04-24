import type { CliContext } from './args.js'
import { getSessionAlias } from './session-alias.js'
import { println } from './io.js'
import { S, T } from './style.js'

function shortPath(cwd: string, max = 42): string {
  if (cwd.length <= max) return cwd
  return `…${cwd.slice(-(max - 1))}`
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id
}

/** Shared by TUI status bar; same truncation rule as chat status line. */
export function shortSessionIdLabel(id: string): string {
  return shortId(id)
}

export function hostLabelFromBaseUrl(baseUrl: string): string {
  try {
    return new URL(baseUrl).host || baseUrl
  } catch {
    return baseUrl
  }
}

export type SessionIdentityHints = {
  displayName?: string
}

function sessionStatusLabel(sessionId: string, hints?: SessionIdentityHints): string {
  const alias = getSessionAlias(sessionId)
  const dn = hints?.displayName?.trim()
  if (dn) {
    if (alias && alias !== dn) {
      return `${dn} · ${shortId(sessionId)} ${T.dim}(${alias})${S.reset}`
    }
    return `${dn} · ${shortId(sessionId)}`
  }
  if (alias) {
    return `${shortId(sessionId)} ${T.dim}(${alias})${S.reset}`
  }
  return shortId(sessionId)
}

/** Single-line context before the prompt (054 Phase B). 060: displayName before short id / alias. */
export function printChatStatusLine(
  ctx: CliContext,
  sessionId: string,
  hints?: SessionIdentityHints,
): void {
  if (process.env.THEWORLD_CHAT_STATUS === '0') return
  const cwd = process.cwd()
  let host = ctx.baseUrl
  try {
    host = new URL(ctx.baseUrl).host || ctx.baseUrl
  } catch {
    /* keep raw */
  }
  const parts = [
    `${T.dim}cwd${S.reset} ${shortPath(cwd)}`,
    `${T.dim}host${S.reset} ${host}`,
    `${T.dim}session${S.reset} ${sessionStatusLabel(sessionId, hints)}`,
  ]
  println(parts.join(`  ${T.dim}·${S.reset}  `))
}
