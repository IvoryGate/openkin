import { createRunError } from '@theworld/shared-contracts'
import type { RunState } from './types.js'

/** Ensures `finish` is not invoked twice for the same run (single terminal outcome). */
export function assertRunNotYetFinished(state: RunState): void {
  if (state.result !== undefined) {
    throw createRunError(
      'RUN_INTERNAL_ERROR',
      'Invariant: run finish must only run once per trace',
      'runtime',
      { traceId: state.traceId },
    )
  }
}
