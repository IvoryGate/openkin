import { readFile } from 'node:fs/promises'
import { formatCliError } from './errors.js'
import type { CreateTaskRequest } from '@theworld/operator-client'
import { createTheWorldOperatorClient } from '@theworld/operator-client'
import type { CliContext } from './args.js'
import { exitWithError, printJsonLine, println } from './io.js'

function formatTime(ts: number | null | undefined): string {
  if (ts == null) return '-'
  return new Date(ts).toISOString()
}

function parseCreateArgs(args: string[]): { filePath: string } {
  let filePath: string | undefined
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file') {
      const v = args[i + 1]
      if (!v) exitWithError('Missing path for --file')
      filePath = v
      i++
    }
  }
  if (!filePath) {
    exitWithError('Usage: theworld tasks create --file <path.json>')
  }
  return { filePath }
}

export async function runTasksCommand(ctx: CliContext, args: string[]): Promise<void> {
  const sub = args[0]
  if (!sub) {
    exitWithError('Usage: theworld tasks list | show | create | trigger | enable | disable | runs ...\nRun `theworld help tasks`.')
  }

  const op = createTheWorldOperatorClient({
    baseUrl: ctx.baseUrl,
    apiKey: ctx.apiKey,
  })

  try {
    if (sub === 'list') {
      const data = await op.listTasks()
      if (ctx.json) {
        printJsonLine(JSON.stringify(data, null, 2))
        return
      }
      println(`Tasks: ${data.tasks.length}`)
      for (const t of data.tasks) {
        println(`  ${t.id}  ${t.enabled ? 'on' : 'off'}  ${t.name}  (${t.triggerType})`)
      }
      return
    }

    if (sub === 'show') {
      const id = args[1]
      if (!id) exitWithError('Usage: theworld tasks show <id> [--json]')
      const task = await op.getTask(id)
      if (ctx.json) {
        printJsonLine(JSON.stringify(task, null, 2))
        return
      }
      println(`id:           ${task.id}`)
      println(`name:         ${task.name}`)
      println(`enabled:      ${task.enabled}`)
      println(`triggerType:  ${task.triggerType}`)
      println(`agentId:      ${task.agentId}`)
      println(`createdAt:    ${formatTime(task.createdAt)}`)
      return
    }

    if (sub === 'create') {
      const { filePath } = parseCreateArgs(args.slice(1))
      let raw: string
      try {
        raw = await readFile(filePath, 'utf8')
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        exitWithError(`tasks create: cannot read file "${filePath}": ${msg}`)
      }
      let body: CreateTaskRequest
      try {
        body = JSON.parse(raw) as CreateTaskRequest
      } catch {
        exitWithError(`tasks create: "${filePath}" is not valid JSON`)
      }
      if (
        typeof body.name !== 'string' ||
        typeof body.triggerType !== 'string' ||
        typeof body.triggerConfig !== 'object' ||
        body.triggerConfig === null ||
        typeof body.agentId !== 'string' ||
        !body.input ||
        typeof body.input.text !== 'string'
      ) {
        exitWithError(
          'tasks create: JSON must include name, triggerType, triggerConfig (object), agentId, input.text',
        )
      }
      const task = await op.createTask(body)
      if (ctx.json) {
        printJsonLine(JSON.stringify(task, null, 2))
        return
      }
      println(`Created task ${task.id} (${task.name})`)
      return
    }

    if (sub === 'trigger') {
      const id = args[1]
      if (!id) exitWithError('Usage: theworld tasks trigger <id>')
      const res = await op.triggerTask(id)
      if (ctx.json) {
        printJsonLine(JSON.stringify(res, null, 2))
        return
      }
      println(`Triggered task ${id}`)
      println(`traceId:   ${res.traceId}`)
      println(`sessionId: ${res.sessionId}`)
      return
    }

    if (sub === 'enable') {
      const id = args[1]
      if (!id) exitWithError('Usage: theworld tasks enable <id>')
      await op.enableTask(id)
      if (ctx.json) {
        printJsonLine(JSON.stringify({ ok: true, id, enabled: true }, null, 2))
      } else {
        println(`Enabled task ${id}`)
      }
      return
    }

    if (sub === 'disable') {
      const id = args[1]
      if (!id) exitWithError('Usage: theworld tasks disable <id>')
      await op.disableTask(id)
      if (ctx.json) {
        printJsonLine(JSON.stringify({ ok: true, id, enabled: false }, null, 2))
      } else {
        println(`Disabled task ${id}`)
      }
      return
    }

    if (sub === 'runs') {
      const id = args[1]
      if (!id) exitWithError('Usage: theworld tasks runs <id> [--json]')
      const data = await op.listTaskRuns(id)
      if (ctx.json) {
        printJsonLine(JSON.stringify(data, null, 2))
        return
      }
      println(`Runs for task ${id}: ${data.runs.length}`)
      for (const r of data.runs) {
        println(`  ${r.id}  ${r.status}  started=${formatTime(r.startedAt)}`)
      }
      return
    }
  } catch (e: unknown) {
    exitWithError(`tasks ${sub}: ${formatCliError(e)}`)
  }

  exitWithError(`Unknown tasks subcommand: ${sub}\nRun \`theworld help tasks\`.`)
}
