/**
 * Pure strings for chat TUI banner, spinners, and layout helpers (057/058).
 * No stdout; callers render via Ink.
 */

export const CHAT_TUI_THINK_FRAMES = [
  '\u280b',
  '\u2859',
  '\u2839',
  '\u2838',
  '\u283c',
  '\u2834',
  '\u2826',
  '\u2827',
  '\u2807',
  '\u280f',
] as const

/** Blinking stream tail (full-width block). */
export const CHAT_TUI_STREAM_CURSORS = ['\u258c', ' '] as const

/** Idle draft input caret (same rhythm as stream cursor). */
export const CHAT_TUI_DRAFT_CURSORS = ['\u258c', ' '] as const

export const CHAT_TUI_TAGLINE = 'Stream ideas into working runs.'

const MIN_INNER = 20
const MAX_INNER = 58

const BOX_TL = '\u256d'
const BOX_TR = '\u256e'
const BOX_BL = '\u2570'
const BOX_BR = '\u256f'
const BOX_H = '\u2500'
const BOX_V = '\u2502'

const DBL_TL = '\u2554'
const DBL_TR = '\u2557'
const DBL_BL = '\u255a'
const DBL_BR = '\u255d'
const DBL_H = '\u2550'
const DBL_V = '\u2551'

/** Inner width between vertical border chars (│). */
export function chatTuiBannerInnerWidth(columns: number): number {
  const raw = Math.floor((columns ?? 80) - 6)
  return Math.max(MIN_INNER, Math.min(MAX_INNER, raw))
}

function centerIn(innerWidth: number, text: string): string {
  const t = text.length > innerWidth ? text.slice(0, innerWidth) : text
  const pad = innerWidth - t.length
  const left = Math.floor(pad / 2)
  const right = pad - left
  return `${' '.repeat(left)}${t}${' '.repeat(right)}`
}

/**
 * Rounded-box banner lines (each line display width ~ innerWidth + 2).
 * Uses only ASCII + box-drawing so narrow fonts stay aligned.
 */
export function buildFramedBannerLines(columns: number): string[] {
  const iw = chatTuiBannerInnerWidth(columns)
  const bar = BOX_H.repeat(iw)
  const line1 = centerIn(iw, '*  T H E W O R L D  *')
  const line2 = centerIn(iw, 'chat ·  stream  ·  TUI')
  return [`${BOX_TL}${bar}${BOX_TR}`, `${BOX_V}${line1}${BOX_V}`, `${BOX_V}${line2}${BOX_V}`, `${BOX_BL}${bar}${BOX_BR}`]
}

/** Figlet "small" / standard style for THEWORLD (ASCII, ~57 content cols). */
const FIGLET_THEWORLD_LINES: readonly string[] = [
  '  _____ _   _ _______        _____  ____  _     ____  ',
  ' |_   _| | | | ____\\ \\      / / _ \\|  _ \\| |   |  _ \\ ',
  '   | | | |_| |  _|  \\ \\ /\\ / / | | | |_) | |   | | | |',
  '   | | |  _  | |___  \\ V  V /| |_| |  _ <| |___| |_| |',
  '   |_| |_| |_|_____|  \\_/\\_/  \\___/|_| \\_\\_____|____/ ',
  '                                                      ',
]

const FULL_LOGO_MIN_COLS = 62
const MEDIUM_LOGO_MIN_COLS = 50

function clipLineToTerminal(line: string, maxCols: number): string {
  if (line.length <= maxCols) return line
  const cut = line.length - maxCols
  const start = Math.floor(cut / 2)
  return line.slice(start, start + maxCols)
}

function withLazyvimShadow(lines: readonly string[]): string[] {
  const shadow = '\u2591'
  return lines.map((ln, i) => {
    const pad = shadow.repeat(Math.min(2, i))
    return `${ln}${pad}`
  })
}

function buildMediumBoxLogoLines(columns: number): string[] {
  const c = Math.max(MEDIUM_LOGO_MIN_COLS, columns)
  const iw = Math.max(28, Math.min(c - 4, MAX_INNER + 6))
  const bar = DBL_H.repeat(iw)
  const line1 = centerIn(iw, '* · THEWORLD · *  chat')
  const line2 = centerIn(iw, 'stream · TUI · full-screen')
  return [`${DBL_TL}${bar}${DBL_TR}`, `${DBL_V}${line1}${DBL_V}`, `${DBL_V}${line2}${DBL_V}`, `${DBL_BL}${bar}${DBL_BR}`]
}

/**
 * Logo lines for the dashboard header: figlet + shadow, medium box, or framed fallback.
 */
export function buildLazyvimLogoLines(columns: number): string[] {
  const c = Math.max(20, columns ?? 80)
  if (c >= FULL_LOGO_MIN_COLS) {
    const raw = withLazyvimShadow(FIGLET_THEWORLD_LINES)
    return raw.map(l => clipLineToTerminal(l, c))
  }
  if (c >= MEDIUM_LOGO_MIN_COLS) {
    return buildMediumBoxLogoLines(c)
  }
  return buildFramedBannerLines(c)
}

/** Lines occupied by logo only (not tagline). */
export function chatTuiLogoLineCount(columns: number): number {
  return buildLazyvimLogoLines(columns).length
}

/** Logo lines + tagline row (matches `ChatTuiBanner`). */
export function chatTuiBannerTotalLines(columns: number): number {
  return chatTuiLogoLineCount(columns) + 1
}
