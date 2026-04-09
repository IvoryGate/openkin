import { readEnv, type AgentLifecycleHook, type AgentResult } from '@theworld/core'
import type { Db } from './db/index.js'

/** Persists agent run traces to SQLite (`onRunEnd` only — covers success and failure paths). */
export function createPersistenceHook(db: Db): AgentLifecycleHook {
  const startedAt = new Map<string, number>()

  return {
    onRunStart(ctx) {
      startedAt.set(ctx.traceId, Date.now())
    },

    async onRunEnd(ctx, result: AgentResult) {
      const start = startedAt.get(result.traceId) ?? Date.now()
      startedAt.delete(result.traceId)
      const durationMs = Date.now() - start
      db.traces.upsert({
        traceId: result.traceId,
        sessionId: result.sessionId,
        agentId: ctx.agentId,
        status: result.status,
        steps: JSON.stringify(result.steps),
        durationMs,
        createdAt: start,
      })
      const threshold = Number(readEnv('THEWORLD_SLOW_RUN_THRESHOLD_MS') ?? 30_000)
      if (durationMs > threshold) {
        console.error(
          `[WARN] Slow run detected: traceId=${result.traceId} durationMs=${durationMs}ms (threshold=${threshold}ms)`,
        )
      }
    },
  }
}
