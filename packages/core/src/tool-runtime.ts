import { createRunError, type ToolCall, type ToolResult } from '@openkin/shared-contracts'
import type { Session } from './session.js'
import type { AgentDefinition, RunState } from './types.js'

export interface ToolDefinition {
  name: string
  description: string
  inputSchema?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface ToolExecutionContext {
  traceId: string
  sessionId: string
  agentId: string
  stepIndex: number
}

export interface ToolExecutor {
  execute(input: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult>
}

export interface ToolProvider {
  id: string
  sourceType: 'builtin' | 'skill' | 'mcp' | 'custom'
  listTools(): Promise<ToolDefinition[]>
  getExecutor(name: string): Promise<ToolExecutor | undefined>
}

export interface ToolAccessPolicy {
  filterVisibleTools(args: {
    agent: AgentDefinition
    session: Session
    toolDefinitions: ToolDefinition[]
    metadata?: Record<string, unknown>
  }): Promise<ToolDefinition[]>
}

export interface ToolRuntimeView {
  toolDefinitions: ToolDefinition[]
  getToolSchemaList(): ToolDefinition[]
  resolve(name: string): Promise<ToolExecutor | undefined>
}

export interface ToolRuntime {
  getRuntimeView(args: {
    agent: AgentDefinition
    session: Session
    state: RunState
    metadata?: Record<string, unknown>
  }): Promise<ToolRuntimeView>
}

export class AllowAllToolAccessPolicy implements ToolAccessPolicy {
  async filterVisibleTools(args: {
    agent: AgentDefinition
    session: Session
    toolDefinitions: ToolDefinition[]
    metadata?: Record<string, unknown>
  }): Promise<ToolDefinition[]> {
    return args.toolDefinitions
  }
}

export class StaticToolProvider implements ToolProvider {
  constructor(
    public readonly id: string,
    public readonly sourceType: 'builtin' | 'skill' | 'mcp' | 'custom',
    private readonly definitions: ToolDefinition[],
    private readonly executors: Record<string, ToolExecutor>,
  ) {}

  async listTools(): Promise<ToolDefinition[]> {
    return this.definitions
  }

  async getExecutor(name: string): Promise<ToolExecutor | undefined> {
    return this.executors[name]
  }
}

class StaticToolRuntimeView implements ToolRuntimeView {
  constructor(
    public readonly toolDefinitions: ToolDefinition[],
    private readonly executors: Map<string, ToolExecutor>,
  ) {}

  getToolSchemaList(): ToolDefinition[] {
    return this.toolDefinitions
  }

  async resolve(name: string): Promise<ToolExecutor | undefined> {
    return this.executors.get(name)
  }
}

export class InMemoryToolRuntime implements ToolRuntime {
  private _providers: ToolProvider[]

  constructor(
    providers: ToolProvider[],
    private readonly accessPolicy: ToolAccessPolicy = new AllowAllToolAccessPolicy(),
  ) {
    this._providers = [...providers]
  }

  /**
   * Hot-register a new provider at runtime (no restart required).
   * If a provider with the same id already exists it is replaced in-place.
   */
  registerProvider(provider: ToolProvider): void {
    const existingIndex = this._providers.findIndex((p) => p.id === provider.id)
    if (existingIndex >= 0) {
      this._providers[existingIndex] = provider
    } else {
      this._providers.push(provider)
    }
  }

  /**
   * Hot-unregister a provider by id.
   * No-op if the id is not registered.
   */
  unregisterProvider(id: string): void {
    this._providers = this._providers.filter((p) => p.id !== id)
  }

  /**
   * Return a read-only snapshot of all registered providers.
   * Used by operator/debug APIs (e.g. GET /v1/system/status, GET /v1/tools).
   */
  getProviders(): ReadonlyArray<ToolProvider> {
    return this._providers
  }

  async getRuntimeView(args: {
    agent: AgentDefinition
    session: Session
    state: RunState
    metadata?: Record<string, unknown>
  }): Promise<ToolRuntimeView> {
    const definitionsByName = new Map<string, ToolDefinition>()
    const executors = new Map<string, ToolExecutor>()

    for (const provider of this._providers) {
      const definitions = await provider.listTools()
      for (const definition of definitions) {
        definitionsByName.set(definition.name, definition)
        const executor = await provider.getExecutor(definition.name)
        if (executor) {
          executors.set(definition.name, executor)
        }
      }
    }

    const visibleTools = await this.accessPolicy.filterVisibleTools({
      agent: args.agent,
      session: args.session,
      toolDefinitions: [...definitionsByName.values()],
      metadata: args.metadata,
    })

    return new StaticToolRuntimeView(visibleTools, executors)
  }
}

export async function executeToolCall(args: {
  call: ToolCall
  runtimeView: ToolRuntimeView
  state: RunState
}): Promise<ToolResult> {
  const executor = await args.runtimeView.resolve(args.call.name)
  if (!executor) {
    return {
      toolCallId: args.call.id,
      name: args.call.name,
      output: createRunError(
        'TOOL_NOT_FOUND',
        `Tool not found: ${args.call.name}`,
        'tool',
        { toolName: args.call.name },
      ),
      isError: true,
    }
  }

  const result = await executor.execute(args.call.input, {
    traceId: args.state.traceId,
    sessionId: args.state.sessionId,
    agentId: args.state.agentId,
    stepIndex: args.state.stepIndex,
  })
  // Ensure the tool result's toolCallId matches the call.id from the LLM.
  // OpenAI protocol requires assistant.tool_calls[].id === tool.tool_call_id.
  return { ...result, toolCallId: args.call.id }
}
