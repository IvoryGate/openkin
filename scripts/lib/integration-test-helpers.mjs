/**
 * Hardening for long-running `pnpm verify`:
 * 1) Child stdio backpressure: after boot, if neither stdout nor stderr is consumed,
 *    the process can block on write and stall HTTP. Resume streams that have no `data` listener.
 * 2) SSE: `await res.text()` on run stream can hang forever if the server never emits a terminal
 *    event. Abort the connection after a bounded time.
 */
export const DEFAULT_SSE_READ_TIMEOUT_MS =
  Number(process.env.THEWORLD_TEST_SSE_TIMEOUT_MS) > 0
    ? Number(process.env.THEWORLD_TEST_SSE_TIMEOUT_MS)
    : 120_000

/**
 * Call after a successful "listening" (or similar) boot probe when stdio is `pipe`
 * and boot listeners have been removed.
 */
export function drainChildStdioForBackpressure(child) {
  if (!child) return
  for (const stream of [child.stdout, child.stderr]) {
    try {
      if (stream && typeof stream.listenerCount === 'function' && stream.listenerCount('data') === 0) {
        stream.resume()
      }
    } catch {
      /* ignore */
    }
  }
}

/**
 * GET a run SSE stream and read the full body, with a single timeout for fetch + read.
 * Rejects with a clear message on timeout or non-OK status.
 */
export async function fetchRunStreamSseText(
  url,
  { timeoutMs = DEFAULT_SSE_READ_TIMEOUT_MS, ...init } = {},
) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: ac.signal })
    if (!res.ok) {
      const hint = await res.text()
      throw new Error(`GET run stream failed: HTTP ${res.status} ${hint.slice(0, 300)}`)
    }
    return await res.text()
  } catch (e) {
    if (e?.name === 'AbortError' || (e && String(e).includes('This operation was aborted'))) {
      throw new Error(`Run SSE read timed out after ${timeoutMs}ms (${url})`)
    }
    throw e
  } finally {
    clearTimeout(t)
  }
}
