import type { StepTrace } from '@theworld/core'
import {
  DEFAULT_RUN_EXECUTION_MODE,
  DEFAULT_RUN_STREAM_ATTACHMENT,
  type RunExecutionMode,
  type RunFinalStatus,
  type RunStepDto,
  type RunStreamAttachment,
  type ToolCallSummary,
  type ToolResultSummary,
  type TraceDto,
  type TraceSummaryDto,
} from '@theworld/shared-contracts'
import type { DbTrace } from './db/repositories.js'

const OUT_TRUNC = 500

function truncateOut(s: string): string {
  if (s.length <= OUT_TRUNC) return s
  return s.slice(0, OUT_TRUNC) + '…'
}

function mapToolCall(tc: { id: string; name: string; input: Record<string, unknown> }): ToolCallSummary {
  return { id: tc.id, name: tc.name, input: tc.input }
}

function mapToolResult(tr: {
  toolCallId: string
  name: string
  output: unknown
  isError?: boolean
}): ToolResultSummary {
  const raw = JSON.stringify(tr.output)
  return {
    toolCallId: tr.toolCallId,
    name: tr.name,
    isError: Boolean(tr.isError),
    outputSummary: truncateOut(raw),
  }
}

function mapStep(st: StepTrace): RunStepDto {
  const toolCalls = st.toolCalls?.map(mapToolCall)
  const toolResults = st.toolResults?.map(mapToolResult)
  return {
    stepIndex: st.stepIndex,
    toolCalls,
    toolResults,
    ...(st.outputText !== undefined ? { outputText: st.outputText } : {}),
  }
}

export interface RunLifecycleFields {
  executionMode: RunExecutionMode
  streamAttachment: RunStreamAttachment
}

function resolveLifecycle(
  meta?: Partial<RunLifecycleFields>,
): RunLifecycleFields {
  return {
    executionMode: meta?.executionMode ?? DEFAULT_RUN_EXECUTION_MODE,
    streamAttachment: meta?.streamAttachment ?? DEFAULT_RUN_STREAM_ATTACHMENT,
  }
}

export function dbTraceToTraceDto(row: DbTrace, meta?: Partial<RunLifecycleFields>): TraceDto {
  let stepsRaw: StepTrace[] = []
  try {
    stepsRaw = JSON.parse(row.steps) as StepTrace[]
  } catch {
    stepsRaw = []
  }
  const steps: RunStepDto[] = stepsRaw.map(mapStep)
  const lc = resolveLifecycle(meta)
  return {
    traceId: row.traceId,
    sessionId: row.sessionId,
    agentId: row.agentId,
    status: row.status as RunFinalStatus,
    steps,
    durationMs: row.durationMs,
    createdAt: row.createdAt,
    executionMode: lc.executionMode,
    streamAttachment: lc.streamAttachment,
  }
}

export function dbTraceToSummaryDto(row: DbTrace, meta?: Partial<RunLifecycleFields>): TraceSummaryDto {
  let stepCount = 0
  try {
    const parsed = JSON.parse(row.steps) as unknown[]
    stepCount = Array.isArray(parsed) ? parsed.length : 0
  } catch {
    stepCount = 0
  }
  const lc = resolveLifecycle(meta)
  return {
    traceId: row.traceId,
    sessionId: row.sessionId,
    agentId: row.agentId,
    status: row.status as RunFinalStatus,
    stepCount,
    durationMs: row.durationMs,
    createdAt: row.createdAt,
    executionMode: lc.executionMode,
    streamAttachment: lc.streamAttachment,
  }
}
