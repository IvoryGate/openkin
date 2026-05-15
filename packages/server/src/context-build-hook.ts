import type { ContextBuildReportDto } from '@theworld/shared-contracts'
import { SimpleContextManager } from '@theworld/core'
import type { AgentLifecycleHook, TheWorldAgent } from '@theworld/core'

/**
 * 094: capture per-step `ContextBuildReportDto` in memory; consumed by `GET /v1/runs/:traceId/context`.
 */
export function createContextBuildHook(
  getAgent: () => TheWorldAgent,
  byTrace: Map<string, ContextBuildReportDto[]>,
): AgentLifecycleHook {
  return {
    onRunStart(ctx) {
      byTrace.set(ctx.traceId, [])
    },
    async onPromptAssembled(state) {
      const rt = getAgent().getSessionRuntime(state.sessionId)
      const cm = rt?.contextManager
      if (cm instanceof SimpleContextManager) {
        const r = await cm.describePromptBuild(state)
        const arr = byTrace.get(state.traceId) ?? []
        arr.push(r)
        byTrace.set(state.traceId, arr)
      }
    },
  }
}
