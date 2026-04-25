import type { StreamEvent } from '@theworld/shared-contracts'

type Handler = (event: StreamEvent) => void

/**
 * Buffers SSE events per trace until a subscriber connects.
 * A trace stays "known" until a terminal event is delivered to a subscriber (or was buffered and then drained).
 */
export class TraceStreamHub {
  private readonly known = new Set<string>()
  private readonly buffers = new Map<string, StreamEvent[]>()
  private readonly subscribers = new Map<string, Handler>()

  reserve(traceId: string): void {
    this.known.add(traceId)
  }

  /** True if this trace may still be subscribed to (run in flight, or events buffered including terminal). */
  isKnown(traceId: string): boolean {
    return this.known.has(traceId) || this.buffers.has(traceId)
  }

  subscribe(traceId: string, handler: Handler): void {
    this.subscribers.set(traceId, handler)
    const pending = this.buffers.get(traceId) ?? []
    this.buffers.delete(traceId)
    for (const event of pending) {
      handler(event)
      if (event.type === 'run_completed' || event.type === 'run_failed') {
        this.finish(traceId)
      }
    }
  }

  unsubscribe(traceId: string): void {
    this.subscribers.delete(traceId)
  }

  emit(traceId: string, event: StreamEvent): void {
    const handler = this.subscribers.get(traceId)
    if (handler) {
      handler(event)
      if (event.type === 'run_completed' || event.type === 'run_failed') {
        this.finish(traceId)
      }
    } else {
      const buf = this.buffers.get(traceId) ?? []
      buf.push(event)
      this.buffers.set(traceId, buf)
    }
  }

  private finish(traceId: string): void {
    this.known.delete(traceId)
    this.subscribers.delete(traceId)
    this.buffers.delete(traceId)
  }
}
