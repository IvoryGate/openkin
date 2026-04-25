import type {
  Message,
  ToolResult,
  ContextBuildReportDto,
  ContextBlockDescriptorDto,
  ContextBlockLayerDto,
  ContextBlockProtectionDto,
  ContextCompactDescriptorDto,
  MemoryContributionDescriptorDto,
  MemorySourceKindDto,
} from '@theworld/shared-contracts'
import type { AgentDefinition, AgentRunInput, RunState } from './types.js'

function toolResultToMessage(result: ToolResult): Message {
  /** First line is `tool_call_id` for OpenAI-compatible providers; remainder is tool output JSON. */
  return {
    role: 'tool',
    name: result.name,
    content: [{ type: 'text', text: `${result.toolCallId}\n${JSON.stringify(result.output)}` }],
  }
}

function estimatePartTokens(part: Message['content'][number]): number {
  if (part.type === 'text') {
    return Math.max(1, Math.ceil(part.text.length / 4))
  }
  if (part.type === 'image') {
    return Math.max(85, Math.ceil(part.url.length / 8))
  }
  if (part.type === 'file_ref') {
    return Math.max(16, Math.ceil((part.ref.length + (part.name?.length ?? 0)) / 4))
  }
  if (part.type === 'json') {
    return Math.max(1, Math.ceil(JSON.stringify(part.value).length / 4))
  }
  return 1
}

export function estimateMessageTokens(message: Message): number {
  return message.content.reduce((sum, part) => sum + estimatePartTokens(part), 0)
}

export function estimateMessagesTokens(messages: Message[]): number {
  return messages.reduce((sum, message) => sum + estimateMessageTokens(message), 0)
}

function cloneMessages(messages: Message[]): Message[] {
  return messages.map((message) => ({
    ...message,
    content: message.content.map((part) => (part.type === 'text' ? { ...part } : { ...part })),
  }))
}

export type ContextLayer = 'system' | 'memory' | 'history' | 'recent' | 'tool_result'
export type ProtectionLevel = 'immutable' | 'pinned' | 'compressible'

export interface ContextBlock {
  id: string
  layer: ContextLayer
  protection: ProtectionLevel
  messages: Message[]
  tokenEstimate: number
}

export interface CompressionBudget {
  maxPromptTokens?: number
}

export interface CompressionPolicy {
  fit(blocks: ContextBlock[], budget: CompressionBudget): ContextBlock[]
}

export interface MemoryReadRequest {
  sessionId: string
  agentId: string
  history: Message[]
}

export interface MemoryWriteRequest {
  sessionId: string
  agentId: string
  messages: Message[]
}

export interface MemoryPort {
  read(request: MemoryReadRequest): Promise<Message[]>
  write(request: MemoryWriteRequest): Promise<void>
}

export class NoopMemoryPort implements MemoryPort {
  async read(): Promise<Message[]> {
    return []
  }

  async write(): Promise<void> {}
}

export class InMemoryMemoryPort implements MemoryPort {
  private readonly store = new Map<string, Message[]>()

  async read(request: MemoryReadRequest): Promise<Message[]> {
    return cloneMessages(this.store.get(this.key(request.sessionId, request.agentId)) ?? [])
  }

  async write(request: MemoryWriteRequest): Promise<void> {
    if (request.messages.length === 0) {
      return
    }

    const key = this.key(request.sessionId, request.agentId)
    const existing = this.store.get(key) ?? []
    this.store.set(key, [...existing, ...cloneMessages(request.messages)])
  }

  private key(sessionId: string, agentId: string): string {
    return `${sessionId}:${agentId}`
  }
}

export class TrimCompressionPolicy implements CompressionPolicy {
  fit(blocks: ContextBlock[], budget: CompressionBudget): ContextBlock[] {
    if (!budget.maxPromptTokens) {
      return blocks.filter((block) => block.messages.length > 0)
    }

    const kept: ContextBlock[] = []
    let total = 0

    for (const block of blocks) {
      if (block.messages.length === 0) {
        continue
      }

      if (block.protection !== 'compressible') {
        kept.push(block)
        total += block.tokenEstimate
      }
    }

    const compressible = blocks.filter((block) => block.protection === 'compressible' && block.messages.length > 0)
    for (let index = compressible.length - 1; index >= 0; index -= 1) {
      const block = compressible[index]
      if (total + block.tokenEstimate > budget.maxPromptTokens) {
        continue
      }
      kept.push(block)
      total += block.tokenEstimate
    }

    const ordering = new Map(blocks.map((block, index) => [block.id, index]))
    return kept.sort((left, right) => (ordering.get(left.id) ?? 0) - (ordering.get(right.id) ?? 0))
  }
}

export interface ContextManager {
  beginRun(input: AgentRunInput, state: RunState): Promise<void>
  buildSnapshot(state: RunState): Promise<Message[]>
  appendAssistant(message: Message, state: RunState): Promise<void>
  appendToolResults(results: ToolResult[], state: RunState): Promise<void>
  /** 094: blocks + compact summary; only `SimpleContextManager` implements today. */
  describePromptBuild?(state: RunState): Promise<ContextBuildReportDto>
}

export interface SimpleContextManagerOptions {
  recentWindow?: number
  compressionPolicy?: CompressionPolicy
  memoryPort?: MemoryPort
}

export class SimpleContextManager implements ContextManager {
  private readonly recentWindow: number
  private readonly compressionPolicy: CompressionPolicy
  private readonly memoryPort: MemoryPort

