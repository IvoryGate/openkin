/**
 * Shared semantic tokens: line UI + TUI (065 / THEWORLD_TUI_PRODUCT_DESIGN.md).
 * - `T` — ANSI segments
 * - `ink` — Ink color props (undefined when color off)
 * - `S` — legacy flat aliases
 */

export const colorEnabled = !process.env.NO_COLOR && process.env.TERM !== 'dumb'
export const motionEnabled = colorEnabled

function c(code: string): string {
  return colorEnabled ? code : ''
}

export const T = {
  brand: c('\x1b[36m'),
  accent: c('\x1b[36m'),
  focus: c('\x1b[1m\x1b[36m'),
  dim: c('\x1b[2m'),
  muted: c('\x1b[90m'),
  user: c('\x1b[34m'),
  assistant: c('\x1b[32m'),
  tool: c('\x1b[33m'),
  success: c('\x1b[32m'),
  warning: c('\x1b[33m'),
  danger: c('\x1b[31m'),
  panelBorder: c('\x1b[36m'),
} as const

export const ink = {
  brand: colorEnabled ? ('cyan' as const) : undefined,
  accent: colorEnabled ? ('cyan' as const) : undefined,
  focus: colorEnabled ? ('cyan' as const) : undefined,
  user: colorEnabled ? ('blue' as const) : undefined,
  assistant: colorEnabled ? ('green' as const) : undefined,
  tool: colorEnabled ? ('yellow' as const) : undefined,
  success: colorEnabled ? ('green' as const) : undefined,
  warning: colorEnabled ? ('yellow' as const) : undefined,
  danger: colorEnabled ? ('red' as const) : undefined,
  muted: colorEnabled ? ('gray' as const) : undefined,
  dim: colorEnabled ? ('gray' as const) : undefined,
  panelBorder: colorEnabled ? ('cyan' as const) : undefined,
  thinkAccent: colorEnabled ? ('magenta' as const) : undefined,
  shellAccent: colorEnabled ? ('blue' as const) : undefined,
  shellHint: colorEnabled ? ('yellow' as const) : undefined,
} as const

export const S = {
  reset: c('\x1b[0m'),
  bold: c('\x1b[1m'),
  dim: T.dim,
  cyan: T.brand,
  green: T.success,
  yellow: T.tool,
  gray: T.muted,
  red: T.danger,
}

export function line(char = '-', width = 56): string {
  return char.repeat(width)
}

export function label(kind: 'tool' | 'result' | 'note' | 'agent' | 'error'): string {
  if (colorEnabled) return ''
  switch (kind) {
    case 'tool':
      return '[tool] '
    case 'result':
      return '[result] '
    case 'note':
      return '[note] '
    case 'agent':
      return '[agent] '
    case 'error':
      return '[error] '
    default:
      return ''
  }
}
