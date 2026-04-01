import {
  InMemoryToolRuntime,
  StaticToolProvider,
  type AgentDefinition,
  type AgentLifecycleHook,
  type AgentResult,
  type ToolExecutor,
  type ToolRuntime,
} from '@openkin/core'

export const demoAgentDefinition: AgentDefinition = {
  id: 'assistant',
  name: 'OpenKin Assistant',
  systemPrompt: 'You are a helpful assistant that can use tools when needed.',
  maxSteps: 4,
}

/** Live demo: enough steps for multiple tool rounds + final answer (e.g. two cities + synthesis). */
export const demoLiveAgentDefinition: AgentDefinition = {
  id: 'assistant',
  name: 'OpenKin Assistant',
  systemPrompt:
    'You are a careful assistant. When comparing places or answering from data, call the weather tool once per city you need, read the results, then answer in natural language. Prefer separate tool calls for each city.',
  maxSteps: 8,
}

function inferCity(input: Record<string, unknown>): string {
  const raw = typeof input.city === 'string' ? input.city : ''
  const lower = raw.toLowerCase()
  if (lower.includes('beijing') || raw.includes('北京')) return 'Beijing'
  if (lower.includes('shanghai') || raw.includes('上海')) return 'Shanghai'
  if (lower.includes('guangzhou') || raw.includes('广州')) return 'Guangzhou'
  return raw.trim() || 'Unknown'
}

const weatherExecutor: ToolExecutor = {
  async execute(input, context) {
    const city = inferCity(input)
    const table: Record<string, { forecast: string }> = {
      Beijing: { forecast: 'Clear sky, 25°C' },
      Shanghai: { forecast: 'Humid, 28°C' },
      Guangzhou: { forecast: 'Warm rain, 26°C' },
      Unknown: { forecast: 'Partly cloudy, 22°C' },
    }
    const row = table[city] ?? table.Unknown
    return {
      toolCallId: `weather-${context.stepIndex}`,
      name: 'get_weather',
      output: {
        city,
        forecast: row.forecast,
      },
    }
  },
}

const weatherToolDef = {
  name: 'get_weather',
  description:
    '查询单个城市的模拟天气。若要对比多个城市，请对每个城市各调用一次。城市名可用中文（如 北京）或英文。',
  inputSchema: {
    type: 'object',
    properties: {
      city: { type: 'string', description: '城市名，例如 北京、上海、Guangzhou' },
    },
    required: ['city'],
  },
}

export function createDemoToolRuntime(): ToolRuntime {
  return new InMemoryToolRuntime([
    new StaticToolProvider('builtin-weather', 'builtin', [weatherToolDef], { get_weather: weatherExecutor }),
  ])
}

export const demoLoggingHooks: AgentLifecycleHook[] = [
  {
    onRunStart(ctx) {
      console.error(`[hook] run started: ${ctx.traceId}`)
    },
    onRunEnd(ctx, result) {
      console.error(`[hook] run ended: ${ctx.traceId} -> ${result.status}`)
    },
  },
]

/** Printed to stderr in live demo: each LLM call and each tool result is visible (multi-round “reasoning” trace). */
export const demoVerboseRoundHooks: AgentLifecycleHook[] = [
  {
    onRunStart(ctx) {
      console.error('')
      console.error('════════════════════════════════════════════════════════════')
      console.error(`  First-layer live demo  ·  trace ${ctx.traceId}`)
      console.error('════════════════════════════════════════════════════════════')
    },
    onBeforeLLMCall(ctx, messages) {
      console.error('')
      console.error(`┌── Step ${ctx.stepIndex + 1} · model call  (${messages.length} messages in context)`)
      return undefined
    },
    onAfterLLMCall(ctx, response) {
      if (response.toolCalls?.length) {
        console.error(`│  Model requests ${response.toolCalls.length} tool call(s)  [finish=${response.finishReason}]`)
        for (const tc of response.toolCalls) {
          console.error(`│    → ${tc.name}(${JSON.stringify(tc.input)})`)
        }
      } else {
        const text =
          response.message?.content
            .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
            .map((p) => p.text)
            .join('') ?? ''
        console.error(`│  Model returns assistant text  [finish=${response.finishReason}]`)
        console.error(`│    ${text.slice(0, 600)}${text.length > 600 ? '…' : ''}`)
      }
      console.error('└──')
      return response
    },
    onAfterToolCall(_ctx, result) {
      console.error(`   ⟵ tool result  ${result.name}: ${JSON.stringify(result.output)}`)
      return result
    },
    onRunEnd(_ctx, result) {
      console.error('')
      console.error(`══ Run finished: ${result.status}  finishReason=${result.finishReason ?? '—'} ══`)
      console.error('')
    },
  },
]

