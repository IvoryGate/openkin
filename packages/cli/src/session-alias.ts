/** In-memory session display aliases (not persisted). */

const sessionAliases = new Map<string, string>()

export function setSessionAlias(sessionId: string, name: string): void {
  sessionAliases.set(sessionId, name.trim())
}

export function getSessionAlias(sessionId: string): string | undefined {
  return sessionAliases.get(sessionId)
}
