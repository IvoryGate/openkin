/**
 * Test-only server for 016 self-management smoke test (test:self-management).
 *
 * Uses a deterministic MockLLM that drives three scenarios depending on prompt:
 *   A) "write a skill" → calls write_skill
 *   B) "add a mcp server" → calls run_script(manage-mcp, add-mcp.ts, ...)
 *   C) "read logs" → calls read_logs
 */
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtemp } from 'node:fs/promises'
import {
  InMemoryToolRuntime,
  createBuiltinToolProvider,
  createSkillToolProvider,
  createSelfManagementToolProvider,
  type LLMProvider,
  type LLMGenerateRequest,
  type LLMGenerateResponse,
} from '@openkin/core'
import { createOpenKinHttpServer } from './http-server.js'

/** Scenario driven by the last user message text */
function detectScenario(messages: LLMGenerateRequest['messages']): 'write_skill' | 'read_logs' | 'unknown' {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== 'user') continue
    const text = msg.content.map((p) => (p.type === 'text' ? p.text : '')).join(' ').toLowerCase()
    if (text.includes('write') && text.includes('skill')) return 'write_skill'
    if (text.includes('read') && text.includes('log')) return 'read_logs'
  }
  return 'unknown'
}

class SelfManagementTestMockLLM implements LLMProvider {
  private scenario: 'write_skill' | 'read_logs' | 'unknown' = 'unknown'
  private stepInScenario = 0

  async generate(request: LLMGenerateRequest): Promise<LLMGenerateResponse> {
    const lastMsg = request.messages[request.messages.length - 1]

    // If we just received a tool result, advance through the scenario
    if (lastMsg?.role === 'tool') {
      this.stepInScenario += 1
      // After any tool call, return a text answer
      return {
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Done.' }],
        },
        finishReason: 'stop',
      }
    }

    // First call in this run – detect scenario from conversation
    this.scenario = detectScenario(request.messages)
    this.stepInScenario = 0

    if (this.scenario === 'write_skill') {
      const writeSkillTool = request.tools.find((t) => t.name === 'write_skill')
      if (writeSkillTool) {
        return {
          toolCalls: [
            {
              id: `tc-write-${Date.now()}`,
              name: 'write_skill',
              input: {
                skillId: 'test-auto-skill',
                skillMd: `---\nskill-id: test-auto-skill\ndescription: Auto-created skill for testing\n---\n\n# Test Auto Skill\n\nCreated by write_skill during smoke test.\n`,
                scripts: [
                  {
                    filename: 'run.ts',
                    content: `console.log(JSON.stringify({ ok: true }))\n`,
                  },
                ],
              },
            },
          ],
          finishReason: 'tool_calls',
        }
      }
    }

    if (this.scenario === 'read_logs') {
      const readLogsTool = request.tools.find((t) => t.name === 'read_logs')
      if (readLogsTool) {
        return {
          toolCalls: [
            {
              id: `tc-logs-${Date.now()}`,
              name: 'read_logs',
              input: { limit: 10 },
            },
          ],
          finishReason: 'tool_calls',
        }
      }
    }

    return {
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'No matching tool found for the scenario.' }],
      },
      finishReason: 'stop',
    }
  }
}

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? '3337')

  // Use a temp workspace so tests do not pollute the real workspace
  const tmpWorkspace = await mkdtemp(join(tmpdir(), 'openkin-sm-test-'))
  process.env.OPENKIN_WORKSPACE_DIR = tmpWorkspace

  const runtime = new InMemoryToolRuntime([
    createBuiltinToolProvider(),
    createSkillToolProvider(),
    createSelfManagementToolProvider(),
  ])

  const { server } = createOpenKinHttpServer({
    definition: {
      id: 'self-management-test-server',
      name: 'Self-Management Test Server',
      systemPrompt: 'You are a test assistant for self-management capabilities.',
      maxSteps: 4,
    },
    llm: new SelfManagementTestMockLLM(),
    toolRuntime: runtime,
  })

  server.listen(port, () => {
    console.error(`openkin server listening on http://127.0.0.1:${port}`)
  })
}

void main().catch((err: unknown) => {
  console.error('cli-self-management-test startup error:', err)
  process.exit(1)
})
