import { randomUUID } from 'node:crypto'
import { CronExpressionParser } from 'cron-parser'
import type { OpenKinAgent } from '@openkin/core'
import type { Db } from './db/index.js'
import type { DbScheduledTask, TaskTriggerType } from './db/repositories.js'
import { TraceStreamHub } from './trace-stream-hub.js'

export interface TaskExecutionContext {
  db: Db
  agent: OpenKinAgent
  streamHub: TraceStreamHub
  defaultMaxSteps: number
}

export interface TaskSchedulerDeps extends TaskExecutionContext {
  tickMs?: number
}

function parseTriggerConfig(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

function cronNext(cron: string, fromMs: number): number {
  const exp = CronExpressionParser.parse(cron, { currentDate: new Date(fromMs), tz: 'UTC' })
  return exp.next().getTime()
}

/** Compute first `next_run_at` when creating a task. */
export function computeInitialNextRun(
  triggerType: TaskTriggerType,
  triggerConfig: string,
  now: number,
): number | null {
  const cfg = parseTriggerConfig(triggerConfig)
  if (triggerType === 'interval') {
    const sec = Number(cfg.interval_seconds ?? 60)
    return now + sec * 1000
  }
  if (triggerType === 'once') {
    return cfg.once_at != null ? Number(cfg.once_at) : null
  }
  if (triggerType === 'cron') {
    const cron = String(cfg.cron ?? '0 * * * *')
    return cronNext(cron, now)
  }
  return null
}

/** Returns an error message if invalid, otherwise `null`. */
export function validateTaskTrigger(triggerType: TaskTriggerType, cfg: Record<string, unknown>): string | null {
  if (triggerType === 'interval') {
    const sec = Number(cfg.interval_seconds)
    if (!Number.isFinite(sec) || sec <= 0) return 'interval requires positive interval_seconds'
  } else if (triggerType === 'once') {
    if (cfg.once_at == null) return 'once requires once_at (unix ms)'
    const t = Number(cfg.once_at)
    if (!Number.isFinite(t)) return 'once_at must be a number'
  } else if (triggerType === 'cron') {
    if (typeof cfg.cron !== 'string' || !cfg.cron.trim()) return 'cron requires a non-empty cron string'
    try {
      CronExpressionParser.parse(cfg.cron, { currentDate: new Date(), tz: 'UTC' })
    } catch (e: unknown) {
      return e instanceof Error ? e.message : String(e)
    }
  }
  return null
}

function computeNextAfterSuccess(task: DbScheduledTask, finishedAt: number): { nextRunAt: number | null; disable: boolean } {
  const cfg = parseTriggerConfig(task.triggerConfig)
  if (task.triggerType === 'once') {
    return { nextRunAt: null, disable: true }
  }
  if (task.triggerType === 'interval') {
    const sec = Number(cfg.interval_seconds ?? 60)
    return { nextRunAt: finishedAt + sec * 1000, disable: false }
  }
  if (task.triggerType === 'cron') {
    const cron = String(cfg.cron ?? '0 * * * *')
    return { nextRunAt: cronNext(cron, finishedAt), disable: false }
  }
  return { nextRunAt: null, disable: false }
}

function clearFailStreak(db: Db, taskId: string): void {
  const t = db.tasks.findById(taskId)
  if (!t) return
  const cfg = parseTriggerConfig(t.triggerConfig)
  if (!('_openkin_fail_streak' in cfg)) return
  delete cfg._openkin_fail_streak
  db.tasks.update(taskId, { triggerConfig: JSON.stringify(cfg) })
}

function bumpFailStreak(db: Db, task: DbScheduledTask): number {
  const cfg = parseTriggerConfig(task.triggerConfig)
  const streak = Number(cfg._openkin_fail_streak ?? 0) + 1
  cfg._openkin_fail_streak = streak
  db.tasks.update(task.id, { triggerConfig: JSON.stringify(cfg) })
  return streak
}

/**
 * Runs one task execution (scheduled tick or manual `POST .../trigger`).
 * - `scheduled`: claims the task (`next_run_at = null`), updates schedule on completion/failure.
 * - `manual`: does not change `next_run_at` except never (forbidden by plan).
 */
export async function executeTaskRun(
  ctx: TaskExecutionContext,
  task: DbScheduledTask,
  mode: 'scheduled' | 'manual',
): Promise<{ runId: string; traceId: string; sessionId: string }> {
  const agentRow = ctx.db.agents.findById(task.agentId)
  if (!agentRow || !agentRow.enabled) {
    throw new Error('Agent not found or disabled')
  }

  const inputObj = parseTriggerConfig(task.input) as { text?: string }
  const text = typeof inputObj.text === 'string' ? inputObj.text : ''
  if (!text) {
    throw new Error('Task input.text is required')
  }

  if (mode === 'scheduled') {
    ctx.db.tasks.update(task.id, { nextRunAt: null })
  }

  const sessionId = randomUUID()
  const traceId = `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const runId = randomUUID()
  const started = Date.now()

  ctx.agent.createSession({ id: sessionId, kind: 'task' })
  ctx.db.sessions.insert({
    id: sessionId,
    kind: 'task',
    agentId: task.agentId,
    createdAt: started,
  })

  ctx.streamHub.reserve(traceId)
  ctx.db.taskRuns.insert({
    id: runId,
    taskId: task.id,
    status: 'running',
    progress: null,
    progressMsg: null,
    output: null,
    error: null,
    traceId,
    sessionId,
    retryCount: 0,
    startedAt: started,
    completedAt: null,
  })

  try {
    const result = await ctx.agent.run(sessionId, text, {
      traceId,
      agentDefinition: {
        id: agentRow.id,
        name: agentRow.name,
        systemPrompt: agentRow.systemPrompt,
        maxSteps: ctx.defaultMaxSteps,
      },
    })

    const finished = Date.now()
    const outJson = JSON.stringify(
      result.output ? { status: result.status, text: result.output } : { status: result.status },
    )
    ctx.db.taskRuns.update(runId, {
      status: result.status === 'completed' ? 'completed' : 'failed',
      output: outJson,
      completedAt: finished,
    })

    if (mode === 'scheduled') {
      clearFailStreak(ctx.db, task.id)
      const { nextRunAt, disable } = computeNextAfterSuccess(task, finished)
      if (disable) {
        ctx.db.tasks.update(task.id, { enabled: false, nextRunAt: null })
      } else {
        ctx.db.tasks.update(task.id, { nextRunAt })
      }
    }

    return { runId, traceId, sessionId }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const finished = Date.now()
    ctx.db.taskRuns.update(runId, {
      status: 'failed',
      error: JSON.stringify({ message: msg }),
      completedAt: finished,
    })

    if (mode === 'scheduled') {
      const maxRetries = Number(process.env.OPENKIN_TASK_MAX_RETRIES ?? 2)
      const streak = bumpFailStreak(ctx.db, task)
      const fresh = ctx.db.tasks.findById(task.id)
      if (!fresh) return { runId, traceId, sessionId }

      if (streak <= maxRetries) {
        ctx.db.tasks.update(task.id, { nextRunAt: finished + 60_000 })
      } else {
        const cfg = parseTriggerConfig(fresh.triggerConfig)
        delete cfg._openkin_fail_streak
        const recovery = computeInitialNextRun(fresh.triggerType, JSON.stringify(cfg), finished)
        ctx.db.tasks.update(task.id, { triggerConfig: JSON.stringify(cfg), nextRunAt: recovery })
      }
    }

    return { runId, traceId, sessionId }
  }
}

export function createTaskScheduler(deps: TaskSchedulerDeps): () => void {
  const tickMs = deps.tickMs ?? 10_000
  const maxConcurrent = Number(process.env.OPENKIN_TASK_MAX_CONCURRENT ?? 3)
  let running = 0
  let stopped = false

  const ctx: TaskExecutionContext = {
    db: deps.db,
    agent: deps.agent,
    streamHub: deps.streamHub,
    defaultMaxSteps: deps.defaultMaxSteps,
  }

  async function tick(): Promise<void> {
    if (stopped) return
    const now = Date.now()
    const due = deps.db.tasks.listDue(now)
    for (const task of due) {
      if (running >= maxConcurrent) break
      running += 1
      void executeTaskRun(ctx, task, 'scheduled')
        .catch((err) => {
          console.error('[scheduler] task error', task.id, err)
        })
        .finally(() => {
          running -= 1
        })
    }
  }

  const timer = setInterval(() => {
    void tick()
  }, tickMs)

  return () => {
    stopped = true
    clearInterval(timer)
  }
}
