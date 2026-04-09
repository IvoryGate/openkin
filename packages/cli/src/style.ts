/**
 * Terminal styling: honors NO_COLOR and dumb TERM (see https://no-color.org/).
 */

export const colorEnabled = !process.env.NO_COLOR && process.env.TERM !== 'dumb'

function c(code: string): string {
  return colorEnabled ? code : ''
}

/** ANSI segments; empty strings when color is off. */
export const S = {
  reset: c('\x1b[0m'),
  bold: c('\x1b[1m'),
  dim: c('\x1b[2m'),
  cyan: c('\x1b[36m'),
  green: c('\x1b[32m'),
  yellow: c('\x1b[33m'),
  gray: c('\x1b[90m'),
  red: c('\x1b[31m'),
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
