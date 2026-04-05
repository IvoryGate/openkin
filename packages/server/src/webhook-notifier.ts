import type { TaskRunEvent, TaskNotifier } from './scheduler.js'
import type { TaskRunEventDto } from '@openkin/shared-contracts'

export interface WebhookNotifierOptions {
  /**
   * Timeout for each webhook POST request in milliseconds.
   * @default 5000
   */
  timeoutMs?: number
  /**
   * Whether to retry once on network failure (5xx or timeout).
   * @default true
   */
  retryOnce?: boolean
}

/**
 * Sends task run events to per-task webhook URLs via HTTP POST.
 *
 * The webhook URL is stored in `scheduled_tasks.webhook_url`.
 * This notifier is given the `webhookUrl` resolver at construction time so it
 * can look up the URL for a given `taskId` without importing the DB directly.
 *
 * Usage:
 *   const notifier = new WebhookNotifier(
 *     (taskId) => db.tasks.findById(taskId)?.webhookUrl ?? null
 *   )
 *   createTaskScheduler({ ..., notifier })
 *
 * Payload (POST body, `Content-Type: application/json`):
 *   TaskRunEventDto  (see @openkin/shared-contracts)
 *
 * The caller's server should return 2xx to acknowledge receipt.
 * On non-2xx or timeout, we retry once after a short delay (if retryOnce=true).
 * Errors are logged but never thrown — they must not break the scheduler.
 */
export class WebhookNotifier implements TaskNotifier {
  private readonly resolveUrl: (taskId: string) => string | null | undefined
  private readonly timeoutMs: number
  private readonly retryOnce: boolean

  constructor(
    resolveUrl: (taskId: string) => string | null | undefined,
    options: WebhookNotifierOptions = {},
  ) {
    this.resolveUrl = resolveUrl
    this.timeoutMs = options.timeoutMs ?? 5_000
    this.retryOnce = options.retryOnce ?? true
  }

  async onTaskRunFinished(event: TaskRunEvent): Promise<void> {
    const url = this.resolveUrl(event.taskId)
    if (!url) return

    const dto: TaskRunEventDto = {
      type: 'task_run_finished',
      taskId: event.taskId,
      taskName: event.taskName,
      runId: event.runId,
      sessionId: event.sessionId,
      traceId: event.traceId,
      status: event.status,
      output: event.output,
      error: event.error,
      startedAt: event.startedAt,
      completedAt: event.completedAt,
      ts: Date.now(),
    }

    const ok = await this.postOnce(url, dto)
    if (!ok && this.retryOnce) {
      // Wait 1s then retry once
      await sleep(1_000)
      const retryOk = await this.postOnce(url, dto)
      if (!retryOk) {
        console.error(`[webhook-notifier] retry also failed for task=${event.taskId} url=${url}`)
      }
    }
  }

  private async postOnce(url: string, dto: TaskRunEventDto): Promise<boolean> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
        signal: controller.signal,
      })
      if (!res.ok) {
        console.error(`[webhook-notifier] non-2xx response ${res.status} for task=${dto.taskId} url=${url}`)
        return false
      }
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[webhook-notifier] request failed for task=${dto.taskId} url=${url}: ${msg}`)
      return false
    } finally {
      clearTimeout(timer)
    }
  }
}

/** Composite notifier — fans out to multiple notifiers in parallel. */
export class CompositeTaskNotifier implements TaskNotifier {
  private readonly notifiers: TaskNotifier[]

  constructor(...notifiers: TaskNotifier[]) {
    this.notifiers = notifiers
  }

  async onTaskRunFinished(event: TaskRunEvent): Promise<void> {
    await Promise.allSettled(
      this.notifiers.map((n) =>
        n.onTaskRunFinished(event).catch((e) => {
          console.error('[composite-notifier] notifier error', e)
        }),
      ),
    )
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
