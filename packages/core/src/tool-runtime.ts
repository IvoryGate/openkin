/** L1 tool runtime — skeleton placeholder for Wave 1. */

export interface ToolAccessPolicy {
  canInvoke(toolName: string): boolean
}

export class AllowAllToolAccessPolicy implements ToolAccessPolicy {
  canInvoke(_toolName: string): boolean {
    return true
  }
}

export interface ToolRuntimeView {
  readonly policy: ToolAccessPolicy
}

export interface ToolRuntime {
  getRuntimeView(): ToolRuntimeView
}

export class SkeletonToolRuntime implements ToolRuntime {
  constructor(private readonly policy: ToolAccessPolicy = new AllowAllToolAccessPolicy()) {}

  getRuntimeView(): ToolRuntimeView {
    return { policy: this.policy }
  }
}
