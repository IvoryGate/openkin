/**
 * Test-only server entry for 013 smoke test (test:tools).
 * Uses a MockLLMProvider that calls 'get_current_time' when prompt contains 'time'.
 * Launch via: tsx packages/server/src/cli-tools-test.ts
 *
 * Note: 'echo' was removed from createBuiltinToolProvider() in a later update.
 * This mock is now aligned with the actual builtin tool set.
 */
import {
  InMemoryToolRuntime,
  createBuiltinToolProvider,
  type LLMProvider,
  type LLMGenerateRequest,
  type LLMGenerateResponse,
} from '@theworld/core'
import { createOpenKinHttpServer } from './http-server.js'

let callCounter = 0

class GetCurrentTimeMockLLM implements LLMProvider {
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

    const timeTool = request.tools.find((t) => t.name === 'get_current_time')
    if (timeTool && text.includes('time')) {
      callCounter += 1
      return {
        toolCalls: [{ id: `tc-${callCounter}`, name: 'get_current_time', input: {} }],
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
  llm: new GetCurrentTimeMockLLM(),
  toolRuntime: runtime,
})

server.listen(port, () => {
  console.error(`openkin server listening on http://127.0.0.1:${port}`)
})
