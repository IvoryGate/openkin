/**
 * 056: optional full-screen chat TUI (Ink). See docs/exec-plans/active/056_cli_chat_fullscreen_tui.md
 */

const TRUTHY = new Set(['1', 'true', 'yes', 'on'])

export function isChatTuiEnvEnabled(): boolean {
  const v = process.env.THEWORLD_CHAT_TUI?.trim().toLowerCase()
  return v != null && v !== '' && TRUTHY.has(v)
}

export function argvRequestsChatTui(argv: string[]): boolean {
  return argv.includes('--tui')
}

export function chatTuiRequested(argv: string[]): boolean {
  return isChatTuiEnvEnabled() || argvRequestsChatTui(argv)
}

export function stripChatTuiArgv(argv: string[]): string[] {
  return argv.filter(a => a !== '--tui')
}
