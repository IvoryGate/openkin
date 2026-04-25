import { exitWithCliError } from './errors.js'
import { createTheWorldClient } from '@theworld/client-sdk'
import { createTheWorldOperatorClient } from '@theworld/operator-client'
import type { CliContext } from './args.js'
import { formatGetRunContextHuman } from './l4-context-view.js'
import {
  formatGetRunContextMemoryHuman,
  formatL4LayeredMemoryTaxonomyHuman,
  L4_LAYERED_MEMORY_TAXONOMY,
} from './l4-layered-memory.js'
import { formatL4ResumesVocabularyHuman } from './l4-background-resume.js'
import {
  formatApprovalRecordHuman,
  formatListApprovalsHuman,
} from './l4-approval-surface.js'
import { exitWithError, printJsonLine, println } from './io.js'

function parseDenyReasonFromArgs(args: string[]): string | undefined {
  const i = args.indexOf('--reason')
  if (i >= 0 && args[i + 1]) {
    return args
      .slice(i + 1)
      .join(' ')
      .trim()
  }
  return undefined
}

function parseLogsArgs(args: string[]): { date?: string; limit?: number } {
  let date: string | undefined
  let limit: number | undefined
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--date') {
      const v = args[i + 1]
      if (!v) exitWithError('Missing value for --date')
      date = v
      i++
      continue
    }
    if (args[i] === '--limit') {
      const v = args[i + 1]
      if (!v) exitWithError('Missing value for --limit')
      limit = Number(v)
      if (!Number.isFinite(limit) || limit < 1) {
        exitWithError('--limit must be a positive number')
      }
      i++
    }
  }
  return { date, limit }
}

