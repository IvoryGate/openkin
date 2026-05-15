import { randomUUID } from 'node:crypto'
import type { ServerResponse } from 'node:http'
import {
  approvalEventToPlaneEnvelope,
  formatSseEventPlaneV1,
  type ApprovalEventDto,
  type ApprovalRecordDto,
  type CreateApprovalRequestBody,
  type ResolveApprovalRequestBody,
  type RiskClassDto,
} from '@theworld/shared-contracts'

const RISK_SET = new Set<RiskClassDto>(['shell_command', 'file_mutation', 'network', 'destructive'])

/**
 * 093: in-memory approval store + SSE fan-out. Process-local only; L4+ wires tool gates here later.
 */
export class ApprovalPlane {
  private readonly clients = new Set<ServerResponse>()
  private readonly records = new Map<string, ApprovalRecordDto>()
  private readonly expiryTimer: ReturnType<typeof setInterval>

  constructor() {
    this.expiryTimer = setInterval(() => this.sweepExpired(), 500)
    this.expiryTimer.unref?.()
  }

  addSseClient(res: ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })
    res.write(': connected\n\n')
    this.clients.add(res)
    res.on('close', () => this.clients.delete(res))
    res.on('error', () => this.clients.delete(res))
  }

  get clientCount(): number {
    return this.clients.size
  }

  dispose(): void {
    clearInterval(this.expiryTimer)
    for (const client of this.clients) {
      try {
        client.end()
      } catch {
        // ignore
      }
    }
    this.clients.clear()
  }

  get(id: string): ApprovalRecordDto | undefined {
    return this.records.get(id)
  }

  /** Newest `requestedAt` first. L4 list surface for `GET /v1/approvals`. */
  listAll(): ApprovalRecordDto[] {
    return Array.from(this.records.values()).sort((a, b) => b.requestedAt - a.requestedAt)
  }

  create(
    body: CreateApprovalRequestBody,
  ): { ok: true; approval: ApprovalRecordDto } | { ok: false; message: string } {
    if (!body.traceId || typeof body.traceId !== 'string') {
      return { ok: false, message: 'traceId is required' }
    }
    if (!body.sessionId || typeof body.sessionId !== 'string') {
      return { ok: false, message: 'sessionId is required' }
    }
    if (!body.runId || typeof body.runId !== 'string') {
      return { ok: false, message: 'runId is required' }
    }
    if (!body.summary || typeof body.summary !== 'string' || !body.summary.trim()) {
      return { ok: false, message: 'summary is required' }
    }
    if (!body.riskClass || !RISK_SET.has(body.riskClass)) {
      return { ok: false, message: 'riskClass must be a known RiskClassDto value' }
    }
    const now = Date.now()
    let expiresAt: number | null
    if (body.ttlMs === 0) {
      expiresAt = null
    } else if (body.ttlMs == null) {
      expiresAt = now + 300_000
    } else if (typeof body.ttlMs === 'number' && Number.isFinite(body.ttlMs) && body.ttlMs > 0) {
      expiresAt = now + body.ttlMs
    } else {
      return { ok: false, message: 'ttlMs must be 0, positive ms, or omitted' }
    }

    const rec: ApprovalRecordDto = {
      id: randomUUID(),
      traceId: body.traceId,
      sessionId: body.sessionId,
      runId: body.runId,
      riskClass: body.riskClass,
      toolName: typeof body.toolName === 'string' ? body.toolName : undefined,
      summary: body.summary.trim(),
      status: 'pending',
      requestedAt: now,
      expiresAt,
      resolvedAt: null,
    }
    this.records.set(rec.id, rec)
    this.emit({
      type: 'approval_requested',
      approval: { ...rec },
      ts: now,
    })
    return { ok: true, approval: { ...rec } }
  }

  approve(
    id: string,
    body?: ResolveApprovalRequestBody,
  ): { ok: true; approval: ApprovalRecordDto } | { ok: false; code: 'NOT_FOUND' | 'CONFLICT'; message: string } {
    return this.resolve(id, 'approved', body?.reason)
  }

  deny(
    id: string,
    body?: ResolveApprovalRequestBody,
  ): { ok: true; approval: ApprovalRecordDto } | { ok: false; code: 'NOT_FOUND' | 'CONFLICT'; message: string } {
    return this.resolve(id, 'denied', body?.reason)
  }

  cancel(
    id: string,
  ): { ok: true; approval: ApprovalRecordDto } | { ok: false; code: 'NOT_FOUND' | 'CONFLICT'; message: string } {
    return this.resolve(id, 'cancelled', undefined)
  }

  private resolve(
    id: string,
    resolution: 'approved' | 'denied' | 'expired' | 'cancelled',
    reason: string | undefined,
  ): { ok: true; approval: ApprovalRecordDto } | { ok: false; code: 'NOT_FOUND' | 'CONFLICT'; message: string } {
    const rec = this.records.get(id)
    if (!rec) {
      return { ok: false, code: 'NOT_FOUND', message: 'Approval not found' }
    }
    if (rec.status !== 'pending') {
      return { ok: false, code: 'CONFLICT', message: `Approval is not pending (status=${rec.status})` }
    }
    const now = Date.now()
    if (rec.expiresAt != null && now > rec.expiresAt && resolution !== 'expired') {
      return { ok: false, code: 'CONFLICT', message: 'Approval already expired' }
    }
    const next: ApprovalRecordDto = {
      ...rec,
      status: resolution === 'expired' ? 'expired' : resolution,
      resolvedAt: now,
      reason: reason?.trim() || rec.reason,
    }
    this.records.set(id, next)
    this.emit({
      type: 'approval_resolved',
      approval: { ...next },
      resolution,
      ts: now,
    })
    return { ok: true, approval: { ...next } }
  }

  private sweepExpired(): void {
    const now = Date.now()
    for (const [id, rec] of this.records) {
      if (rec.status !== 'pending' || rec.expiresAt == null) continue
      if (now > rec.expiresAt) {
        this.resolve(id, 'expired', undefined)
      }
    }
  }

  private emit(dto: ApprovalEventDto): void {
    if (this.clients.size === 0) return
    const plane = approvalEventToPlaneEnvelope(dto)
    const chunk = formatSseEventPlaneV1(plane)
    const dead: ServerResponse[] = []
    for (const c of this.clients) {
      try {
        c.write(chunk)
      } catch {
        dead.push(c)
      }
    }
    for (const c of dead) this.clients.delete(c)
  }
}
