import {
  MockLLMProvider,
  InMemoryToolRuntime,
  createBuiltinToolProvider,
  McpToolProvider,
  SkillToolProvider,
  demoWeatherSkill,
} from '@openkin/core'
import { createOpenKinHttpServer } from './http-server.js'

const port = Number(process.env.PORT ?? '3333')

// --- Builtin tools provider ---
const builtinProvider = createBuiltinToolProvider()

// --- Skill tools provider ---
const skillProvider = new SkillToolProvider([demoWeatherSkill])

// --- MCP tools provider (stdio, @modelcontextprotocol/server-everything) ---
const mcpProvider = new McpToolProvider({
  id: 'mcp-everything',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-everything'],
})

// Connect MCP provider before starting the server
try {
  await mcpProvider.connect()
} catch (err) {
  console.error('[cli] MCP provider connect failed (continuing without MCP tools):', err)
}

const runtime = new InMemoryToolRuntime([builtinProvider, skillProvider, mcpProvider])

const { server } = createOpenKinHttpServer({
  definition: {
    id: 'server',
    name: 'HTTP Server Agent',
    systemPrompt: 'You are a concise assistant.',
    maxSteps: 6,
  },
  llm: new MockLLMProvider(),
  toolRuntime: runtime,
})

// Graceful shutdown: disconnect MCP provider on SIGINT / SIGTERM
async function shutdown(signal: string) {
  console.error(`[cli] received ${signal}, disconnecting MCP provider…`)
  try {
    await mcpProvider.disconnect()
  } catch {
    // ignore
  }
  process.exit(0)
}

process.on('SIGINT', () => { void shutdown('SIGINT') })
process.on('SIGTERM', () => { void shutdown('SIGTERM') })

server.listen(port, () => {
  console.error(`openkin server listening on http://127.0.0.1:${port}`)
})
