import type { RunFinalStatus } from '@theworld/shared-contracts'

export const DESKTOP_VERSION = '0.2.0' as const

const FINAL_STATUSES: RunFinalStatus[] = [
  'completed',
  'aborted',
  'cancelled',
  'budget_exhausted',
  'failed',
]

export function desktopReady(): boolean {
  return FINAL_STATUSES.length > 0
}
