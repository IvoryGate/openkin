import { describeFetchError } from '@theworld/core'

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
