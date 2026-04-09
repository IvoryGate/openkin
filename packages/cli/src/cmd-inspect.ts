import { formatCliError } from './errors.js'
import { createOpenKinClient } from '@theworld/client-sdk'
import { createOpenKinOperatorClient } from '@theworld/operator-client'
import type { CliContext } from './args.js'
import { exitWithError, println } from './io.js'

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
    exitWithError('Usage: theworld inspect health | status | logs | tools | skills ...\nRun `theworld help inspect`.')
  }

  if (sub === 'health') {
    const client = createOpenKinClient({
      baseUrl: ctx.baseUrl,
      apiKey: ctx.apiKey,
    })
    try {
      const result = await client.getHealth()
      if (ctx.json) {
        println(JSON.stringify(result, null, 2))
        return
      }
      println('Health')
      println(`ok: ${result.ok}`)
      println(`version: ${result.version}`)
      println(`db: ${result.db}`)
      println(`uptime: ${result.uptime}`)
      println(`ts: ${new Date(result.ts).toISOString()}`)
    } catch (e: unknown) {
      exitWithError(`inspect health: ${formatCliError(e)}`)
    }
    return
  }

  const op = createOpenKinOperatorClient({
    baseUrl: ctx.baseUrl,
    apiKey: ctx.apiKey,
  })

  try {
    if (sub === 'status') {
      const result = await op.getSystemStatus()
      if (ctx.json) {
        println(JSON.stringify(result, null, 2))
        return
      }
      println('System status')
      println(`version:         ${result.version}`)
      println(`uptime:          ${result.uptime}s`)
      println(`db:              ${result.db}`)
      println(`activeSessions:  ${result.activeSessions}`)
      println(`tools:           builtin=${result.tools.builtin} mcp=${result.tools.mcp} total=${result.tools.total}`)
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
        println(JSON.stringify(result, null, 2))
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
        println(JSON.stringify(result, null, 2))
        return
      }
      println(`Tools: ${result.tools.length}`)
      for (const t of result.tools) {
        println(`  ${t.name}  [${t.source}]  ${t.description ?? ''}`)
      }
      return
    }

    if (sub === 'skills') {
      const result = await op.listSkills()
      if (ctx.json) {
        println(JSON.stringify(result, null, 2))
        return
      }
      println(`Skills: ${result.skills.length}`)
      for (const s of result.skills) {
        println(`  ${s.id}  script=${s.hasScript}  ${s.title}`)
      }
      return
    }
  } catch (e: unknown) {
    exitWithError(`inspect ${sub}: ${formatCliError(e)}`)
  }

  exitWithError(`Unknown inspect subcommand: ${sub}\nRun \`theworld help inspect\`.`)
}
