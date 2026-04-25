/**
 * L4 104 — vocabulary + human formatters for run continuity (session runs list, cancel, recover).
 * Foreground/background/attach 在此指 **客户端与 trace 的约定**（L3 已有 executionMode / streamAttachment），非 OS 进程。
 */
import type { TraceSummaryDto } from '@theworld/operator-client'

export const L4_BACKGROUND_RESUME_VOCAB = {
  foreground:
    'Client intends to keep the run “live” in the current shell; typically you opened SSE (stream) or TUI.',
  background:
    'RunExecutionMode=background: same server pipeline; client may not hold `stream` (L3 090).',
  attached:
    'You are in a product shell (chat) that is bound to a session; streamAttachment=attached in normal chat.',
  detached:
    'streamAttachment=detached: you are not the primary stream consumer; other subscribers may still get SSE.',
  resume:
    'Open or continue a session: `theworld chat --resume <id|alias>`; see also `sessions list`.',
  interrupt:
    'Request cancellation of an in-flight run: `theworld sessions cancel-run <traceId>`.',
  recover_failed:
    'If status=failed: read the last run with `theworld inspect context <traceId>` if a report exists; then send a new message or adjust inputs.',
  recover_cancelled:
    'If status=cancelled: no replay; start a new run with a new user message in the same session.',
  recover_approval:
    'If blocked on approval: `theworld inspect approvals` then resolve the pending id before retrying a dangerous tool.',
} as const

function recoverHintForRun(r: TraceSummaryDto): string | null {
  if (r.status === 'failed') {
    return `${L4_BACKGROUND_RESUME_VOCAB.recover_failed} (this trace: ${r.traceId})`
  }
  if (r.status === 'cancelled' || r.status === 'aborted') {
    return L4_BACKGROUND_RESUME_VOCAB.recover_cancelled
  }
  if (r.status === 'budget_exhausted') {
    return 'Budget exhausted: raise limits or split work; new run required.'
  }
  return null
}

export function formatL4ResumesVocabularyHuman(): string {
  const lines: string[] = [
    'L4 background / resume vocabulary (104)',
    '',
    'These terms are **product language** on top of L3 `TraceSummaryDto` + run lifecycle.',
    '',
  ]
  for (const [k, v] of Object.entries(L4_BACKGROUND_RESUME_VOCAB)) {
    lines.push(`- **${k}** — ${v}`)
  }
  lines.push('')
  lines.push('Practical entry points:')
  lines.push('  theworld sessions runs <sessionId> [--status running|completed|failed] [--json]')
  lines.push('  theworld sessions cancel-run <traceId>   # same as L3 POST /v1/runs/:id/cancel')
  lines.push('  theworld chat --resume <id>              # continue a thread after restart')
  return lines.join('\n')
}

export function formatSessionRunsHuman(data: { runs: TraceSummaryDto[]; hasMore: boolean }): string {
  const lines: string[] = [
    'Session runs (L3 046, L4 104)',
    `count: ${data.runs.length}${data.hasMore ? '  (hasMore=true)' : ''}`,
    '',
  ]
  if (!data.runs.length) {
    lines.push('(no runs in this page — send a message in chat, or raise --limit).')
    return lines.join('\n')
  }
  for (const r of data.runs) {
    const mode = `${r.executionMode}/${r.streamAttachment}`
    lines.push(
      `· ${r.traceId}  ${r.status}  steps=${r.stepCount}  ${r.durationMs != null ? `${r.durationMs}ms` : '—'}  ${mode}  ${new Date(r.createdAt).toISOString()}`,
    )
    const h = recoverHintForRun(r)
    if (h) {
      lines.push(`  → ${h}`)
    }
  }
  return lines.join('\n')
}

function isRunningStatus(s: string): boolean {
  return s === 'running' || s === 'active'
}

export function countRunningRuns(runs: TraceSummaryDto[]): number {
  return runs.filter((r) => isRunningStatus(String(r.status))).length
}

export function formatL4RunsSessionRailSuffix(runs: TraceSummaryDto[]): string | null {
  const n = countRunningRuns(runs)
  if (n === 0) return null
  return `run·${n} active`
}
