/**
 * Test-only server entry for 014 smoke test (test:mcp).
 * Starts with builtin provider + MCP provider (server-everything via stdio).
 * Uses a MockLLMProvider that calls an MCP tool when the prompt mentions "mcp echo".
 */
import {
  InMemoryToolRuntime,
  createBuiltinToolProvider,
  McpToolProvider,
  type LLMProvider,
  type LLMGenerateRequest,
  type LLMGenerateResponse,
} from '@theworld/core'
import { createTheWorldHttpServer } from './http-server.js'

let callCounter = 0

/**
 * Mock LLM that triggers `echo` from the MCP server-everything when prompt contains "mcp echo".
 * The tool is named 'echo' in @modelcontextprotocol/server-everything.
 */
class McpTestMockLLM implements LLMProvider {
  async generate(request: LLMGenerateRequest): Promise<LLMGenerateResponse> {
    const lastMsg = request.messages[request.messages.length - 1]

    // After tool result → return final text
    if (lastMsg?.role === 'tool') {
      return {
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'MCP tool result received. Done.' }],
        },
        finishReason: 'stop',
      }
    }

    const text = lastMsg?.content
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join(' ')
      .toLowerCase() ?? ''

    // Try to call the 'echo' tool from MCP server-everything
    const echoTool = request.tools.find((t) => t.name === 'echo')
    if (echoTool && text.includes('mcp echo')) {
      callCounter += 1
      return {
        toolCalls: [{ id: `mcp-tc-${callCounter}`, name: 'echo', input: { message: 'hello from theworld' } }],
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

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? '3335')

  const builtinProvider = createBuiltinToolProvider()
  const mcpProvider = new McpToolProvider({
    id: 'everything',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-everything'],
  })

  // Connect MCP provider before starting server
  await mcpProvider.connect()

  const runtime = new InMemoryToolRuntime([builtinProvider, mcpProvider])

  const { server } = createTheWorldHttpServer({
    definition: {
      id: 'mcp-test-server',
      name: 'MCP Test Server',
      systemPrompt: 'You are a test assistant with access to MCP tools.',
      maxSteps: 6,
    },
    llm: new McpTestMockLLM(),
    toolRuntime: runtime,
  })

  // Cleanup on exit
  const shutdown = async (): Promise<void> => {
    await mcpProvider.disconnect()
    server.close()
    process.exit(0)
  }
  process.on('SIGTERM', () => { void shutdown() })
  process.on('SIGINT', () => { void shutdown() })

  server.listen(port, () => {
    console.error(`theworld server listening on http://127.0.0.1:${port}`)
  })
}

void main().catch((err: unknown) => {
  console.error('cli-mcp-test startup error:', err)
  process.exit(1)
})
