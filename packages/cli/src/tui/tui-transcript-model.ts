/**
 * TUI transcript semantic blocks (063 / THEWORLD_TUI_PRODUCT_DESIGN.md).
 * Not a server contract — presentation only.
 */

import { randomBytes } from 'node:crypto'

export function nextTuiBlockId(): string {
  return randomBytes(6).toString('hex')
}

export type TuiUserBlock = { id: string; type: 'user'; text: string }

export type TuiAssistantBlock = { id: string; type: 'assistant'; text: string }

export type TuiToolCallBlock = { id: string; type: 'tool_call'; name: string; inputSummary: string }

export type TuiToolResultBlock = {
  id: string
  type: 'tool_result'
  name: string
  summary: string
  ok: boolean
}

export type TuiNoteBlock = { id: string; type: 'note'; text: string }

export type TuiErrorBlock = {
  id: string
  type: 'error'
  message: string
  codeSuffix?: string
  tip?: string
}

export type TuiSystemHintBlock = { id: string; type: 'system_hint'; text: string }

export type TuiTranscriptBlock =
  | TuiUserBlock
  | TuiAssistantBlock
  | TuiToolCallBlock
  | TuiToolResultBlock
  | TuiNoteBlock
  | TuiErrorBlock
  | TuiSystemHintBlock

const MAX_JSON_SUMMARY = 140

function truncate(s: string, n: number): string {
  const t = s.trim()
  if (t.length <= n) return t
  return `${t.slice(0, n - 1)}…`
}

export function summarizeToolInput(input: unknown): string {
  try {
    return truncate(JSON.stringify(input), MAX_JSON_SUMMARY)
  } catch {
    return String(input)
  }
}

function shellishSummary(obj: { stdout?: string; stderr?: string; exitCode?: number }): string {
  const o = (obj.stdout ?? '').trim()
  const e = (obj.stderr ?? '').trim()
  const ex = obj.exitCode ?? 0
  const parts: string[] = []
  if (o) parts.push(`out ${truncate(o, 60)}`)
  if (e) parts.push(`err ${truncate(e, 40)}`)
  if (ex !== 0) parts.push(`exit ${ex}`)
  return parts.length ? parts.join(' · ') : `exit ${ex}`
}

export function summarizeToolResultOutput(output: unknown, isError: boolean): string {
  if (isError) {
    if (output && typeof output === 'object' && 'message' in (output as object)) {
      return truncate(String((output as { message?: unknown }).message), MAX_JSON_SUMMARY)
    }
  }
  if (output && typeof output === 'object' && 'stdout' in (output as object)) {
    return shellishSummary(output as { stdout?: string; stderr?: string; exitCode?: number })
  }
  try {
    return truncate(JSON.stringify(output), MAX_JSON_SUMMARY)
  } catch {
    return String(output)
  }
}
