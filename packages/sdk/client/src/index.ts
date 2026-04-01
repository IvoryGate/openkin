import type { RunError, StreamEvent } from '@openkin/shared-contracts'

export interface ClientSdkRunRequest {
  sessionId: string
  input: string
}

export interface ClientSdk {
  run(request: ClientSdkRunRequest): Promise<{ traceId: string }>
  subscribe(traceId: string, listener: (event: StreamEvent) => void): void
}

export type ClientSdkError = RunError
