/** v2 shared contracts — skeleton. Wave 1+ extends these types. */

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool'

export interface TextPart {
  type: 'text'
  text: string
}

export type MessagePart = TextPart

export interface Message {
  role: MessageRole
  content: MessagePart[]
  name?: string
}

export type RunFinalStatus =
  | 'completed'
  | 'aborted'
  | 'cancelled'
  | 'budget_exhausted'
  | 'failed'

export const RUN_FINAL_STATUSES: RunFinalStatus[] = [
  'completed',
  'aborted',
  'cancelled',
  'budget_exhausted',
  'failed',
]

export interface ApiEnvelope<T> {
  ok: boolean
  data?: T
  error?: { code: string; message: string }
}
