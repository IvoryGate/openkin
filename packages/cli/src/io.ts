/**
 * Output rails (059):
 * - Human-readable CLI output: stderr via `println` / `printHuman`.
 * - Machine JSON: stdout only via `printJsonLine` (single line or pretty-printed block).
 */
export const RESET = '\x1b[0m'
export const BOLD = '\x1b[1m'
export const DIM = '\x1b[2m'
export const CYAN = '\x1b[36m'
export const GREEN = '\x1b[32m'
export const YELLOW = '\x1b[33m'
export const GRAY = '\x1b[90m'
export const RED = '\x1b[31m'

/** Human-oriented line (default CLI rail: stderr). */
export function println(text = ''): void {
  process.stderr.write(text + '\n')
}

/** Same as println; use when the name aids readability at call sites. */
export function printHuman(text: string): void {
  process.stderr.write(text + '\n')
}

/** One machine-readable line on stdout (e.g. JSON). No extra decoration. */
export function printJsonLine(text: string): void {
  process.stdout.write(text + '\n')
}

export function exitWithError(message: string): never {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}
