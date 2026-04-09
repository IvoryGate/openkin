/**
 * 第一层基础设施审计：在真实 ReActRunEngine + OpenKinAgent 路径上验证
 * - 生命周期 hook 是否按预期触发
 * - MemoryPort 是否进入 prompt 快照
 * - TrimCompressionPolicy + maxPromptTokens 是否裁剪可压缩历史
 *
 * 使用 Mock LLM，不访问外网；由 `pnpm test:first-layer-audit` / `pnpm verify` 调用。
 * 位置：`apps/dev-console/tests/`（与 `src/` 下 demo 入口分离）。
 */
import { createRunError, type Message } from '@theworld/shared-contracts'
import {
  InMemoryMemoryPort,
  InMemoryToolRuntime,
  MockLLMProvider,
  OpenKinAgent,
  SimpleContextManager,
  StaticToolProvider,
  TrimCompressionPolicy,
  estimateMessagesTokens,
  type AgentLifecycleHook,
  type LLMGenerateRequest,
  type LLMGenerateResponse,
  type LLMProvider,
  type RunState,
  type ToolExecutor,
} from '@theworld/core'

function textMessage(role: Message['role'], text: string): Message {
  return { role, content: [{ type: 'text', text }] }
}

function flattenTexts(messages: Message[]): string {
  return messages
    .flatMap((m) => m.content)
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('\n')
}

class ScriptedLLM implements LLMProvider {
  private i = 0
  constructor(private readonly script: LLMGenerateResponse[]) {}
  async generate(_request: LLMGenerateRequest): Promise<LLMGenerateResponse> {
    const r = this.script[this.i]
    this.i += 1
    if (!r) {
      throw new Error(`ScriptedLLM: no more responses at index ${this.i - 1}`)
    }
    return r
  }
}

const weatherExec: ToolExecutor = {
  async execute(input) {
    return {
      toolCallId: 'w0',
      name: 'get_weather',
      output: { city: String(input.city ?? 'X'), forecast: 'ok' },
    }
  },
}

const toolRuntime = new InMemoryToolRuntime([
  new StaticToolProvider(
    'audit',
    'builtin',
    [{ name: 'get_weather', description: 'weather' }],
    { get_weather: weatherExec },
  ),
])

function createStubRunState(o: {
  maxPromptTokens?: number
  sessionId?: string
  agentId?: string
} = {}): RunState {
  return {
    traceId: 'audit',
    sessionId: o.sessionId ?? 's',
    agentId: o.agentId ?? 'a',
    stepIndex: 0,
    toolCallCount: 0,
    status: 'running',
    steps: [],
    startedAt: Date.now(),
    maxPromptTokens: o.maxPromptTokens,
  }
}

