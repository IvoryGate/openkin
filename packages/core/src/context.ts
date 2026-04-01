import type { Message, ToolResult } from '@openkin/shared-contracts'
import type { AgentDefinition, AgentRunInput, RunState } from './types.js'

function toolResultToMessage(result: ToolResult): Message {
  return {
    role: 'tool',
    name: result.name,
    content: [{ type: 'text', text: JSON.stringify(result.output) }],
  }
}

export interface ContextBlock {
  id: string
  layer: 'system' | 'history' | 'recent' | 'tool_result'
  messages: Message[]
}

export interface ContextManager {
  beginRun(input: AgentRunInput, state: RunState): Promise<void>
  buildSnapshot(state: RunState): Promise<Message[]>
  appendAssistant(message: Message, state: RunState): Promise<void>
  appendToolResults(results: ToolResult[], state: RunState): Promise<void>
}

export class SimpleContextManager implements ContextManager {
  constructor(
    private readonly agent: AgentDefinition,
    private readonly history: Message[],
  ) {}

  async beginRun(input: AgentRunInput): Promise<void> {
    this.history.push(input.message)
  }

  async buildSnapshot(): Promise<Message[]> {
    const blocks: ContextBlock[] = [
      {
        id: 'system',
        layer: 'system',
        messages: [{ role: 'system', content: [{ type: 'text', text: this.agent.systemPrompt }] }],
      },
      {
        id: 'history',
        layer: 'history',
        messages: [...this.history],
      },
    ]

    return blocks.flatMap((block) => block.messages)
  }

  async appendAssistant(message: Message): Promise<void> {
    this.history.push(message)
  }

  async appendToolResults(results: ToolResult[]): Promise<void> {
    for (const result of results) {
      this.history.push(toolResultToMessage(result))
    }
  }
}
