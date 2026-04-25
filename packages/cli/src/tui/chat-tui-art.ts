/**
 * 纯文本资源：转录/布局（057+）。
 * Logo：对齐 `TUI_DESKTOP_DESIGN_SPEC.md` §2.2.1 第 78–85 行（█ 字块 6 行）— 与 figlet/圆角框线风格无关。
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

/**
 * 设计文档 §2.2.1「Logo ASCII Art」6 行（字块/盒符混排，与仓库 `TUI_DESKTOP_DESIGN_SPEC.md` 一致）。
 */
const THEWORLD_LOGO_SPEC_FULL: readonly string[] = [
  '████████╗██╗  ██╗███████╗██╗    ██╗ ██████╗ ██████╗ ██╗     ██████╗ ',
  '╚══██╔══╝██║  ██║██╔════╝██║    ██║██╔═══██╗██╔══██╗██║     ██╔══██╗',
  '   ██║   ███████║█████╗  ██║ █╗ ██║██║   ██║██████╔╝██║     ██║  ██║',
  '   ██║   ██╔══██║██╔══╝  ██║███╗██║██║   ██║██╔══██╗██║     ██║  ██║',
  '   ██║   ██║  ██║███████╗╚███╔███╔╝╚██████╔╝██║  ██║███████╗██████╔╝',
  '   ╚═╝   ╚═╝  ╚═╝╚══════╝ ╚══╝╚══╝  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═════╝ ',
]

/** 同文档 §2.2.1 图「最终效果」区略短变体，用于中等列宽。 */
const THEWORLD_LOGO_SPEC_MEDIUM: readonly string[] = [
  '  ████████╗██╗  ██╗███████╗██╗    ██╗ ██████╗  ',
  '  ╚══██╔══╝██║  ██║██╔════╝██║    ██║██╔═══██╗  ',
  '     ██║   ███████║█████╗  ██║ █╗ ██║██║   ██║   ',
  '     ██║   ██╔══██║██╔══╝  ██║███╗██║██║   ██║   ',
  '     ██║   ██║  ██║███████╗╚███╔███╔╝╚██████╔╝   ',
  '     ╚═╝   ╚═╝  ╚═╝╚══════╝ ╚══╝╚══╝  ╚═════╝   ',
]

/**
 * 极窄列：2 行字块式标题（与 figlet 线位图区分），不采用圆角框 / 大 figlet。
 */
const THEWORLD_LOGO_TINY: readonly string[] = [
  '  ██╗  ███╗  T H E  W O R L D  ',
  '  ╚═╝  ═══  chat  ·  TUI  ',
]

function trimLogoLines(lines: readonly string[]): string[] {
  return lines.map(l => l.trimEnd())
}

function maxLineWidth(lines: readonly string[]): number {
  return Math.max(0, ...lines.map(l => l.trimEnd().length))
}

const FULL_W = maxLineWidth(THEWORLD_LOGO_SPEC_FULL)
const MEDIUM_W = maxLineWidth(THEWORLD_LOGO_SPEC_MEDIUM)
const TINY_W = maxLineWidth(THEWORLD_LOGO_TINY)

function centerInTerminal(line: string, columns: number): string {
  if (line.length >= columns) {
    if (line.length > columns) {
      const cut = line.length - columns
      const start = Math.floor(cut / 2)
      return line.slice(start, start + columns)
    }
    return line
  }
  const pad = columns - line.length
  const left = Math.floor(pad / 2)
  return `${' '.repeat(left)}${line}${' '.repeat(pad - left)}`
}

/**
 * 设计稿 §2.2.1 块状 THEWORLD（Splash / Home / Banner 统一）。
 * 按列宽在 full / medium / narrow 间切换，并在终端内水平居中（过长则从中裁剪）。
 */
export function buildTheWorldSpecLogoLines(columns: number): string[] {
  const c = Math.max(20, columns ?? 80)
  if (c < 16) {
    return [centerInTerminal('THEWORLD', c)]
  }
  let base: readonly string[] = THEWORLD_LOGO_TINY
  if (c >= FULL_W) {
    base = THEWORLD_LOGO_SPEC_FULL
  } else if (c >= MEDIUM_W) {
    base = THEWORLD_LOGO_SPEC_MEDIUM
  } else if (c >= TINY_W) {
    base = THEWORLD_LOGO_TINY
  }
  const lines = trimLogoLines([...base])
  return lines.map(l => centerInTerminal(l, c))
}

/** @deprecated 使用设计稿块状 Logo，保留别名。 */
export function buildLazyvimLogoLines(columns: number): string[] {
  return buildTheWorldSpecLogoLines(columns)
}

export const chatTuiBannerInnerWidth: (columns: number) => number = (columns: number) => {
  const raw = Math.floor((columns ?? 80) - 6)
  return Math.max(MIN_INNER, Math.min(MAX_INNER, raw))
}

/**
 * 圆角字框（旧 057 banner）；仅作 API 保留，新 UI 不再默认使用。
 */
export function buildFramedBannerLines(columns: number): string[] {
  const BOX_TL = '\u256d'
  const BOX_TR = '\u256e'
  const BOX_BL = '\u2570'
  const BOX_BR = '\u256f'
  const BOX_H = '\u2500'
  const BOX_V = '\u2502'
  const iw = chatTuiBannerInnerWidth(columns)
  const bar = BOX_H.repeat(iw)
  const pad = (s: string) => {
    const t = s.length <= iw ? s : s.slice(0, iw)
    const p = iw - t.length
    const left = Math.floor(p / 2)
    return `${' '.repeat(left)}${t}${' '.repeat(p - left)}`
  }
  const line1 = pad('*  T H E W O R L D  *')
  const line2 = pad('chat ·  stream  ·  TUI')
  return [`${BOX_TL}${bar}${BOX_TR}`, `${BOX_V}${line1}${BOX_V}`, `${BOX_V}${line2}${BOX_V}`, `${BOX_BL}${bar}${BOX_BR}`]
}

/** Lines occupied by logo only (not tagline). */
export function chatTuiLogoLineCount(columns: number): number {
  return buildTheWorldSpecLogoLines(columns).length
}

/** Logo lines + tagline row. */
export function chatTuiBannerTotalLines(columns: number): number {
  return chatTuiLogoLineCount(columns) + 1
}

/**
 * 开屏 Phase 1：与 Home 同源的 §2.2.1 块状 Logo，逐行显现。
 */
export function buildSplashPhase1Lines(columns: number): string[] {
  return buildTheWorldSpecLogoLines(columns)
}