export async function runInspectCommand(ctx: CliContext, args: string[]): Promise<void> {
  const sub = args[0]
  if (!sub) {
    exitWithError(
      'Usage: theworld inspect health | status | logs | tools | skills | approvals | approval <id> [approve|deny|cancel] ... | resume | context <traceId> | memory [traceId] ...\nRun `theworld help inspect`.',
    )
  }

  if (sub === 'health') {
    const client = createTheWorldClient({
      baseUrl: ctx.baseUrl,
      apiKey: ctx.apiKey,
    })
    try {
      const result = await client.getHealth()
      if (ctx.json) {
        printJsonLine(JSON.stringify(result, null, 2))
        return
      }
      println('Health')
      println(`ok: ${result.ok}`)
      println(`version: ${result.version}`)
      println(`db: ${result.db}`)
      println(`uptime: ${result.uptime}`)
      println(`ts: ${new Date(result.ts).toISOString()}`)
    } catch (e: unknown) {
      exitWithCliError('inspect health', e)
    }
    return
  }

  const op = createTheWorldOperatorClient({
    baseUrl: ctx.baseUrl,
    apiKey: ctx.apiKey,
  })

  try {
    if (sub === 'status') {
      const result = await op.getSystemStatus()
      if (ctx.json) {
        printJsonLine(JSON.stringify(result, null, 2))
        return
      }
      println('System status')
      println(`version:         ${result.version}`)
      println(`uptime:          ${result.uptime}s`)
      println(`db:              ${result.db}`)
      println(`activeSessions:  ${result.activeSessions}`)
      println(`tools:           builtin=${result.tools.builtin} mcp=${result.tools.mcp} total=${result.tools.total}`)
      println(`L4 approvals:    theworld inspect approvals  (L3 093 queue, 103)`)
      println(`skills loaded:   ${result.skills.loaded}`)
      if (result.skills.list.length) {
        println(`skill ids:       ${result.skills.list.join(', ')}`)
      }
      println(`ts:              ${new Date(result.ts).toISOString()}`)
      return
    }

    if (sub === 'logs') {
      const { date, limit } = parseLogsArgs(args.slice(1))
      const result = await op.listLogs({ date, limit })
      if (ctx.json) {
        printJsonLine(JSON.stringify(result, null, 2))
        return
      }
      println(`Log entries: ${result.logs.length}${result.hasMore ? ' (hasMore=true)' : ''}`)
      for (const entry of result.logs.slice(0, 50)) {
        const ts = typeof entry.ts === 'number' ? new Date(entry.ts).toISOString() : '?'
        const lvl = entry.level ?? '-'
        const msg = typeof entry.message === 'string' ? entry.message : JSON.stringify(entry)
        println(`${ts} [${lvl}] ${msg}`)
      }
      if (result.logs.length > 50) {
        println(`... and ${result.logs.length - 50} more (use --json for full payload)`)
      }
      return
    }

    if (sub === 'tools') {
      const result = await op.listTools()
      if (ctx.json) {
        printJsonLine(JSON.stringify(result, null, 2))
        return
      }
      println(`Tools: ${result.tools.length}`)
      for (const t of result.tools) {
        const risk = t.riskClass ? `risk=${t.riskClass}` : 'risk=—'
        const cat = t.category ? `cat=${t.category}` : 'cat=—'
        println(`  ${t.name}  [${t.source}]  ${risk}  ${cat}  ${t.description ?? ''}`)
      }
      return
    }

    if (sub === 'skills') {
      const result = await op.listSkills()
      if (ctx.json) {
        printJsonLine(JSON.stringify(result, null, 2))
        return
      }
      println(`Skills: ${result.skills.length}`)
      for (const s of result.skills) {
        println(`  ${s.id}  script=${s.hasScript}  ${s.title}`)
      }
      return
    }

    if (sub === 'resume') {
      if (ctx.json) {
        printJsonLine(JSON.stringify({ kind: 'l4_background_resume_vocab', version: 1 }, null, 2))
        return
      }
      println(formatL4ResumesVocabularyHuman())
      return
    }

    if (sub === 'approvals') {
      const data = await op.listApprovals()
      if (ctx.json) {
        printJsonLine(JSON.stringify(data, null, 2))
        return
      }
      println(formatListApprovalsHuman(data))
      return
    }

    if (sub === 'approval') {
      const id = args[1]
      if (!id) {
        exitWithError(
          'Usage: theworld inspect approval <id> [--json]  |  inspect approval <id> approve | deny [--reason <text>] | cancel',
        )
      }
      const action = args[2]?.toLowerCase()
      if (!action) {
        const a = await op.getApproval(id)
        if (ctx.json) {
          printJsonLine(JSON.stringify(a, null, 2))
          return
        }
        println(formatApprovalRecordHuman(a))
        return
      }
      if (action === 'approve') {
        const a = await op.approveApproval(id)
        if (ctx.json) {
          printJsonLine(JSON.stringify(a, null, 2))
          return
        }
        println(formatApprovalRecordHuman(a))
        return
      }
      if (action === 'deny') {
        const reason = parseDenyReasonFromArgs(args.slice(3))
        const a = await op.denyApproval(id, reason ? { reason } : undefined)
        if (ctx.json) {
          printJsonLine(JSON.stringify(a, null, 2))
          return
        }
        println(formatApprovalRecordHuman(a))
        return
      }
      if (action === 'cancel') {
        const a = await op.cancelApproval(id)
        if (ctx.json) {
          printJsonLine(JSON.stringify(a, null, 2))
          return
        }
        println(formatApprovalRecordHuman(a))
        return
      }
      exitWithError(
        'Usage: theworld inspect approval <id> approve | deny [--reason <text>] | cancel',
      )
    }

    if (sub === 'context') {
      const traceId = args[1]
      if (!traceId) {
        exitWithError('Usage: theworld inspect context <traceId> [--json]')
      }
      const result = await op.getRunContext(traceId)
      if (ctx.json) {
        printJsonLine(JSON.stringify(result, null, 2))
        return
      }
      println(formatGetRunContextHuman(traceId, result))
      return
    }

    if (sub === 'memory') {
      const traceId = args[1]
      if (!traceId) {
        if (ctx.json) {
          printJsonLine(
            JSON.stringify(
              { kind: 'l4_layered_memory_taxonomy', version: 1, layers: L4_LAYERED_MEMORY_TAXONOMY },
              null,
              2,
            ),
          )
          return
        }
        println(formatL4LayeredMemoryTaxonomyHuman())
        return
      }
      const result = await op.getRunContext(traceId)
      if (ctx.json) {
        printJsonLine(JSON.stringify(result, null, 2))
        return
      }
      println(formatGetRunContextMemoryHuman(traceId, result))
      return
    }
  } catch (e: unknown) {
    exitWithCliError(`inspect ${sub}`, e)
  }

  exitWithError(`Unknown inspect subcommand: ${sub}\nRun \`theworld help inspect\`.`)
}
