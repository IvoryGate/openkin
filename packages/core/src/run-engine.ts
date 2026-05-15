/** L1 run engine — skeleton placeholder for Wave 1. */

import type { RunFinalStatus } from '@theworld/shared-contracts'
import type { ToolRuntime } from './tool-runtime.js'

export interface RunHookRunner {
  beforeToolCall?(toolName: string): Promise<void> | void
  afterToolCall?(toolName: string): Promise<void> | void
}

export interface RunState {
  maxPromptTokens: number
  status: RunFinalStatus | 'running'
}

export function assertRunNotYetFinished(state: RunState): void {
  if (state.status !== 'running') {
    throw new Error(`Run already finished: ${state.status}`)
  }
}

export class SkeletonRunEngine {
  constructor(
    private readonly toolRuntime: ToolRuntime,
    private readonly hooks: RunHookRunner = {},
  ) {}

  async finish(state: RunState, finalStatus: RunFinalStatus): Promise<RunState> {
    assertRunNotYetFinished(state)
    const view = this.toolRuntime.getRuntimeView()
    void view.policy
    await this.hooks.beforeToolCall?.('skeleton')
    await this.hooks.afterToolCall?.('skeleton')
    return { ...state, maxPromptTokens: state.maxPromptTokens, status: finalStatus }
  }
}
