/**
 * Tab-completion candidates for slash commands (054 Phase D).
 * Keep in sync with slash handlers in slash-chat.ts.
 */
export const SLASH_TAB_COMPLETIONS: readonly string[] = [
  '/clear ',
  '/compact ',
  '/exit ',
  '/help ',
  '/inspect health',
  '/inspect status',
  '/quit ',
  '/rename ',
  '/rewind ',
  '/session delete',
  '/session messages ',
  '/session show',
  '/skills ',
  '/tasks list',
  '/tasks runs ',
  '/tasks show ',
]

export function completeSlashLine(line: string): [string[], string] {
  const trimmed = line.trimStart()
  if (!trimmed.startsWith('/')) {
    return [[], line]
  }
  const hits = SLASH_TAB_COMPLETIONS.filter((c) => c.startsWith(trimmed))
  const list = hits.length > 0 ? [...hits] : [...SLASH_TAB_COMPLETIONS]
  return [list, trimmed]
}