export const demoUserPrompt = 'What is the weather in Beijing today?'

/** Forces multiple tool rounds: two cities, then synthesis (typical ReAct loop). */
export const demoLiveUserPrompt =
  'Compare the weather in Beijing and Shanghai today: call get_weather once for each city, then say which city is warmer and by roughly how much (one or two sentences).'

/** 交互式中文 demo：系统提示中写明模型名，便于用户询问「你是什么模型」。 */
export function buildInteractiveAgentDefinition(model: string, baseUrl: string): AgentDefinition {
  const base = baseUrl.replace(/\/+$/, '')
  return {
    id: 'assistant',
    name: 'OpenKin 演示助手',
    systemPrompt: `你是 OpenKin 第一层运行时的演示助手。**请始终用中文**与用户对话，语气自然、简洁。

【你必须如实告知用户的事实】
- 当前 API 请求使用的模型标识（model 字段）为：「${model}」。
- 通过 OpenAI 兼容的 chat/completions 接口接入；服务端根路径为：${base}
当用户询问「你是什么模型」「你用的是什么 AI」「你是哪个模型」等类似问题时，用一两句话如实说明上述模型名与接入方式（OpenAI 兼容 API），不要编造不存在的型号或厂商细节。若用户问天气等与工具相关的问题，可调用 get_weather。`,
    maxSteps: 8,
  }
}

/** 交互模式：中文轮次轨迹（输出到 stderr）。 */
export const demoInteractiveVerboseHooks: AgentLifecycleHook[] = [
  {
    onRunStart(ctx) {
      console.error('')
      console.error('────────────────────────────────────────')
      console.error(`  本轮 trace：${ctx.traceId}`)
      console.error('────────────────────────────────────────')
    },
    onBeforeLLMCall(ctx, messages) {
      console.error('')
      console.error(`┌ 第 ${ctx.stepIndex + 1} 轮 · 调用模型（上下 ${messages.length} 条消息）`)
      return undefined
    },
    onAfterLLMCall(ctx, response) {
      if (response.toolCalls?.length) {
        console.error(`│ 模型请求 ${response.toolCalls.length} 个工具  [${response.finishReason}]`)
        for (const tc of response.toolCalls) {
          console.error(`│   → ${tc.name}(${JSON.stringify(tc.input)})`)
        }
      } else {
        const text =
          response.message?.content
            .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
            .map((p) => p.text)
            .join('') ?? ''
        console.error(`│ 模型直接回复  [${response.finishReason}]`)
        console.error(`│   ${text.slice(0, 500)}${text.length > 500 ? '…' : ''}`)
      }
      console.error('└')
      return response
    },
    onAfterToolCall(_ctx, result) {
      console.error(`   ⟵ 工具 ${result.name}：${JSON.stringify(result.output)}`)
      return result
    },
    onRunEnd(_ctx, result) {
      console.error('')
      console.error(`── 本轮结束：${result.status}  ${result.finishReason ?? ''} ──`)
      console.error('')
    },
  },
]

export function assistantReplyText(result: AgentResult): string {
  if (result.status === 'failed' || result.status === 'budget_exhausted') {
    const e = result.error
    return e ? `[运行失败] ${e.code}：${e.message}` : '[运行失败]'
  }
  if (result.status === 'cancelled' || result.status === 'aborted') {
    const e = result.error
    return e ? `[已中止] ${e.message}` : '[已中止]'
  }
  const parts = result.output?.content?.filter((p) => p.type === 'text').map((p) => p.text) ?? []
  return parts.join('') || '(无文本回复)'
}
