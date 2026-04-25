import { describeFetchError } from '@theworld/core'
import { errorRecoveryExtraLines } from './l4-onboarding.js'

/**
 * SDK / operator API failures often throw plain `RunError` objects (not `Error`).
 * `describeFetchError` only unwraps `Error` chains, so we normalize here for CLI output.
 */
export function formatCliError(err: unknown): string {
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>
    const msg = o.message
    const code = o.code
    if (typeof msg === 'string' && msg.trim()) {
      if (typeof code === 'string' && code.trim()) {
        return `${code}: ${msg}`
      }
      return msg
    }
  }
  const s = describeFetchError(err)
  if (s === '[object Object]' && err && typeof err === 'object') {
    try {
      return JSON.stringify(err)
    } catch {
      /* ignore */
    }
  }
  return s
}

/** Exit 1 after printing recovery lines (L4 onboarding / network hints). */
export function exitWithCliError(prefix: string, err: unknown): never {
  const msg = formatCliError(err)
  process.stderr.write(`${prefix}: ${msg}\n`)
  for (const line of errorRecoveryExtraLines(msg)) {
    process.stderr.write(`${line}\n`)
  }
  process.exit(1)
}
