import type { ServerResponse } from 'node:http'
import type { TaskRunEvent, TaskNotifier } from './scheduler.js'
import type { TaskRunEventDto } from '@openkin/shared-contracts'

/**
 * In-process pub/sub bus for task run events.
 *
 * Consumers (e.g. `GET /v1/tasks/events` SSE clients) register via `subscribe()`.
 * The scheduler calls `onTaskRunFinished()` after every task run, which broadcasts
 * a `TaskRunEventDto` to all live SSE connections.
 *
 * Usage:
 *   const bus = new TaskEventBus()
 *   // wire into scheduler:
 *   createTaskScheduler({ ..., notifier: bus })
 *   // wire into HTTP server for SSE:
 *   server.on('GET /v1/tasks/events', (req, res) => bus.addSseClient(res, apiKey))
 */
export class TaskEventBus implements TaskNotifier {
  private readonly clients = new Set<ServerResponse>()

  /** Register an SSE client response. Sends initial comment to keep connection alive. */
  addSseClient(res: ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      // Allow cross-origin access — mirrors the global CORS policy in http-server.ts
      'Access-Control-Allow-Origin': '*',
    })
    // Initial heartbeat so the client knows the connection is live
    res.write(': connected\n\n')
    this.clients.add(res)

    res.on('close', () => {
      this.clients.delete(res)
    })
    res.on('error', () => {
      this.clients.delete(res)
    })
  }

  /** Number of currently connected SSE clients (useful for health checks / metrics). */
  get clientCount(): number {
    return this.clients.size
  }

  /** TaskNotifier implementation — called by the scheduler after each task run. */
  async onTaskRunFinished(event: TaskRunEvent): Promise<void> {
    if (this.clients.size === 0) return

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

    const sseChunk = `event: task_run_finished\ndata: ${JSON.stringify(dto)}\n\n`
    const dead: ServerResponse[] = []

    for (const client of this.clients) {
      try {
        client.write(sseChunk)
      } catch {
        dead.push(client)
      }
    }

    for (const c of dead) {
      this.clients.delete(c)
    }
  }

  /** Send a heartbeat comment to all clients (call periodically to detect dead connections). */
  heartbeat(): void {
    const chunk = ': heartbeat\n\n'
    const dead: ServerResponse[] = []
    for (const client of this.clients) {
      try {
        client.write(chunk)
      } catch {
        dead.push(client)
      }
    }
    for (const c of dead) {
      this.clients.delete(c)
    }
  }
}
