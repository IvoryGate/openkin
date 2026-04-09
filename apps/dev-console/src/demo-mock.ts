/**
 * Mock-only first-layer demo (deterministic). Does not call external LLM APIs.
 * @see docs/first-layer/DEMO_FIRST_LAYER.md
 */
import { MockLLMProvider, OpenKinAgent } from '@theworld/core'
import {
  createDemoToolRuntime,
  demoAgentDefinition,
  demoLoggingHooks,
  demoUserPrompt,
} from './demo-shared.js'

const agent = new OpenKinAgent(
  demoAgentDefinition,
  new MockLLMProvider(),
  createDemoToolRuntime(),
  undefined,
  demoLoggingHooks,
)

const result = await agent.run('demo-session-mock', demoUserPrompt)
console.log(JSON.stringify(result, null, 2))
