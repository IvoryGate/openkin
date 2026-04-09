/**
 * Test-only server entry for 015 smoke test (test:skills).
 * Uses a MockLLMProvider that calls read_skill then run_script for the weather skill.
 */
import {
  InMemoryToolRuntime,
  createBuiltinToolProvider,
  createSkillToolProvider,
  listSkills,
  type LLMProvider,
  type LLMGenerateRequest,
  type LLMGenerateResponse,
} from '@theworld/core'
import { createTheWorldHttpServer } from './http-server.js'

let step = 0

/**
 * Deterministic mock that drives the Skill call path:
 * Step 0: call read_skill { skillId: 'weather' }
 * Step 1: call run_script { skillId: 'weather', script: 'weather.ts', args: { city: 'Beijing' } }
 * Step 2: return final answer
 */
class SkillTestMockLLM implements LLMProvider {
  async generate(request: LLMGenerateRequest): Promise<LLMGenerateResponse> {
    const lastMsg = request.messages[request.messages.length - 1]
    const role = lastMsg?.role

    // After tool result
    if (role === 'tool') {
      step += 1
      if (step === 1) {
        // After read_skill → now call run_script
        const runScriptTool = request.tools.find((t) => t.name === 'run_script')
        if (runScriptTool) {
          return {
            toolCalls: [
              {
                id: `tc-run-${Date.now()}`,
                name: 'run_script',
                input: { skillId: 'weather', script: 'weather.ts', args: { city: 'Beijing' } },
              },
            ],
            finishReason: 'tool_calls',
          }
        }
      }
      // After run_script → return final answer
      return {
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'The weather in Beijing is clear, 25°C.' }],
        },
        finishReason: 'stop',
      }
    }

    // First call → call read_skill
    const readSkillTool = request.tools.find((t) => t.name === 'read_skill')
    if (readSkillTool) {
      step = 0
      return {
        toolCalls: [
          {
            id: `tc-read-${Date.now()}`,
            name: 'read_skill',
            input: { skillId: 'weather' },
          },
        ],
        finishReason: 'tool_calls',
      }
    }

    return {
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'No skills available.' }],
      },
      finishReason: 'stop',
    }
  }
}

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? '3336')

  const skills = await listSkills()
  const skillLines = skills.map((s) => `- ${s.skillId}: ${s.description.replace(/\n/g, ' ').trim()}`)
  const skillBlock = skillLines.length > 0
    ? '\nSkills:\n' + skillLines.join('\n')
    : ''

  const runtime = new InMemoryToolRuntime([
    createBuiltinToolProvider(),
    createSkillToolProvider(),
  ])

  const { server } = createTheWorldHttpServer({
    definition: {
      id: 'skills-test-server',
      name: 'Skills Test Server',
      systemPrompt: `You are a test assistant.${skillBlock}`,
      maxSteps: 8,
    },
    llm: new SkillTestMockLLM(),
    toolRuntime: runtime,
  })

  server.listen(port, () => {
    console.error(`openkin server listening on http://127.0.0.1:${port}`)
  })
}

void main().catch((err: unknown) => {
  console.error('cli-skills-test startup error:', err)
  process.exit(1)
})
