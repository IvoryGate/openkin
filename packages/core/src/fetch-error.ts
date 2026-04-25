/**
 * Unwrap Node/Undici "fetch failed" into a readable string, including nested `cause`
 * (e.g. ECONNRESET, ENOTFOUND, certificate errors).
 */
export function describeFetchError(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  const parts: string[] = []
  let cur: unknown = err
  for (let depth = 0; depth < 5 && cur instanceof Error; depth++) {
    const e = cur as NodeJS.ErrnoException
    const code = e.code ? `${e.code}: ` : ''
    parts.push(`${code}${e.message}`.trim())
    cur = e.cause
  }
  return parts.join(' → ')
}
