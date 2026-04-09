import { describeFetchError } from '@theworld/core'

/**
 * SDK / operator API failures often throw plain `RunError` objects (not `Error`).
 * `describeFetchError` only unwraps `Error` chains, so we normalize here for CLI output.
 */
export function formatCliError(err: unknown): string {
  if (
    err &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string' &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string'
  ) {
    const r = err as { code: string; message: string }
    return `${r.code}: ${r.message}`
  }
  return describeFetchError(err)
}
