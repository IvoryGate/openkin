/**
 * L4 103 — human copy for L3 approval queue + recovery hints (no new contract fields).
 */
import type { ApprovalRecordDto, ApprovalStatusDto } from '@theworld/operator-client'

function iso(ts: number | null | undefined): string {
  if (ts == null) return '-'
  return new Date(ts).toISOString()
}

export function formatListApprovalsHuman(data: { approvals: ApprovalRecordDto[] }): string {
  const lines: string[] = [
    'Approvals (L3 in-memory queue; this process only)',
    `count: ${data.approvals.length}`,
    '',
  ]
  if (!data.approvals.length) {
    lines.push('(no records — pending items appear when a tool gate creates a request)')
    return lines.join('\n')
  }
  lines.push('id  status    riskClass        tool?   traceId  sessionId  summary')
  for (const a of data.approvals) {
    const tool = a.toolName ?? '—'
    const sum = a.summary.length > 48 ? `${a.summary.slice(0, 45)}…` : a.summary
    lines.push(
      `${a.id}  ${a.status.padEnd(10, ' ')}  ${a.riskClass.padEnd(15, ' ')}  ${tool.padEnd(6, ' ')}  ${a.traceId}  ${a.sessionId}`,
    )
    lines.push(`    ${sum}`)
    lines.push(`    requested ${iso(a.requestedAt)}  expires ${a.expiresAt != null ? iso(a.expiresAt) : 'never'}`)
    if (a.status !== 'pending') {
      const h = recoveryHintForStatus(a.status, a.id)
      if (h) lines.push(`    → ${h}`)
    }
  }
  return lines.join('\n')
}

export function formatApprovalRecordHuman(a: ApprovalRecordDto): string {
  const lines = [
    `id:          ${a.id}`,
    `status:      ${a.status}`,
    `riskClass:   ${a.riskClass}`,
    `toolName:    ${a.toolName ?? '—'}`,
    `traceId:     ${a.traceId}`,
    `sessionId:   ${a.sessionId}`,
    `runId:       ${a.runId}`,
    `summary:     ${a.summary}`,
    `requestedAt: ${iso(a.requestedAt)}`,
    `expiresAt:   ${a.expiresAt != null ? iso(a.expiresAt) : 'null (no auto-expiry)'}`,
    `resolvedAt:  ${a.resolvedAt != null ? iso(a.resolvedAt) : '—'}`,
    `reason:      ${a.reason ?? '—'}`,
  ]
  const h = recoveryHintForStatus(a.status, a.id)
  if (h) {
    lines.push('')
    lines.push(`Recovery: ${h}`)
  }
  return lines.join('\n')
}

function recoveryHintForStatus(status: ApprovalStatusDto, id: string): string | null {
  if (status === 'denied') {
    return `denied — if the run stopped, adjust policy or retry; id ${id} is closed. New work needs a new approval if the tool runs again.`
  }
  if (status === 'expired') {
    return `expired — TTL elapsed; run  theworld inspect approvals  and re-trigger the action if the server creates a new pending item.`
  }
  if (status === 'cancelled') {
    return `cancelled — request withdrawn; continue with a new run or new approval if required.`
  }
  if (status === 'approved') {
    return `approved — runtime may proceed for this id; if the run already failed, start a new run (queue is not a replay log).`
  }
  return null
}

/** TUI rail suffix: pending approvals for this session. */
export function formatL4ApprovalSessionRailSuffix(
  sessionId: string,
  approvals: ApprovalRecordDto[],
): string | null {
  const n = approvals.filter((a) => a.sessionId === sessionId && a.status === 'pending').length
  if (n === 0) return null
  return `appr·${n} pending`
}
