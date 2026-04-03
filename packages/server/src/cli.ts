import {
  MockLLMProvider,
  InMemoryToolRuntime,
  createBuiltinToolProvider,
  createSkillToolProvider,
  listSkills,
} from '@openkin/core'
import { createOpenKinHttpServer } from './http-server.js'

const port = Number(process.env.PORT ?? '3333')

/** Scan workspace/skills/ and build the Skill description block for System Prompt */
async function buildSkillSystemPrompt(): Promise<string> {
  const skills = await listSkills()
  if (skills.length === 0) return ''
  const lines = skills.map((s) => `- ${s.skillId}: ${s.description.replace(/\n/g, ' ').trim()}`)
  return [
    '',
    'You have access to the following Skills (call read_skill to get the full usage doc, then run_script to execute):',
    ...lines,
    '',
    'If the Skill you need is not listed above, call list_skills to see the full list.',
  ].join('\n')
}

async function main(): Promise<void> {
  const skillPromptBlock = await buildSkillSystemPrompt()

  const runtime = new InMemoryToolRuntime([
    createBuiltinToolProvider(),
    createSkillToolProvider(),
  ])

  const { server } = createOpenKinHttpServer({
    definition: {
      id: 'server',
      name: 'HTTP Server Agent',
      systemPrompt: `You are a concise assistant. You have access to tools like echo and get_current_time.${skillPromptBlock}`,
      maxSteps: 8,
    },
    llm: new MockLLMProvider(),
    toolRuntime: runtime,
  })

  server.listen(port, () => {
    console.error(`openkin server listening on http://127.0.0.1:${port}`)
  })
}

void main().catch((err: unknown) => {
  console.error('cli startup error:', err)
  process.exit(1)
})
