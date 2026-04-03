/**
 * 第一层真实 API 端到端审计（非 Mock）：
 * 使用 OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL，走 OpenAiCompatibleChatProvider + 真实 HTTP。
 *
 * - 不并入 `pnpm verify`（需外网与供应商配额）
 * - 运行：pnpm test:first-layer-real-audit（源码在 `apps/dev-console/tests/`）
 * - 密钥只来自环境或仓库根 `.env`（勿提交 .env）
 */
import { config as loadEnv } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Message } from '@openkin/shared-contracts'
import {
  InMemoryMemoryPort,
  OpenAiCompatibleChatProvider,
  OpenKinAgent,
  TrimCompressionPolicy,
  estimateMessagesTokens,
  type AgentLifecycleHook,
  type AgentResult,
} from '@openkin/core'
import { createDemoToolRuntime } from '../src/demo-shared.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '../../../.env'), quiet: true })
loadEnv({ path: resolve(__dirname, '../../.env'), override: true, quiet: true })

function requireEnv(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) {
    console.error('')
    console.error(`  [real-audit] 缺少环境变量: ${name}`)
    console.error('  请在仓库根目录配置 .env（参考 .env.example），或 export 上述变量。')
    console.error('')
    process.exit(1)
  }
  return v
}

function flattenMessages(messages: Message[]): string {
  return messages
    .flatMap((m) => m.content)
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('\n')
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function createRecordingHook(events: string[]): AgentLifecycleHook {
  return {
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
}

function assertCompleted(name: string, result: AgentResult): void {
  assert(result.status === 'completed', `${name}: expected status completed, got ${result.status}`)
}

function createLlm(apiKey: string, baseUrl: string, model: string): OpenAiCompatibleChatProvider {
  return new OpenAiCompatibleChatProvider({
    apiKey,
    baseUrl,
    model,
    timeoutMs: 180_000,
  })
}

async function testRealToolAndHooks(llm: OpenAiCompatibleChatProvider): Promise<void> {
  const events: string[] = []
  const agent = new OpenKinAgent(
    {
      id: 'real-audit-base',
      name: '真实审计',
      systemPrompt:
        '你是 OpenKin 运行时审计助手。在需要查气温时必须调用 get_weather（参数 city），不得编造工具未给出的数值。',
      maxSteps: 8,
    },
    llm,
    createDemoToolRuntime(),
    undefined,
    [createRecordingHook(events)],
  )
  const result = await agent.run(
    'real-audit-tool',
    '请必须先调用 get_weather 工具查询北京（city=北京或 Beijing）的天气，再根据工具返回用中文一句话说明气温；不要编造未出现在工具结果里的数字。',
  )
  assertCompleted('tool+hooks', result)
  const usedTool = result.steps.some((s) => s.toolCalls && s.toolCalls.length > 0)
  assert(usedTool, 'tool+hooks: 模型未调用 get_weather；请换更强模型或检查工具是否下发到 API')
  assert(events.includes('onRunStart') && events.includes('onRunEnd'), 'tool+hooks: 缺少 onRunStart/onRunEnd')
  assert(events.some((e) => e.startsWith('beforeLLM:')), 'tool+hooks: 未触发 beforeLLMCall')
  assert(events.some((e) => e.startsWith('afterLLM:')), 'tool+hooks: 未触发 afterLLMCall')
  assert(events.includes('beforeTool:get_weather'), 'tool+hooks: 未触发 beforeToolCall(get_weather)')
  assert(events.includes('afterTool:get_weather'), 'tool+hooks: 未触发 afterToolCall(get_weather)')
}

async function testRealMemoryInPrompt(llm: OpenAiCompatibleChatProvider): Promise<void> {
  const marker = 'REAL_AUDIT_MEM: 用户偏好蓝色主题。'
  const sessionId = 'real-audit-mem'
  const agentId = 'real-audit-agent'
  const memoryPort = new InMemoryMemoryPort()
  await memoryPort.write({
    sessionId,
    agentId,
    messages: [{ role: 'system', content: [{ type: 'text', text: marker }] }],
  })
  let captured = ''
  const agent = new OpenKinAgent(
    {
      id: agentId,
      name: '审计',
      systemPrompt: '你是助手，用中文简短回复。',
      maxSteps: 4,
    },
    llm,
    createDemoToolRuntime(),
    undefined,
    [
      {
        onBeforeLLMCall(_ctx, messages) {
          captured = flattenMessages(messages)
          return undefined
        },
      },
    ],
    { memoryPort, recentWindow: 6, compressionPolicy: new TrimCompressionPolicy() },
  )
  const result = await agent.run(sessionId, '用一句话复述「记忆中」关于颜色或主题的偏好。')
  assertCompleted('memory', result)
  assert(
    captured.includes('REAL_AUDIT_MEM') || captured.includes('蓝色'),
    'memory: prompt 快照中未观察到 MemoryPort 注入（应含 REAL_AUDIT_MEM 或「蓝色」）',
  )
}

async function testRealMultiTurnHistory(llm: OpenAiCompatibleChatProvider): Promise<void> {
  const sizes: number[] = []
  const agent = new OpenKinAgent(
    {
      id: 'real-audit-base',
      name: '真实审计',
      systemPrompt: '按用户要求简短中文回答。',
      maxSteps: 4,
    },
    llm,
    createDemoToolRuntime(),
    undefined,
    [
      {
        onBeforeLLMCall(_ctx, messages) {
          sizes.push(estimateMessagesTokens(messages))
          return undefined
        },
      },
    ],
  )
  await agent.run('real-audit-mt', '第一句：只回答「收到-A」。')
  await agent.run('real-audit-mt', '第二句：我上一句让你答什么？只回答一个词。')
  assert(sizes.length === 2, `multi-turn: 期望两轮 beforeLLM，实际 ${sizes.length}`)
  assert(sizes[1]! > sizes[0]!, 'multi-turn: 第二轮上下文 token 应大于第一轮（含历史）')
}

async function testRealCompressionBudget(llm: OpenAiCompatibleChatProvider): Promise<void> {
  const sizes: number[] = []
  const agent = new OpenKinAgent(
    {
      id: 'real-audit-base',
      name: '真实审计',
      systemPrompt: '按用户要求极简中文回答。',
      maxSteps: 8,
    },
    llm,
    createDemoToolRuntime(),
    undefined,
    [
      {
        onBeforeLLMCall(_ctx, messages) {
          sizes.push(estimateMessagesTokens(messages))
          return undefined
        },
      },
    ],
    { recentWindow: 8, compressionPolicy: new TrimCompressionPolicy() },
  )
  const pad = '长文填充'.repeat(120)
  await agent.run('real-audit-cmp', `${pad}\n请只回复：好。`)
  await agent.run('real-audit-cmp', `${pad}\n请只回复：嗯。`)
  await agent.run('real-audit-cmp', '用三个字总结对话。', { maxPromptTokens: 8000 })
  const looseTokens = sizes[sizes.length - 1]!
  await agent.run('real-audit-cmp', '再说一遍刚才三个字。', { maxPromptTokens: 120 })
  const tightTokens = sizes[sizes.length - 1]!
  assert(looseTokens > 80, 'compression: 宽松预算下快照应有一定规模')
  // 低预算会触发 TrimCompressionPolicy；最后一轮仍可能因新用户句略增 token，故只断言明显上限而非与上一轮严格比大小。
  assert(
    tightTokens <= 420,
    `compression: maxPromptTokens=120 时期望 fitted 快照 token 受控；tight=${tightTokens}`,
  )
}

async function testRealHookAbortTool(llm: OpenAiCompatibleChatProvider): Promise<void> {
  const events: string[] = []
  const agent = new OpenKinAgent(
    {
      id: 'real-audit-base',
      name: '真实审计',
      systemPrompt: '若用户要求查天气，可调用 get_weather。',
      maxSteps: 4,
    },
    llm,
    createDemoToolRuntime(),
    undefined,
    [
      {
        async onBeforeToolCall(_ctx, call) {
          if (call.name === 'get_weather') {
            return { action: 'abort', reason: 'real-audit 故意中止工具' }
          }
          return { action: 'continue' }
        },
      },
      createRecordingHook(events),
    ],
  )
  const result = await agent.run('real-audit-abort', '请调用 get_weather 查北京天气（本会由 hook 中止工具）。')
  assert(result.status === 'aborted', `hook-abort: expected aborted, got ${result.status}`)
  assert(result.error?.code === 'RUN_ABORTED', 'hook-abort: 期望 RUN_ABORTED')
  assert(events.includes('onRunEnd'), 'hook-abort: 应有 onRunEnd')
}

async function main(): Promise<void> {
  const apiKey = requireEnv('OPENAI_API_KEY')
  const baseUrl = requireEnv('OPENAI_BASE_URL')
  const model = requireEnv('OPENAI_MODEL')
  const llm = createLlm(apiKey, baseUrl, model)

  const suites: Array<{ name: string; fn: () => Promise<void> }> = [
    { name: 'real_tool_and_hooks', fn: () => testRealToolAndHooks(llm) },
    { name: 'real_memory_port', fn: () => testRealMemoryInPrompt(llm) },
    { name: 'real_multi_turn', fn: () => testRealMultiTurnHistory(llm) },
    { name: 'real_compression_maxPromptTokens', fn: () => testRealCompressionBudget(llm) },
    { name: 'real_hook_abort_tool', fn: () => testRealHookAbortTool(llm) },
  ]

  console.error('')
  console.error('══════════════════════════════════════════════════════')
  console.error('  first-layer-real-audit（真实 API，非 verify 默认）')
  console.error(`  model=${model}`)
  console.error('══════════════════════════════════════════════════════')
  console.error('')

  for (const { name, fn } of suites) {
    process.stderr.write(`→ ${name} … `)
    await fn()
    console.error('ok')
    await sleep(1500)
  }

  console.error('')
  console.error('first-layer-real-audit: 全部通过。覆盖说明见 docs/first-layer/FIRST_LAYER_COVERAGE.md。')
  console.error('')
}

main().catch((e) => {
  console.error('first-layer-real-audit: FAILED', e)
  process.exit(1)
})
