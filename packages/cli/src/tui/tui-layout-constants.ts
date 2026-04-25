/**
 * Transcript+sidebar layout (exec-plan 077) — aligned with TUI_DESKTOP_DESIGN_SPEC §2.2.3.
 */
export const TUI_SIDEBAR_MIN_COLS = 80

/**
 * Wide layout: sidebar ≈ **1/4** of terminal width (`floor(cols/4)`), clamped so the main column
 * never goes below ~52 cols at the minimum breakpoint (80 − 20 − 1 gap).
 */
export function tuiSidebarWidthCols(terminalCols: number): number {
  const q = Math.floor(terminalCols / 4)
  return Math.max(20, Math.min(56, q))
}
