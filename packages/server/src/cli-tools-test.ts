/**
 * Test-only server entry for 013 smoke test (test:tools).
 * Uses a MockLLMProvider that calls 'echo' tool when prompt contains 'echo:'.
 * Launch via: tsx packages/server/src/cli-tools-test.ts
 */
import {
  InMemoryToolRuntime,
  createBuiltinToolProvider,
  type LLMProvider,
  type LLMGenerateRequest,
  type LLMGenerateResponse,
} from '@openkin/core'
import { createOpenKinHttpServer } from './http-server.js'

let callCounter = 0

class EchoTriggerMockLLM implements LLMProvider {
  async generate(request: LLMGenerateRequest): Promise<LLMGenerateResponse> {
    const lastMsg = request.messages[request.messages.length - 1]

    // After tool result → return final text
    if (lastMsg?.role === 'tool') {
      return {
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Tool result received. Done.' }],
        },
        finishReason: 'stop',
      }
    }

    const text = lastMsg?.content
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join(' ')
      .toLowerCase() ?? ''

    const echoTool = request.tools.find((t) => t.name === 'echo')
    if (echoTool && text.includes('echo:')) {
      callCounter += 1
      const match = text.match(/echo:\s*(.+)/)
      const echoText = match ? match[1].trim() : 'hello'
      return {
        toolCalls: [{ id: `tc-${callCounter}`, name: 'echo', input: { text: echoText } }],
        finishReason: 'tool_calls',
      }
    }

    return {
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: `Assistant: ${text}` }],
      },
      finishReason: 'stop',
    }
  }
}

const port = Number(process.env.PORT ?? '3334')
const runtime = new InMemoryToolRuntime([createBuiltinToolProvider()])

const { server } = createOpenKinHttpServer({
  definition: {
    id: 'tools-test-server',
    name: 'Tools Test Server',
    systemPrompt: 'You are a test assistant with echo and get_current_time tools.',
    maxSteps: 6,
  },
  llm: new EchoTriggerMockLLM(),
  toolRuntime: runtime,
})

server.listen(port, () => {
  console.error(`openkin server listening on http://127.0.0.1:${port}`)
})