  constructor(
    private readonly agent: AgentDefinition,
    private readonly history: Message[],
    options: SimpleContextManagerOptions = {},
  ) {
    this.recentWindow = options.recentWindow ?? 6
    this.compressionPolicy = options.compressionPolicy ?? new TrimCompressionPolicy()
    this.memoryPort = options.memoryPort ?? new NoopMemoryPort()
  }

  async beginRun(input: AgentRunInput, _state: RunState): Promise<void> {
    // Skip empty user messages (e.g. automated task runs where the instruction
    // is embedded in the system prompt rather than sent as a user turn).
    const isEmpty =
      input.message.content.length === 0 ||
      input.message.content.every(
        (part) => part.type === 'text' && part.text.trim() === '',
      )
    if (!isEmpty) {
      this.history.push(input.message)
    }
  }

  async buildSnapshot(state: RunState): Promise<Message[]> {
    const blocks = await this.buildBlocks(state)
    const fittedBlocks = this.compressionPolicy.fit(blocks, { maxPromptTokens: state.maxPromptTokens })
    return fittedBlocks.flatMap((block) => block.messages)
  }

  async appendAssistant(message: Message, _state: RunState): Promise<void> {
    this.history.push(message)
  }

  async appendToolResults(results: ToolResult[], _state: RunState): Promise<void> {
    for (const result of results) {
      this.history.push(toolResultToMessage(result))
    }
  }

  private async buildBlocks(state: RunState): Promise<ContextBlock[]> {
    const recentCount = Math.min(this.recentWindow, this.history.length)
    const historyCount = this.history.length - recentCount
    const olderMessages = historyCount > 0 ? this.history.slice(0, historyCount) : []
    const recentMessages = recentCount > 0 ? this.history.slice(-recentCount) : []
    const memoryMessages = await this.memoryPort.read({
      sessionId: state.sessionId,
      agentId: state.agentId,
      history: cloneMessages(this.history),
    })

    // overrideSystemPrompt completely replaces the agent's system prompt (and ignores systemSuffix).
    // Used by the scheduler to inject a lean, task-specific prompt without polluting the context
    // with agent-level instructions that don't apply to automated runs.
    let fullSystemPrompt: string
    if (state.overrideSystemPrompt) {
      fullSystemPrompt = state.overrideSystemPrompt
    } else {
      const base =
        typeof this.agent.systemPrompt === 'function'
          ? await this.agent.systemPrompt()
          : this.agent.systemPrompt
      fullSystemPrompt = state.systemSuffix ? `${base}\n\n${state.systemSuffix}` : base
    }

    return [
      this.createBlock(
        'system',
        'system',
        'immutable',
        [{ role: 'system', content: [{ type: 'text', text: fullSystemPrompt }] }],
      ),
      this.createBlock('memory', 'memory', 'pinned', memoryMessages),
      this.createBlock('history', 'history', 'compressible', olderMessages),
      this.createBlock('recent', 'recent', 'pinned', recentMessages),
    ]
  }

  private createBlock(
    id: string,
    layer: ContextLayer,
    protection: ProtectionLevel,
    messages: Message[],
  ): ContextBlock {
    return {
      id,
      layer,
      protection,
      messages,
      tokenEstimate: estimateMessagesTokens(messages),
    }
  }

  async describePromptBuild(state: RunState): Promise<ContextBuildReportDto> {
    const allBlocks = await this.buildBlocks(state)
    const fitted = this.compressionPolicy.fit(allBlocks, { maxPromptTokens: state.maxPromptTokens })
    const fittedIds = new Set(fitted.map((b) => b.id))
    let beforeSum = 0
    for (const b of allBlocks) beforeSum += b.tokenEstimate
    let afterSum = 0
    for (const b of fitted) afterSum += b.tokenEstimate
    const dropped = allBlocks.filter((b) => !fittedIds.has(b.id))
    const droppedTokenEstimate = dropped.reduce((s, b) => s + b.tokenEstimate, 0)

    const blocks: ContextBlockDescriptorDto[] = allBlocks.map((b) => ({
      id: b.id,
      layer: b.layer as ContextBlockLayerDto,
      protection: b.protection as ContextBlockProtectionDto,
      messageCount: b.messages.length,
      estimatedTokens: b.tokenEstimate,
      includedInPrompt: fittedIds.has(b.id),
    }))

    const compact: ContextCompactDescriptorDto = {
      maxPromptTokens: state.maxPromptTokens,
      estimatedTokensBeforeFit: beforeSum,
      estimatedTokensAfterFit: afterSum,
      droppedBlockIds: dropped.map((b) => b.id),
      droppedTokenEstimate,
    }

    const memoryBlock = allBlocks.find((b) => b.layer === 'memory')
    const memKind: MemorySourceKindDto = 'session'
    const memoryContributions: MemoryContributionDescriptorDto[] = memoryBlock
      ? [
          {
            sourceKind: memKind,
            messageCount: memoryBlock.messages.length,
            estimatedTokens: memoryBlock.tokenEstimate,
            label: 'MemoryPort',
          },
        ]
      : []

    const assembledMessages = fitted.flatMap((b) => b.messages)
    return {
      traceId: state.traceId,
      sessionId: state.sessionId,
      stepIndex: state.stepIndex,
      maxPromptTokens: state.maxPromptTokens,
      blocks,
      compact,
      memoryContributions,
      assembledMessageCount: assembledMessages.length,
      assembledEstimatedTokens: estimateMessagesTokens(assembledMessages),
    }
  }
}