function assertEqual<T>(name: string, actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

async function auditHookSequenceToolThenText(): Promise<void> {
  const events: string[] = []
  const recording: AgentLifecycleHook = {
    onRunStart() {
      events.push('onRunStart')
    },
    onRunEnd() {
      events.push('onRunEnd')
    },
    onRunError() {
      events.push('onRunError')
    },
    onBeforeLLMCall(ctx, _messages) {
      events.push(`beforeLLM:${ctx.stepIndex}`)
      return undefined
    },
    async onAfterLLMCall(ctx, res) {
      events.push(res.toolCalls?.length ? `afterLLM:${ctx.stepIndex}:tools` : `afterLLM:${ctx.stepIndex}:text`)
      return res
    },
    async onBeforeToolCall(_ctx, call) {
      events.push(`beforeTool:${call.name}`)
      return { action: 'continue' as const }
    },
    async onAfterToolCall(_ctx, tr) {
      events.push(`afterTool:${tr.name}`)
      return tr
    },
  }

  const llm = new ScriptedLLM([
    {
      toolCalls: [{ id: 't1', name: 'get_weather', input: { city: 'Beijing' } }],
      finishReason: 'tool_calls',
    },
    {
      message: { role: 'assistant', content: [{ type: 'text', text: '北京今天不错。' }] },
      finishReason: 'stop',
    },
  ])

  const agent = new OpenKinAgent(
    { id: 'audit-hook', name: 'H', systemPrompt: '测试', maxSteps: 4 },
    llm,
    toolRuntime,
    undefined,
    [recording],
  )

  const result = await agent.run('audit-hooks', '北京天气怎样？')
  if (result.status !== 'completed') {
    throw new Error(`audit hooks: expected completed, got ${result.status}`)
  }

  assertEqual(
    'hook event sequence (tool → text)',
    events,
    [
      'onRunStart',
      'beforeLLM:0',
      'afterLLM:0:tools',
      'beforeTool:get_weather',
      'afterTool:get_weather',
      'beforeLLM:1',
      'afterLLM:1:text',
      'onRunEnd',
    ],
  )
}

async function auditHookSequenceOnLLMFailure(): Promise<void> {
  const events: string[] = []
  const recording: AgentLifecycleHook = {
    onRunStart() {
      events.push('onRunStart')
    },
    onRunEnd() {
      events.push('onRunEnd')
    },
    onRunError() {
      events.push('onRunError')
    },
    onBeforeLLMCall(ctx, _messages) {
      events.push(`beforeLLM:${ctx.stepIndex}`)
      return undefined
    },
  }

  const failLlm: LLMProvider = {
    async generate() {
      throw createRunError('LLM_UNAVAILABLE', 'boom', 'llm')
    },
  }

  const agent = new OpenKinAgent(
    { id: 'audit-fail', name: 'F', systemPrompt: 'x', maxSteps: 2 },
    failLlm,
    toolRuntime,
    undefined,
    [recording],
  )

  const result = await agent.run('audit-fail', 'hi')
  if (result.status !== 'failed') {
    throw new Error(`expected failed, got ${result.status}`)
  }

  assertEqual('hook sequence on LLM throw', events, ['onRunStart', 'beforeLLM:0', 'onRunError', 'onRunEnd'])
}

async function auditMemoryPortInPrompt(): Promise<void> {
  const sessionId = 'audit-mem'
  const agentId = 'audit-agent-mem'
  const memoryPort = new InMemoryMemoryPort()
  await memoryPort.write({
    sessionId,
    agentId,
    messages: [textMessage('system', 'AUDIT_MEMORY_MARKER: 用户喜欢短句。')],
  })

  let sawMarker = false
  const capture: AgentLifecycleHook = {
    async onBeforeLLMCall(_ctx, messages) {
      if (flattenTexts(messages).includes('AUDIT_MEMORY_MARKER')) sawMarker = true
      return undefined
    },
  }

  const agent = new OpenKinAgent(
    { id: agentId, name: 'M', systemPrompt: '你是审计助手。', maxSteps: 2 },
    new MockLLMProvider(),
    toolRuntime,
    undefined,
    [capture],
    { memoryPort, recentWindow: 4, compressionPolicy: new TrimCompressionPolicy() },
  )

  await agent.run(sessionId, '你好')
  if (!sawMarker) {
    throw new Error('MemoryPort: injected summary was not present in onBeforeLLMCall messages')
  }
}

async function auditContextCompression(): Promise<void> {
  const history = [
    textMessage('user', 'OLD_OLD_OLD_OLD_OLD'),
    textMessage('assistant', 'old-a old-a'),
    textMessage('user', 'recent-u recent-u'),
    textMessage('assistant', 'recent-a recent-a'),
  ]
  const cm = new SimpleContextManager(
    { id: 'audit-ctx', name: 'C', systemPrompt: 'SYS' },
    history,
    { recentWindow: 2, compressionPolicy: new TrimCompressionPolicy() },
  )

  const runState = createStubRunState()
  await cm.beginRun({ message: textMessage('user', 'CURRENT_CURRENT') })

  const full = await cm.buildSnapshot(runState)
  const budget = estimateMessagesTokens([full[0], ...full.slice(-2)])
  const trimmed = await cm.buildSnapshot(createStubRunState({ maxPromptTokens: budget }))
  const flat = flattenTexts(trimmed)

  if (!flat.includes('CURRENT_CURRENT')) {
    throw new Error('compression: current user turn missing')
  }
  if (flat.includes('OLD_OLD')) {
    throw new Error('compression: old compressible block should be dropped under budget')
  }
  if (trimmed[0]?.role !== 'system') {
    throw new Error('compression: system block missing')
  }
}

async function auditHookAbortTool(): Promise<void> {
  const llm = new ScriptedLLM([
    {
      toolCalls: [{ id: 'abort-tc', name: 'get_weather', input: { city: 'Beijing' } }],
      finishReason: 'tool_calls',
    },
  ])
  const agent = new OpenKinAgent(
    { id: 'audit-abort', name: 'A', systemPrompt: 'x', maxSteps: 4 },
    llm,
    toolRuntime,
    undefined,
    [
      {
        async onBeforeToolCall() {
          return { action: 'abort', reason: 'audit abort tool' }
        },
      },
    ],
  )
  const result = await agent.run('audit-abort-s', 'weather')
  assertEqual('abort status', result.status, 'aborted')
  assertEqual('abort code', result.error?.code, 'RUN_ABORTED')
}

async function auditAbortSignal(): Promise<void> {
  const controller = new AbortController()
  controller.abort()
  const agent = new OpenKinAgent(
    { id: 'audit-cancel', name: 'C', systemPrompt: 'x', maxSteps: 2 },
    new MockLLMProvider(),
    toolRuntime,
  )
  const result = await agent.run('audit-cancel-s', 'hi', { abortSignal: controller.signal })
  assertEqual('cancel status', result.status, 'cancelled')
  assertEqual('cancel code', result.error?.code, 'RUN_CANCELLED')
}

async function main(): Promise<void> {
  const suites: Array<{ name: string; fn: () => Promise<void> }> = [
    { name: 'hook_sequence_tool_then_text', fn: auditHookSequenceToolThenText },
    { name: 'hook_sequence_llm_failure', fn: auditHookSequenceOnLLMFailure },
    { name: 'hook_abort_tool', fn: auditHookAbortTool },
    { name: 'abort_signal', fn: auditAbortSignal },
    { name: 'memory_port_in_prompt', fn: auditMemoryPortInPrompt },
    { name: 'context_compression_trim', fn: auditContextCompression },
  ]

  console.error('first-layer-audit: running', suites.length, 'checks…')
  for (const { name, fn } of suites) {
    await fn()
    console.error('  ✓', name)
  }
  console.error('first-layer-audit: all checks passed.')
}

main().catch((e) => {
  console.error('first-layer-audit: FAILED', e)
  process.exit(1)
})
