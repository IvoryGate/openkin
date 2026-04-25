/** OpenCode 式多行草案：左下输入区可增高，有上限。 */

export const TUI_DRAFT_MAX_LINES = 6

export function countDraftLines(d: string): number {
  if (d.length === 0) return 1
  return d.split('\n').length
}

export function clipDraftToMaxLines(d: string, max: number = TUI_DRAFT_MAX_LINES): string {
  const lines = d.split('\n')
  if (lines.length <= max) {
    return d
  }
  return lines.slice(0, max).join('\n')
}

/**
 * 从 `at` 插入 `ins`，再裁剪到 `max` 行；cursor 位于插入后位置（不越过裁剪结果末尾）。
 */
export function insertClamped(
  draft: string,
  at: number,
  ins: string,
  max: number = TUI_DRAFT_MAX_LINES,
): { draft: string; cursorIndex: number } {
  const safeAt = Math.max(0, Math.min(at, draft.length))
  const merged = `${draft.slice(0, safeAt)}${ins}${draft.slice(safeAt)}`
  const clipped = clipDraftToMaxLines(merged, max)
  const endInsert = safeAt + ins.length
  const cursorIndex = Math.min(endInsert, clipped.length)
  return { draft: clipped, cursorIndex }
}

export function cursorLineAndCol(
  draft: string,
  index: number,
): { line: number; col: number; lines: string[] } {
  const safeI = Math.max(0, Math.min(index, draft.length))
  const before = draft.slice(0, safeI)
  const line = before.split('\n').length - 1
  const lastNl = before.lastIndexOf('\n')
  const col = lastNl < 0 ? before.length : before.length - lastNl - 1
  const lines = draft.length === 0 ? [''] : draft.split('\n')
  return { line, col, lines }
}
