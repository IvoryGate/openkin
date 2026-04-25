import { exitWithCliError } from './errors.js'
import { createTheWorldClient } from '@theworld/client-sdk'
import type { CliContext } from './args.js'
import {
  defaultPlanPath,
  formatPlanHuman,
  initPlanTemplate,
  loadPlan,
  savePlan,
  type PlanArtifactV1,
} from './l4-plan-workflow.js'
import { exitWithError, printJsonLine, println } from './io.js'
import { S } from './style.js'

function parseInitArgs(args: string[]): { title: string; sessionId?: string } {
  let title = ''
  let sessionId: string | undefined
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--title' && args[i + 1]) {
      title = args[i + 1]!
      i++
      continue
    }
    if (args[i] === '--session' && args[i + 1]) {
      sessionId = args[i + 1]
      i++
    }
  }
  return { title, sessionId }
}

function parseReviewArgs(args: string[]): { action: 'accept' | 'revise' | 'cancel'; note?: string } {
  const a = args[0]?.toLowerCase()
  if (a === 'accept') return { action: 'accept' }
  if (a === 'cancel') return { action: 'cancel' }
  if (a === 'revise') {
    const i = args.indexOf('--note')
    const note = i >= 0 && args[i + 1] ? args.slice(i + 1).join(' ') : undefined
    return { action: 'revise', note }
  }
  exitWithError('Usage: theworld plan review accept | revise --note <text> | cancel')
}

export async function runPlanCommand(ctx: CliContext, args: string[]): Promise<void> {
  const sub = args[0]
  const path = defaultPlanPath()

  if (!sub) {
    exitWithError(
      'Usage: theworld plan init | show | review | status | execute ...\nRun `theworld help` and see plan (105).',
    )
  }

  if (sub === 'init') {
    const { title, sessionId } = parseInitArgs(args.slice(1))
    if (!title) {
      exitWithError('Usage: theworld plan init --title <text> [--session <id>]')
    }
    const plan = initPlanTemplate(title, sessionId)
    try {
      savePlan(path, plan)
      if (ctx.json) {
        printJsonLine(JSON.stringify(plan, null, 2))
        return
      }
      println(`Wrote ${path}`)
      println(`${S.dim}Edit the file in your editor, then: theworld plan review accept${S.reset}`)
    } catch (e: unknown) {
      exitWithCliError('plan init', e)
    }
    return
  }

  if (sub === 'show' || sub === 'status') {
    const p = loadPlan(path)
    if (!p) {
      exitWithError(`No plan at ${path}. Run: theworld plan init --title "…"`)
    }
    if (ctx.json) {
      printJsonLine(JSON.stringify(p, null, 2))
      return
    }
    println(formatPlanHuman(p, path))
    return
  }

  if (sub === 'review') {
    const p = loadPlan(path)
    if (!p) {
      exitWithError(`No plan at ${path}.`)
    }
    const { action, note } = parseReviewArgs(args.slice(1))
    const now = Date.now()
    let next: PlanArtifactV1
    if (action === 'accept') {
      if (p.state === 'executed') exitWithError('Plan already executed.')
      next = { ...p, state: 'approved', updatedAt: now, reviseNotes: undefined }
    } else if (action === 'cancel') {
      next = { ...p, state: 'rejected', updatedAt: now }
    } else {
      next = {
        ...p,
        state: 'review',
        updatedAt: now,
        reviseNotes: note?.trim() || p.reviseNotes,
        body: note ? `${p.body}\n\n## Revise\n${note}` : p.body,
      }
    }
    try {
      savePlan(path, next)
      if (ctx.json) {
        printJsonLine(JSON.stringify(next, null, 2))
        return
      }
      println(`Plan state → ${next.state}`)
      if (next.state === 'approved') {
        println(`${S.dim}Run: theworld plan execute --session <id>${S.reset}`)
      }
    } catch (e: unknown) {
      exitWithCliError('plan review', e)
    }
    return
  }

  if (sub === 'execute') {
    const sessionId = (() => {
      let s: string | undefined
      const p0 = loadPlan(path)
      for (let i = 1; i < args.length; i++) {
        if (args[i] === '--session' && args[i + 1]) {
          s = args[i + 1]
          i++
        }
      }
      return s ?? p0?.sessionId
    })()
    if (!sessionId) {
      exitWithError('Usage: theworld plan execute --session <id>  (or set session in plan via init --session)')
    }
    const p = loadPlan(path)
    if (!p) {
      exitWithError(`No plan at ${path}.`)
    }
    if (p.state !== 'approved') {
      exitWithError(`Plan must be approved (state=${p.state}). Run: theworld plan review accept`)
    }
    const client = createTheWorldClient({ baseUrl: ctx.baseUrl, apiKey: ctx.apiKey })
    const userLine = `Execute the following approved plan "${p.title}":\n\n${p.body}`
    try {
      let traceId: string | undefined
      await client.streamRun({ sessionId, input: { text: userLine } }, (ev) => {
        if (!traceId && ev.traceId) {
          traceId = ev.traceId
        }
      })
      const next: PlanArtifactV1 = { ...p, state: 'executed', updatedAt: Date.now() }
      savePlan(path, next)
      if (ctx.json) {
        printJsonLine(JSON.stringify({ ok: true, traceId, state: 'executed' }, null, 2))
        return
      }
      println('Plan execution run finished (stream terminal).')
      if (traceId) {
        println(`${S.dim}Context: theworld inspect context ${traceId}${S.reset}`)
      }
    } catch (e: unknown) {
      exitWithCliError('plan execute', e)
    }
    return
  }

  exitWithError(`Unknown plan subcommand: ${sub}`)
}
