import type { Message, ToolCall } from '@openkin/shared-contracts'
import type { ToolDefinition } from './tool-runtime.js'

export interface LLMGenerateRequest {
  messages: Message[]
  tools: ToolDefinition[]
}

export interface LLMGenerateResponse {
  message?: Message
  toolCalls?: ToolCall[]
  finishReason: string
}

export interface LLMProvider {
  generate(request: LLMGenerateRequest): Promise<LLMGenerateResponse>
}

let toolCallCounter = 0

function textOf(message: Message | undefined): string {
  if (!message) return ''
  return message.content
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join(' ')
}

export { OpenAiCompatibleChatProvider, type OpenAiCompatibleChatProviderConfig } from './openai-chat-provider.js'

export class MockLLMProvider implements LLMProvider {
  async generate(request: LLMGenerateRequest): Promise<LLMGenerateResponse> {
    const lastMessage = request.messages[request.messages.length - 1]
    if (lastMessage?.role === 'tool') {
      return {
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: `Tool result received: ${textOf(lastMessage)}` }],
        },
        finishReason: 'stop',
      }
    }

    const text = textOf(lastMessage).toLowerCase()
    const weatherTool = request.tools.find((tool) => tool.name === 'get_weather')
    if (weatherTool && text.includes('weather')) {
      toolCallCounter += 1
      return {
        toolCalls: [
          {
            id: `toolcall-${toolCallCounter}`,
            name: 'get_weather',
            input: { city: text.includes('beijing') ? 'Beijing' : 'Unknown' },
          },
        ],
        finishReason: 'tool_calls',
      }
    }

    return {
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: `Echo: ${textOf(lastMessage)}` }],
      },
      finishReason: 'stop',
    }
  }
}
