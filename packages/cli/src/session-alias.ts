/**
 * Session display aliases and `--resume` / `--session` name resolution.
 * Persisted to disk so a new CLI process can resolve names set via /rename.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const sessionAliases = new Map<string, string>()
const aliasToSession = new Map<string, string>()

let loaded = false

function defaultAliasesPath(): string {
  return join(homedir(), '.theworld', 'session-aliases.json')
}

function aliasesFilePath(): string {
  const fromEnv = process.env.THEWORLD_SESSION_ALIASES_PATH?.trim()
  if (fromEnv) return fromEnv
  return defaultAliasesPath()
}

function normalizeKey(name: string): string {
  return name.trim().toLowerCase()
}

function looksLikeUuid(ref: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    ref.trim(),
  )
}

function rebuildReverse(): void {
  aliasToSession.clear()
  for (const [sessionId, display] of sessionAliases.entries()) {
    const key = normalizeKey(display)
    if (key) aliasToSession.set(key, sessionId)
  }
}

function ensureLoaded(): void {
  if (loaded) return
  loaded = true
  const path = aliasesFilePath()
  if (!existsSync(path)) return
  try {
    const raw = readFileSync(path, 'utf8')
    const data = JSON.parse(raw) as { sessions?: Record<string, string> }
    const sessions = data.sessions && typeof data.sessions === 'object' ? data.sessions : {}
    sessionAliases.clear()
    for (const [id, name] of Object.entries(sessions)) {
      if (typeof name === 'string' && name.trim()) sessionAliases.set(id, name.trim())
    }
    rebuildReverse()
  } catch {
    // ignore corrupt file; keep empty maps
  }
}

function persist(): void {
  const path = aliasesFilePath()
  try {
    mkdirSync(dirname(path), { recursive: true })
    const sessions: Record<string, string> = {}
    for (const [id, name] of sessionAliases.entries()) sessions[id] = name
    writeFileSync(path, `${JSON.stringify({ sessions }, null, 2)}\n`, 'utf8')
  } catch {
    // best-effort; in-memory maps still apply for this process
  }
}

export function setSessionAlias(sessionId: string, name: string): void {
  ensureLoaded()
  const trimmed = name.trim()
  const key = normalizeKey(trimmed)
  if (!key) return

  for (const [k, sid] of [...aliasToSession.entries()]) {
    if (sid === sessionId) aliasToSession.delete(k)
  }
  const prevSid = aliasToSession.get(key)
  if (prevSid && prevSid !== sessionId) {
    sessionAliases.delete(prevSid)
  }
  aliasToSession.set(key, sessionId)
  sessionAliases.set(sessionId, trimmed)
  persist()
}

export function getSessionAlias(sessionId: string): string | undefined {
  ensureLoaded()
  return sessionAliases.get(sessionId)
}

/** Resolve `--session` / `--resume` ref: UUID passthrough, else alias → session id. */
export function resolveSessionRef(ref: string): string {
  ensureLoaded()
  const t = ref.trim()
  if (!t) return t
  if (looksLikeUuid(t)) return t
  return aliasToSession.get(normalizeKey(t)) ?? t
}
