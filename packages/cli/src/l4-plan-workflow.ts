/**
 * L4 105 — single-agent plan artifact in workspace `.theworld/plan/state.json`.
 * Review gate is **local** (not L3 approval); execute reuses chat run.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

export type PlanReviewState = 'draft' | 'review' | 'approved' | 'rejected' | 'executed'

export type PlanArtifactV1 = {
  v: 1
  title: string
  /** Markdown body — steps / acceptance criteria */
  body: string
  state: PlanReviewState
  createdAt: number
  updatedAt: number
  /** Optional session this plan is associated with */
  sessionId?: string
  /** When state is review or after revise */
  reviseNotes?: string
}

export function defaultPlanPath(cwd = process.cwd()): string {
  const fromEnv = process.env.THEWORLD_PLAN_CWD?.trim()
  const base = fromEnv || cwd
  return join(base, '.theworld', 'plan', 'state.json')
}

export function loadPlan(path: string): PlanArtifactV1 | null {
  if (!existsSync(path)) return null
  try {
    const raw = readFileSync(path, 'utf8')
    const j = JSON.parse(raw) as PlanArtifactV1
    if (j.v !== 1 || typeof j.body !== 'string' || typeof j.title !== 'string') return null
    return j
  } catch {
    return null
  }
}

export function savePlan(path: string, plan: PlanArtifactV1): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(plan, null, 2), 'utf8')
}

export function initPlanTemplate(title: string, sessionId?: string): PlanArtifactV1 {
  const now = Date.now()
  return {
    v: 1,
    title: title.trim() || 'untitled plan',
    body: [
      '## Goal',
      '',
      '- ',
      '',
      '## Steps',
      '',
      '1. ',
      '',
      '## Acceptance',
      '',
      '- ',
    ].join('\n'),
    state: 'draft',
    createdAt: now,
    updatedAt: now,
    sessionId,
  }
}

export function formatPlanHuman(p: PlanArtifactV1, path: string): string {
  const lines = [
    `Plan artifact (L4 105)  ${path}`,
    `title:    ${p.title}`,
    `state:    ${p.state}`,
    `updated:  ${new Date(p.updatedAt).toISOString()}`,
    p.sessionId ? `session:  ${p.sessionId}` : 'session:  (none)',
    p.reviseNotes ? `notes:    ${p.reviseNotes}` : '',
    '',
    '---',
    p.body,
  ]
  return lines.filter((x) => x !== '').join('\n')
}
