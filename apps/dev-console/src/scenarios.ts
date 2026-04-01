import { createRunError } from '@openkin/shared-contracts'
import { MockLLMProvider, OpenKinAgent, InMemoryToolRuntime, StaticToolProvider, type AgentLifecycleHook, type ToolExecutor } from '@openkin/core'

const weatherExecutor: ToolExecutor = {
  async execute(input, context) {
    return {
      toolCallId: `weather-${context.stepIndex}`,
      name: 'get_weather',
      output: {
        city: input.city ?? 'Unknown',
        forecast: 'Sunny, 25C',
      },
    }
  },
}

const slowExecutor: ToolExecutor = {
  async execute(_input, context) {
    await new Promise((resolve) => setTimeout(resolve, 30))
    return {
      toolCallId: `slow-${context.stepIndex}`,
      name: 'slow_tool',
      output: { ok: true },
    }
  },
}

async function runScenario(name: string, task: () => Promise<unknown>): Promise<void> {
  const result = await task()
  console.log(`
=== ${name} ===`)
  console.log(JSON.stringify(result, null, 2))
}

const baseRuntime = new InMemoryToolRuntime([
  new StaticToolProvider(
    'builtin-runtime',
    'builtin',
    [
      { name: 'get_weather', description: 'Get a mock weather report' },
      { name: 'slow_tool', description: 'Deliberately slow tool' },
    ],
    {
      get_weather: weatherExecutor,
      slow_tool: slowExecutor,
    },
  ),
])

const agent = new OpenKinAgent(
  {
    id: 'assistant',
    name: 'OpenKin Assistant',
    systemPrompt: 'You are a helpful assistant that can use tools when needed.',
    maxSteps: 4,
  },
  new MockLLMProvider(),
  baseRuntime,
)

await runScenario('completed', async () => agent.run('scenario-completed', 'What is the weather in Beijing today?'))

await runScenario('cancelled', async () => {
  const controller = new AbortController()
  controller.abort()
  return agent.run('scenario-cancelled', 'hello there', { abortSignal: controller.signal })
})

await runScenario('budget_exhausted', async () =>
  agent.run('scenario-budget', 'What is the weather in Beijing today?', { maxSteps: 1 }),
)

const slowToolOnlyAgent = new OpenKinAgent(
  {
    id: 'assistant-slow',
    name: 'Slow Assistant',
    systemPrompt: 'Use the slow tool when the user asks for weather.',
    maxSteps: 4,
  },
  {
    async generate(request) {
      const lastMessage = request.messages[request.messages.length - 1]
      if (lastMessage?.role === 'tool') {
        return {
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Done after slow tool.' }],
          },
          finishReason: 'stop',
        }
      }
      return {
        toolCalls: [
          {
            id: 'slow-tool-call',
            name: 'slow_tool',
            input: {},
          },
        ],
        finishReason: 'tool_calls',
      }
    },
  },
  baseRuntime,
)

await runScenario('failed_timeout', async () =>
  slowToolOnlyAgent.run('scenario-timeout', 'please do the slow thing', { timeoutMs: 5 }),
)

const abortingHook: AgentLifecycleHook = {
  async onBeforeToolCall(_ctx, call) {
    if (call.name === 'get_weather') {
      return { action: 'abort', reason: 'Weather tool disabled by guard' }
    }
    return { action: 'continue' }
  },
}

const abortedAgent = new OpenKinAgent(
  {
    id: 'assistant-aborted',
    name: 'Aborted Assistant',
    systemPrompt: 'You are guarded.',
    maxSteps: 4,
  },
  new MockLLMProvider(),
  baseRuntime,
  undefined,
  [abortingHook],
)

await runScenario('aborted_by_hook_guard', async () =>
  abortedAgent.run('scenario-aborted', 'What is the weather in Beijing today?'),
)

const missingToolAgent = new OpenKinAgent(
  {
    id: 'assistant-missing-tool',
    name: 'Missing Tool Assistant',
    systemPrompt: 'Try to use a tool that does not exist.',
    maxSteps: 2,
  },
  {
    async generate(request) {
      const lastMessage = request.messages[request.messages.length - 1]
      if (lastMessage?.role === 'tool') {
        return {
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Observed missing tool result.' }],
          },
          finishReason: 'stop',
        }
      }
      return {
        toolCalls: [
          {
            id: 'missing-tool-call',
            name: 'missing_tool',
            input: {},
          },
        ],
        finishReason: 'tool_calls',
      }
    },
  },
  baseRuntime,
)

await runScenario('tool_not_found_result', async () => {
  const result = await missingToolAgent.run('scenario-missing-tool', 'use a missing tool')
  if (result.status !== 'completed') {
    return result
  }
  return {
    ...result,
    note: createRunError('TOOL_NOT_FOUND', 'Missing tool path should still be observable in tool results', 'tool'),
  }
})
