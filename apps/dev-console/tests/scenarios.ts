import { createRunError, type Message } from '@openkin/shared-contracts'
import {
  InMemoryMemoryPort,
  MockLLMProvider,
  OpenKinAgent,
  InMemoryToolRuntime,
  StaticToolProvider,
  SimpleContextManager,
  TrimCompressionPolicy,
  estimateMessagesTokens,
  type AgentLifecycleHook,
  type LLMGenerateRequest,
  type RunState,
  type ToolExecutor,
} from '@openkin/core'

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

function createStubRunState(options: {
  maxPromptTokens?: number
  sessionId?: string
  agentId?: string
} = {}): RunState {
  return {
    traceId: 'trace-context-test',
    sessionId: options.sessionId ?? 'session-context-test',
    agentId: options.agentId ?? 'assistant-context-test',
    stepIndex: 0,
    toolCallCount: 0,
    status: 'running',
    steps: [],
    startedAt: Date.now(),
    maxPromptTokens: options.maxPromptTokens,
  }
}

function textMessage(role: Message['role'], text: string): Message {
  return {
    role,
    content: [{ type: 'text', text }],
  }
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

const rateLimitLlmAgent = new OpenKinAgent(
  {
    id: 'assistant-llm-rl',
    name: 'Rate limit LLM',
    systemPrompt: 'You are a test assistant.',
    maxSteps: 2,
  },
  {
    async generate(_request: LLMGenerateRequest) {
      throw createRunError('LLM_RATE_LIMIT', 'Too many requests', 'llm', {}, true)
    },
  },
  baseRuntime,
)

await runScenario('llm_rate_limit_surfaces_as_failed', async () => {
  const result = await rateLimitLlmAgent.run('scenario-llm-rl', 'hi')
  if (result.status !== 'failed') {
    throw new Error(`expected failed, got ${result.status}`)
  }
  if (result.error?.code !== 'LLM_RATE_LIMIT') {
    throw new Error(`expected LLM_RATE_LIMIT, got ${String(result.error?.code)}`)
  }
  if (result.error?.source !== 'llm') {
    throw new Error(`expected source llm, got ${String(result.error?.source)}`)
  }
  return result
})

const alwaysWeatherToolLlm = {
  async generate(request: LLMGenerateRequest) {
    const lastMessage = request.messages[request.messages.length - 1]
    if (lastMessage?.role === 'tool') {
      return {
        toolCalls: [
          {
            id: 'weather-followup',
            name: 'get_weather',
            input: { city: 'Beijing' },
          },
        ],
        finishReason: 'tool_calls',
      }
    }
    return {
      toolCalls: [
        {
          id: 'weather-first',
          name: 'get_weather',
          input: { city: 'Beijing' },
        },
      ],
      finishReason: 'tool_calls',
    }
  },
}

const maxToolCallsAgent = new OpenKinAgent(
  {
    id: 'assistant-max-tool',
    name: 'Max tool calls',
    systemPrompt: 'Use weather when asked.',
    maxSteps: 6,
  },
  alwaysWeatherToolLlm,
  baseRuntime,
)

await runScenario('max_tool_calls_budget_exceeded', async () => {
  const result = await maxToolCallsAgent.run('scenario-max-tool-calls', 'weather please', {
    maxToolCalls: 1,
  })
  if (result.status !== 'budget_exhausted') {
    throw new Error(`expected budget_exhausted, got ${result.status}`)
  }
  if (result.error?.code !== 'RUN_MAX_TOOL_CALLS_EXCEEDED') {
    throw new Error(`expected RUN_MAX_TOOL_CALLS_EXCEEDED, got ${String(result.error?.code)}`)
  }
  if (result.finishReason !== 'max_tool_calls_exceeded') {
    throw new Error(`expected max_tool_calls_exceeded finish, got ${String(result.finishReason)}`)
  }
  return result
})

await runScenario('context_budget_trim_preserves_system_and_recent', async () => {
  const history = [
    textMessage('user', 'old-user old-user old-user old-user old-user old-user'),
    textMessage('assistant', 'old-assistant old-assistant old-assistant old-assistant'),
    textMessage('user', 'recent-user recent-user recent-user'),
    textMessage('assistant', 'recent-assistant recent-assistant recent-assistant'),
  ]
  const contextManager = new SimpleContextManager(
    {
      id: 'assistant-context-budget',
      name: 'Context Budget Assistant',
      systemPrompt: 'System prompt must stay in context.',
    },
    history,
    {
      recentWindow: 3,
      compressionPolicy: new TrimCompressionPolicy(),
    },
  )

  const currentInput = textMessage('user', 'current-request current-request current-request')
  await contextManager.beginRun({ message: currentInput })

  const fullSnapshot = await contextManager.buildSnapshot(createStubRunState())
  const minimumNeeded = estimateMessagesTokens([fullSnapshot[0], ...fullSnapshot.slice(-3)])
  const trimmedSnapshot = await contextManager.buildSnapshot(createStubRunState({ maxPromptTokens: minimumNeeded }))

  const flattenedTexts = trimmedSnapshot
    .flatMap((message) => message.content)
    .filter((part) => part.type === 'text')
    .map((part) => part.text)

  if (trimmedSnapshot[0]?.role !== 'system') {
    throw new Error('System prompt was not preserved during trimming.')
  }
  if (!flattenedTexts.some((text) => text.includes('current-request'))) {
    throw new Error('Current request should remain in trimmed snapshot.')
  }
  if (flattenedTexts.some((text) => text.includes('old-user'))) {
    throw new Error('Old compressible history should have been trimmed.')
  }

  return {
    fullMessageCount: fullSnapshot.length,
    trimmedMessageCount: trimmedSnapshot.length,
    minimumNeeded,
    trimmedSnapshot,
  }
})

await runScenario('memory_port_injects_summary_before_compression', async () => {
  const sessionId = 'session-memory-test'
  const agentId = 'assistant-memory-test'
  const memoryPort = new InMemoryMemoryPort()
  await memoryPort.write({
    sessionId,
    agentId,
    messages: [textMessage('system', 'Memory summary: User prefers concise replies and likes blue themes.')],
  })

  const history = [
    textMessage('user', 'old-user old-user old-user old-user old-user old-user'),
    textMessage('assistant', 'old-assistant old-assistant old-assistant old-assistant'),
    textMessage('user', 'recent-user recent-user recent-user'),
  ]
  const contextManager = new SimpleContextManager(
    {
      id: agentId,
      name: 'Memory Boundary Assistant',
      systemPrompt: 'System prompt must stay in context.',
    },
    history,
    {
      recentWindow: 2,
      compressionPolicy: new TrimCompressionPolicy(),
      memoryPort,
    },
  )

  await contextManager.beginRun({ message: textMessage('user', 'current-request current-request current-request') })

  const fullSnapshot = await contextManager.buildSnapshot(createStubRunState({ sessionId, agentId }))
  const minimumNeeded = estimateMessagesTokens([fullSnapshot[0], fullSnapshot[1], ...fullSnapshot.slice(-2)])
  const trimmedSnapshot = await contextManager.buildSnapshot(
    createStubRunState({ sessionId, agentId, maxPromptTokens: minimumNeeded }),
  )

  const flattenedTexts = trimmedSnapshot
    .flatMap((message) => message.content)
    .filter((part) => part.type === 'text')
    .map((part) => part.text)

  if (!flattenedTexts.some((text) => text.includes('Memory summary: User prefers concise replies'))) {
    throw new Error('Memory summary should be injected into prompt construction.')
  }
  if (flattenedTexts.some((text) => text.includes('old-user'))) {
    throw new Error('Old history should still be trimmed before keeping injected memory.')
  }

  return {
    fullMessageCount: fullSnapshot.length,
    trimmedMessageCount: trimmedSnapshot.length,
    minimumNeeded,
    trimmedSnapshot,
  }
})
