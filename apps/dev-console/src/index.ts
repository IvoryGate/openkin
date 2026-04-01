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

const toolRuntime = new InMemoryToolRuntime([
  new StaticToolProvider(
    'builtin-weather',
    'builtin',
    [{ name: 'get_weather', description: 'Get a mock weather report' }],
    { get_weather: weatherExecutor },
  ),
])

const loggingHook: AgentLifecycleHook = {
  onRunStart(ctx) {
    console.log(`[hook] run started: ${ctx.traceId}`)
  },
  onRunEnd(ctx, result) {
    console.log(`[hook] run ended: ${ctx.traceId} -> ${result.status}`)
  },
}

const agent = new OpenKinAgent(
  {
    id: 'assistant',
    name: 'OpenKin Assistant',
    systemPrompt: 'You are a helpful assistant that can use tools when needed.',
    maxSteps: 4,
  },
  new MockLLMProvider(),
  toolRuntime,
  undefined,
  [loggingHook],
)

const result = await agent.run('demo-session', 'What is the weather in Beijing today?')
console.log(JSON.stringify(result, null, 2))
