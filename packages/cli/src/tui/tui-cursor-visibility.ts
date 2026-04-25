import process from 'node:process'
import cliCursor from 'cli-cursor'

/** 082：隐藏硬件光标，避免其落在**最后一行**（状态栏/底栏）；用输入框内假 caret。 */
export const TUI_CURSOR_HIDE = '\u001b[?25l'
export const TUI_CURSOR_SHOW = '\u001b[?25h'

export function tuiCursorHideEnabled(): boolean {
  return process.env.THEWORLD_TUI_SHOW_CURSOR?.trim() !== '1'
}

/** Ink 画在 `stdout` 上，必须对**同一流** DECTCEM；`cli-cursor` 默认写 stderr 会仍见块光标。 */
export function tuiCursorHideWithCli(): void {
  if (tuiCursorHideEnabled()) {
    try {
      cliCursor.hide(process.stdout)
      cliCursor.hide(process.stderr)
    } catch {
      process.stdout.write(TUI_CURSOR_HIDE)
      process.stderr.write(TUI_CURSOR_HIDE)
    }
  }
}

export function tuiCursorShowWithCli(): void {
  if (tuiCursorHideEnabled()) {
    try {
      cliCursor.show(process.stdout)
      cliCursor.show(process.stderr)
    } catch {
      process.stdout.write(TUI_CURSOR_SHOW)
      process.stderr.write(TUI_CURSOR_SHOW)
    }
  }
}
