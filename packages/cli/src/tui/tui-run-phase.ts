/** Run phase for TUI header / shell (064 / THEWORLD_TUI_PRODUCT_DESIGN.md). */
export type TuiRunPhase = 'idle' | 'thinking' | 'streaming' | 'failed' | 'completed'

export function formatTuiRunPhase(phase: TuiRunPhase): string {
  switch (phase) {
    case 'idle':
      return 'idle'
    case 'thinking':
      return 'thinking'
    case 'streaming':
      return 'streaming'
    case 'failed':
      return 'failed'
    case 'completed':
      return 'completed'
    default:
      return String(phase)
  }
}
