import { randomUUID } from 'node:crypto'
import { CronExpressionParser } from 'cron-parser'
import type { OpenKinAgent } from '@openkin/core'
import type { Db } from './db/index.js'
import type { DbScheduledTask, TaskTriggerType } from './db/repositories.js'
import { TraceStreamHub } from './trace-stream-hub.js'

// ── Task Notification Interface ───────────────────────────────────────────────
//
// Placeholder for a future user-notification layer.
// When a scheduled task completes (or fails), the scheduler calls these hooks.
// The default implementation is a no-op — plug in a real implementation
// (e.g. WebSocket push, SSE broadcast, webhook, email) when the UI is ready.
//
// See: docs/exec-plans/active/026_task_notifications.md

export interface TaskRunEvent {
  taskId: string
  taskName: string
  runId: string
  sessionId: string
  traceId: string
  status: 'completed' | 'failed'
  /** Agent output text on success, undefined on failure */
  output?: string
  /** Error message on failure */
  error?: string
  startedAt: number
  completedAt: number
}

export interface TaskNotifier {
  /**
   * Called after a task run finishes (success or failure).
   * Implementations must not throw — errors should be caught and logged internally.
   */
  onTaskRunFinished(event: TaskRunEvent): Promise<void>
}

/** Default no-op notifier — does nothing until a real implementation is wired in. */
export const noopTaskNotifier: TaskNotifier = {
  async onTaskRunFinished(_event: TaskRunEvent): Promise<void> {
    // No-op: replace with a real notifier (WebSocket, SSE, webhook, etc.)
  },
}

// ─────────────────────────────────────────────────────────────────────────────

export interface TaskExecutionContext {
  db: Db
  agent: OpenKinAgent
  streamHub: TraceStreamHub
  /** Static number or a getter so callers can return a live value from ConfigService. */
  defaultMaxSteps: number | (() => number)
  /** Optional notifier called after each task run finishes. Defaults to no-op. */
  notifier?: TaskNotifier
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

function currentRetryCount(task: DbScheduledTask, mode: 'scheduled' | 'manual'): number {
  if (mode !== 'scheduled') return 0
  const cfg = parseTriggerConfig(task.triggerConfig)
  return Math.max(0, Number(cfg._openkin_fail_streak ?? 0))
}

function scheduleFailureRetry(db: Db, task: DbScheduledTask, finished: number): void {
  const maxRetries = Number(process.env.OPENKIN_TASK_MAX_RETRIES ?? 2)
  const streak = bumpFailStreak(db, task)
  const fresh = db.tasks.findById(task.id)
  if (!fresh) return

  if (streak <= maxRetries) {
    db.tasks.update(task.id, { nextRunAt: finished + 60_000 })
    return
  }

  const cfg = parseTriggerConfig(fresh.triggerConfig)
  delete cfg._openkin_fail_streak
  const recovery = computeInitialNextRun(fresh.triggerType, JSON.stringify(cfg), finished)
  db.tasks.update(task.id, { triggerConfig: JSON.stringify(cfg), nextRunAt: recovery })
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
  const resolvedMaxSteps = typeof ctx.defaultMaxSteps === 'function' ? ctx.defaultMaxSteps() : ctx.defaultMaxSteps
  const retryCount = currentRetryCount(task, mode)

  // Task runs use an ephemeral in-memory session — NOT persisted to DB.
  // This avoids polluting the chat session list with automated task executions.
  // The sessionId is still recorded on the task_run row for trace lookup.
  ctx.agent.createSession({ id: sessionId, kind: 'task' })

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
    retryCount,
    startedAt: started,
    completedAt: null,
  })

  const notifier = ctx.notifier ?? noopTaskNotifier

  try {
    // Inject a system-level context block so the LLM knows this is an automated
    // scheduled task trigger — NOT a user chat message. This prevents the LLM
    // from responding conversationally (e.g. asking clarifying questions).
    const schedulerSystemSuffix = [
      '## AUTOMATED TASK EXECUTION',
      '',
      'You are currently executing an AUTOMATED SCHEDULED TASK, not responding to a live user.',
      'The message below is a task instruction that was pre-configured and triggered by the scheduler.',
      '',
      'RULES for automated task execution:',
      '- Execute the instruction DIRECTLY and completely. Do NOT ask clarifying questions.',
      '- Do NOT say "please tell me..." or "would you like..." — the user is not present.',
      '- Use the available tools (run_command, read_file, run_script, create-task, etc.) to complete the task.',
      '- When done, provide a concise summary of what was accomplished.',
    ].join('\n')

    // For built-in agents, avoid overriding the agent definition so that the
    // dynamic system-prompt factory (which injects skill descriptions at runtime)
    // is used instead of the static snapshot stored in the DB.
    // For custom agents we still honour the DB-stored system prompt.
    const runOpts = agentRow.isBuiltin
      ? { traceId, maxSteps: resolvedMaxSteps, systemSuffix: schedulerSystemSuffix }
      : {
          traceId,
          systemSuffix: schedulerSystemSuffix,
          agentDefinition: {
            id: agentRow.id,
            name: agentRow.name,
            systemPrompt: agentRow.systemPrompt,
            maxSteps: resolvedMaxSteps,
          },
        }
    const result = await ctx.agent.run(sessionId, text, runOpts)

    const finished = Date.now()
    if (result.status === 'completed') {
      const outJson = JSON.stringify(
        result.output ? { status: result.status, text: result.output } : { status: result.status },
      )
      ctx.db.taskRuns.update(runId, {
        status: 'completed',
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

      // Notify (no-op by default, wired in when UI notification layer is implemented)
      notifier.onTaskRunFinished({
        taskId: task.id,
        taskName: task.name,
        runId,
        sessionId,
        traceId,
        status: 'completed',
        output: result.output != null ? (typeof result.output === 'string' ? result.output : JSON.stringify(result.output)) : undefined,
        startedAt: started,
        completedAt: finished,
      }).catch((e) => console.error('[scheduler] notifier error', e))
    } else {
      ctx.db.taskRuns.update(runId, {
        status: 'failed',
        error: JSON.stringify(result.error ?? { status: result.status }),
        completedAt: finished,
      })

      if (mode === 'scheduled') {
        scheduleFailureRetry(ctx.db, task, finished)
      }

      // Notify failure
      notifier.onTaskRunFinished({
        taskId: task.id,
        taskName: task.name,
        runId,
        sessionId,
        traceId,
        status: 'failed',
        error: result.error ? JSON.stringify(result.error) : `status=${result.status}`,
        startedAt: started,
        completedAt: finished,
      }).catch((e) => console.error('[scheduler] notifier error', e))
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
      scheduleFailureRetry(ctx.db, task, finished)
    }

    // Notify unexpected error
    notifier.onTaskRunFinished({
      taskId: task.id,
      taskName: task.name,
      runId,
      sessionId,
      traceId,
      status: 'failed',
      error: msg,
      startedAt: started,
      completedAt: finished,
    }).catch((e) => console.error('[scheduler] notifier error', e))

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
