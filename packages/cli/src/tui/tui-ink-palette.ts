/**
 * TUI 语义色 — 对齐 `docs/requirements/TUI_DESKTOP_DESIGN_SPEC.md` §2.3 / §3.3.
 * 终端无真彩色或 NO_COLOR 时 `color` 为 false，背景字段为 undefined，由组件回退为纯文本/ dim。
 */
export type TuiPalette = {
  color: boolean
  id: string
  background: string | undefined
  /** Header / input rail / cards */
  surface: string | undefined
  /** Status bar：比主背景略深（§2.3） */
  statusBar: string | undefined
  userMessage: string | undefined
  assistantMessage: string | undefined
  toolCall: string | undefined
  toolResult: string | undefined
  error: string | undefined
  errorRail: string | undefined
  border: string | undefined
  inputBorder: string | undefined
  inputBorderFocus: string | undefined
  inputBorderBusy: string | undefined
  inputBorderBlocked: string | undefined
  /** 主前景（与 surface/消息底对比） */
  text: string | undefined
  textMuted: string | undefined
  brand: string | undefined
  userAccent: string | undefined
  assistantAccent: string | undefined
  toolAccent: string | undefined
  success: string | undefined
  warning: string | undefined
  danger: string | undefined
  focus: string | undefined
  accent: string | undefined
}

type Preset = Omit<TuiPalette, 'color' | 'id'>

const dark: Preset = {
  background: '#0a0a0a',
  surface: '#121212',
  statusBar: '#060606',
  userMessage: '#132040',
  assistantMessage: '#0f1f16',
  toolCall: '#1a1508',
  toolResult: '#0f120f',
  error: '#2a1010',
  errorRail: '#c42b2b',
  border: '#1c1c1c',
  inputBorder: '#333333',
  inputBorderFocus: '#5a6d7a',
  inputBorderBusy: '#8a7a30',
  inputBorderBlocked: '#a53c3c',
  text: 'white',
  textMuted: 'gray',
  brand: '#6a9eaa',
  userAccent: 'blue',
  assistantAccent: 'green',
  toolAccent: 'yellow',
  success: 'green',
  warning: 'yellow',
  danger: 'red',
  focus: '#7aa8b0',
  accent: '#6a9eaa',
}

const light: Preset = {
  background: '#f6f6f6',
  surface: '#ececec',
  statusBar: '#e0e0e0',
  userMessage: '#d8e6ff',
  assistantMessage: '#d8f0e0',
  toolCall: '#f5f0d8',
  toolResult: '#e8f0e8',
  error: '#fde0e0',
  errorRail: '#c42b2b',
  border: '#c8c8c8',
  inputBorder: '#9a9a9a',
  inputBorderFocus: '#0066b8',
  inputBorderBusy: '#8a7000',
  inputBorderBlocked: '#b00020',
  text: 'black',
  textMuted: 'gray',
  brand: 'blue',
  userAccent: 'blue',
  assistantAccent: 'green',
  toolAccent: 'yellow',
  success: 'green',
  warning: 'yellow',
  danger: 'red',
  focus: 'blue',
  accent: 'blue',
}

const catppuccin: Preset = {
  background: '#1e1e2e',
  surface: '#181825',
  statusBar: '#11111b',
  userMessage: '#1e2a4a',
  assistantMessage: '#1a2a22',
  toolCall: '#2a2010',
  toolResult: '#1a1e1a',
  error: '#3a2020',
  errorRail: '#f38ba8',
  border: '#3a3d52',
  inputBorder: '#4a4c62',
  inputBorderFocus: '#6a7fa0',
  inputBorderBusy: '#b8a878',
  inputBorderBlocked: '#c48b9a',
  text: '#cdd6f4',
  textMuted: '#6c7086',
  brand: '#b8a0c4',
  userAccent: 'blue',
  assistantAccent: 'green',
  toolAccent: 'yellow',
  success: 'green',
  warning: 'yellow',
  danger: 'red',
  focus: '#8aa8a8',
  accent: '#a890b0',
}

const tokyonight: Preset = {
  background: '#1a1b26',
  surface: '#16161e',
  statusBar: '#0f0f14',
  userMessage: '#1e2d45',
  assistantMessage: '#15221a',
  toolCall: '#2a2115',
  toolResult: '#121a16',
  error: '#301818',
  errorRail: '#f7768e',
  border: '#2e344a',
  inputBorder: '#4a5168',
  inputBorderFocus: '#5a6d90',
  inputBorderBusy: '#b09050',
  inputBorderBlocked: '#b07078',
  text: '#c0caf5',
  textMuted: '#565f89',
  brand: '#7a8cad',
  userAccent: 'blue',
  assistantAccent: 'green',
  toolAccent: 'yellow',
  success: 'green',
  warning: 'yellow',
  danger: 'red',
  focus: '#7a9a9a',
  accent: '#6a7fa8',
}

const oneDark: Preset = {
  background: '#282c34',
  surface: '#21252b',
  statusBar: '#1b1d23',
  userMessage: '#2c3a55',
  assistantMessage: '#233028',
  toolCall: '#3a2f18',
  toolResult: '#1e2a1e',
  error: '#3a2020',
  errorRail: '#e06c75',
  border: '#2f3440',
  inputBorder: '#454b58',
  inputBorderFocus: '#4a5f78',
  inputBorderBusy: '#a08a50',
  inputBorderBlocked: '#a05a5a',
  text: '#abb2bf',
  textMuted: '#5c6370',
  brand: '#6a9aa0',
  userAccent: 'blue',
  assistantAccent: 'green',
  toolAccent: 'yellow',
  success: 'green',
  warning: 'yellow',
  danger: 'red',
  focus: '#7a9a9a',
  accent: '#6a8a8a',
}

const byId: Record<string, Preset> = {
  dark,
  light,
  catppuccin,
  tokyonight: tokyonight,
  'tokyo-night': tokyonight,
  'one-dark': oneDark,
  onedark: oneDark,
}

function noColor(id: string): TuiPalette {
  return {
    color: false,
    id,
    background: undefined,
    surface: undefined,
    statusBar: undefined,
    userMessage: undefined,
    assistantMessage: undefined,
    toolCall: undefined,
    toolResult: undefined,
    error: undefined,
    errorRail: undefined,
    border: undefined,
    inputBorder: undefined,
    inputBorderFocus: undefined,
    inputBorderBusy: undefined,
    inputBorderBlocked: undefined,
    text: undefined,
    textMuted: undefined,
    brand: undefined,
    userAccent: undefined,
    assistantAccent: undefined,
    toolAccent: undefined,
    success: undefined,
    warning: undefined,
    danger: undefined,
    focus: undefined,
    accent: undefined,
  }
}

/**
 * 解析 `tui.yaml` 的 `theme` 与终端能力，得到 Ink 用调色板。
 */
export function getTuiPalette(themeId: string, colorEnabled: boolean): TuiPalette {
  const id = themeId.trim().toLowerCase() || 'dark'
  if (!colorEnabled) {
    return noColor(id)
  }
  const base = byId[id] ?? dark
  return { color: true, id, ...base }
}
