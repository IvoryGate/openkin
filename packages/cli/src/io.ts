export const RESET = '\x1b[0m'
export const BOLD = '\x1b[1m'
export const DIM = '\x1b[2m'
export const CYAN = '\x1b[36m'
export const GREEN = '\x1b[32m'
export const YELLOW = '\x1b[33m'
export const GRAY = '\x1b[90m'
export const RED = '\x1b[31m'

export function println(text = ''): void {
  process.stdout.write(text + '\n')
}

export function exitWithError(message: string): never {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}
