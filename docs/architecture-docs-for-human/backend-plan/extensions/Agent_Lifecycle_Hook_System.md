# Agent 生命周期 Hook 系统

> 文档状态：草稿 · 待 Review  
> 更新时间：2026-03-31  
> 对应模块：`core/agent/lifecycle`

---

## 目录

1. [为什么需要 Hook 系统](#1-为什么需要-hook-系统)
2. [三种 Hook 类型](#2-三种-hook-类型)
3. [完整接口定义](#3-完整接口定义)
4. [数据流全景图](#4-数据流全景图)
5. [与推理核心的交互机制](#5-与推理核心的交互机制)
6. [各 Hook 点位详解与示例](#6-各-hook-点位详解与示例)
   - 6.1 `onRunStart`
   - 6.2 `onRunEnd`
   - 6.3 `onRunError`
   - 6.4 `onContextBuild`
   - 6.5 `onBeforeLLMCall`
   - 6.6 `onAfterLLMCall`
   - 6.7 `onBeforeToolCall`
   - 6.8 `onAfterToolCall`
   - 6.9 `onStepEnd`
   - 6.10 `onStreamChunk`
   - 6.11 `onProgressUpdate`
7. [执行机制详解](#7-执行机制详解)
8. [内置插件清单](#8-内置插件清单)
9. [如何编写一个插件](#9-如何编写一个插件)
10. [设计决策与常见问题](#10-设计决策与常见问题)

---

## 1. 为什么需要 Hook 系统

### 1.1 ReAct 循环不是线性流

Agent 的推理过程是一个**有状态的迭代循环**，不是简单的"进 → 出"：

```
用户输入
  └─ ReAct 循环（可能重复 N 次）
       ├─ [上下文构建] ← 每次 LLM 调用前都需要重新准备 context
       ├─ [LLM 调用]   ← 思考：下一步做什么？
       ├─ [工具调用]   ← 行动：执行工具
       └─ [观察结果]   ← 把工具结果追加到上下文，继续循环
  └─ 最终答案输出
```

一次完整的用户请求可能触发 **3 次 LLM 调用 + 5 次工具调用**。每次 LLM 调用、每次工具调用都是独立的时机，需要独立 hook。

### 1.2 如果没有 Hook，扩展功能就必须修改核心

以下是三个具体场景，说明"不得不 hook"的必要性：

**场景 A：Trace 日志**

需要记录每次 LLM 调用的 Token 用量、每次工具调用的入参和耗时。

```typescript
// ❌ 没有 hook：日志代码必须侵入推理核心
async function reactLoop() {
  logger.trace('run start')                          // 侵入 ①

  while (true) {
    logger.trace('before llm call')                  // 侵入 ②
    const t0 = Date.now()
    const response = await llm.call(messages)
    logger.trace('after llm call', {                 // 侵入 ③
      tokens: response.usage,
      ms: Date.now() - t0
    })

    if (response.toolCalls) {
      for (const call of response.toolCalls) {
        logger.trace('before tool', call.name)       // 侵入 ④
        const result = await tool.run(call)
        logger.trace('after tool', result)           // 侵入 ⑤
      }
    }
  }
}
// 想换成 OpenTelemetry？→ 直接改核心代码
```

```typescript
// ✅ 有 hook：TraceLoggerPlugin 外置，核心零感知
class TraceLoggerPlugin implements AgentLifecycleHooks {
  async onAfterLLMCall(ctx, response) {
    await this.store.record({ tokens: response.usage, ms: ctx.durationMs })
    return null // 不修改 response
  }
  async onAfterToolCall(ctx, toolName, result) {
    await this.store.record({ tool: toolName, ms: ctx.durationMs })
    return null
  }
}
// 推理核心代码一行不改
```

**场景 B：内容安全过滤**

在 LLM 输出之后、工具执行之前，检测危险指令并拦截。

```
onBeforeLLMCall  → 太早，LLM 还没输出，没内容可过滤
onAfterLLMCall   → 刚好：LLM 输出了 tool_call，但工具还没执行 ✓
onAfterToolCall  → 太晚，危险命令已经执行了
onRunEnd         → 更晚，一切都结束了
```

如果缺少 `onAfterLLMCall` 这个精确节点，过滤逻辑只能硬编码在 `reactLoop()` 的"解析 tool_call 后、执行工具前"的位置，核心代码必须感知"安全过滤"的存在。

**场景 C：长期记忆 RAG 注入**

每次 LLM 调用前，根据当前对话内容检索用户的历史偏好/经验，动态追加到 context。

```
onRunStart      → 此时 messages 还是空的，检索什么？
onContextBuild  → 每次 LLM 调用前触发，此时 messages 已包含当前对话 ✓
onBeforeLLMCall → 可以，但 ContextBuilder 的聚合逻辑已经在 onContextBuild 完成，
                  在 onBeforeLLMCall 再做相当于绕过了 ContextBuilder
```

只有 `onContextBuild` 才是注入上下文的"正确时机"——它在 ContextBuilder 聚合所有插件贡献的阶段触发，结果会被统一组装。

### 1.3 为什么不用洋葱模型（Koa 风格中间件）

```
洋葱模型的形状：
  middleware A (enter)
    middleware B (enter)
      核心逻辑
    middleware B (exit)
  middleware A (exit)
```

洋葱模型的"进入前"和"退出后"只覆盖最外层边界，**无法 hook 到循环内部的某一步**。它适合 HTTP 路由这种线性流（Hono 的路由层仍然使用洋葱模型），但对 ReAct 推理循环完全不够用。

Hook 系统的优势：可以精确 hook 到"第 2 步 LLM 调用之后、第 3 步工具调用之前"这样的位置。

---

## 2. 三种 Hook 类型

所有 hook 方法按**执行语义**分为三类，每类的执行方式不同：

### 类型一：观察型（Observer）

```
特征：返回 void / Promise<void>
执行：Promise.all 并发执行，不阻塞主流程
约束：不能修改任何数据
用途：日志、监控、埋点、事件通知
```

观察型 hook 不影响主流程，任意一个观察型插件抛出异常只打印警告，**不会中断推理**。这是观察型的核心保证：监控代码永远不会让业务崩溃。

```typescript
// 示例：TraceLoggerPlugin 的 onRunStart（观察型）
async onRunStart(ctx: RunContext): Promise<void> {
  await db.insert(traces).values({ traceId: ctx.traceId, startedAt: Date.now() })
  // 返回 void，不修改任何数据
}
```

### 类型二：变换型（Transformer）

```
特征：返回新值，或返回 null/undefined 表示"不修改，透传"
执行：for...of 串行 reduce，前一个插件的输出是下一个插件的输入
约束：必须返回与入参相同类型的值，或 null
用途：数据改写、内容注入、格式转换
```

变换型 hook 构成一个管道（pipeline），插件按注册顺序依次处理数据：

```
原始 messages
  → Plugin A: 注入系统规则 → messages'
  → Plugin B: 添加上下文摘要 → messages''
  → Plugin C: return null（不修改）→ messages''（透传）
  → 发送给 LLM 的最终 messages''
```

任意一个变换型插件抛出异常会**中断整条管道并向上传播**（因为后续插件依赖前面的输出）。

```typescript
// 示例：ContentFilterPlugin 的 onAfterLLMCall（变换型）
async onAfterLLMCall(ctx: StepContext, response: LLMResponse): Promise<LLMResponse | null> {
  if (this.hasDangerousCommand(response.toolCalls)) {
    // 返回改写后的 response，清除危险工具调用
    return { ...response, toolCalls: [] }
  }
  return null // 安全，不修改，透传
}
```

### 类型三：拦截型（Guard）

```
特征：返回 { action: 'continue' | 'abort', reason?: string, replacement?: T }
执行：串行检查，任意一个插件返回 abort 即中止后续流程
约束：必须返回明确的 GuardResult
用途：权限控制、危险操作拦截、熔断、配额检查
```

拦截型与变换型的核心区别：变换型只能改数据（让流程走"弯路"），拦截型可以**直接终止流程**（让流程停下来）。

```typescript
interface GuardResult<T = unknown> {
  action: 'continue'             // 放行，流程正常继续
         | 'abort'               // 中止，抛出 AbortError（会触发 onRunError）
         | 'replace'             // 放行，但用 replacement 替代原始值继续
  reason?: string                // 中止/替换的原因（写入日志）
  replacement?: T                // action === 'replace' 时的替代值
}

// 示例：ToolPermissionGuard 的 onBeforeToolCall（拦截型）
async onBeforeToolCall(ctx: StepContext, toolName: string, input: unknown): Promise<GuardResult> {
  const allowed = await this.permissionService.check(ctx.userId, toolName)
  if (!allowed) {
    return {
      action: 'abort',
      reason: `用户 ${ctx.userId} 无权调用工具 ${toolName}`
    }
  }
  return { action: 'continue' }
}
```

> **为什么需要第三种类型？**
>
> 变换型的 `onBeforeToolCall` 可以改变输入，但无法表达"我要阻止这次调用"。如果用变换型来做权限控制，只能把 input 改成一个特殊的"禁止标记"，然后工具执行逻辑里再判断这个标记——这是隐式耦合。拦截型让"中止"成为一等公民，语义明确，核心推理循环在收到 `abort` 后走标准的错误处理路径。

### 三种类型对照表

| 类型       | 返回值                  | 执行方式       | 异常行为           | 典型用途                   |
| ---------- | ----------------------- | -------------- | ------------------ | -------------------------- |
| **观察型** | `void`                  | 并发（`Promise.all`）| 吞异常，打 WARN | 日志、监控、埋点、事件通知 |
| **变换型** | 新值 或 `null`（透传）  | 串行 reduce    | 向上传播，中断推理 | 数据改写、内容注入         |
| **拦截型** | `GuardResult`           | 串行，首个 abort 即停 | 触发 `onRunError` | 权限控制、熔断、配额检查   |

---

## 3. 完整接口定义

```typescript
// ── Context 类型 ──────────────────────────────────────────────────────────────

/** 整次 run() 调用级别的上下文，在任务开始时创建，任务结束时销毁 */
interface RunContext {
  traceId: string          // 本次推理的唯一标识（nanoid）
  sessionId: string
  agentId: string
  taskId?: string          // 由任务系统注入；纯对话场景为 undefined
  userId?: string          // 发起用户（Agent 子任务调用时为 undefined）
  startedAt: number        // run() 开始的时间戳（ms）
  stepIndex: number        // 当前处于第几步（0-indexed），由推理循环维护
  abortController: AbortController  // 外部取消信号（任务取消时触发）
}

/** ReAct 循环内单步级别的上下文，每步开始时从 RunContext 派生 */
interface StepContext extends RunContext {
  stepIndex: number        // 本步序号（RunContext.stepIndex 的快照）
  durationMs: number       // 本步已耗时（实时更新，用于超时判断）
}

// ── Hook 返回类型 ──────────────────────────────────────────────────────────────

/** 变换型：null 表示不修改，透传上一个插件的输出 */
type TransformResult<T> = T | null

/** 拦截型：明确表达放行、中止或替换 */
interface GuardResult<T = unknown> {
  action: 'continue' | 'abort' | 'replace'
  reason?: string
  replacement?: T
}

/** onContextBuild 的贡献结果 */
interface ContextAddition {
  systemPromptAddition?: string   // 追加到 system prompt 末尾
  messages?: Message[]            // 在消息列表中注入额外 message（如检索到的文档片段）
}

// ── 主接口（所有方法均为可选） ─────────────────────────────────────────────────

interface AgentLifecycleHooks {

  // ── 任务级别 ────────────────────────────────────────────────────────────────

  /** 观察型：整个 run() 调用开始时触发，只触发一次 */
  onRunStart?(ctx: RunContext): Promise<void>

  /** 观察型：run() 正常结束时触发，只触发一次 */
  onRunEnd?(ctx: RunContext, result: AgentResult): Promise<void>

  /** 观察型：run() 抛出未捕获异常时触发（含 AbortError） */
  onRunError?(ctx: RunContext, error: Error): Promise<void>

  // ── 上下文构建 ─────────────────────────────────────────────────────────────
  //   每次 LLM 调用前都会触发（即 ReAct 每步都触发）
  //   ContextBuilder 并发调用所有已注册插件，聚合所有贡献后组装最终 messages

  /** 变换型（聚合）：返回本插件希望注入的内容；返回 null 表示本步不贡献 */
  onContextBuild?(ctx: StepContext): Promise<ContextAddition | null>

  // ── LLM 调用级别 ───────────────────────────────────────────────────────────

  /** 变换型：LLM 调用前，最后修改要发送的 messages 的机会；返回 null 表示不修改 */
  onBeforeLLMCall?(ctx: StepContext, messages: Message[]): Promise<TransformResult<Message[]>>

  /** 变换型：LLM 返回后，可改写 response（如清除危险 tool_call）；返回 null 表示不修改 */
  onAfterLLMCall?(ctx: StepContext, response: LLMResponse): Promise<TransformResult<LLMResponse>>

  // ── 工具调用级别 ───────────────────────────────────────────────────────────

  /** 拦截型：工具执行前，可放行、中止或替换输入 */
  onBeforeToolCall?(ctx: StepContext, toolName: string, input: unknown): Promise<GuardResult>

  /** 变换型：工具执行后，可改写返回结果；返回 null 表示不修改 */
  onAfterToolCall?(ctx: StepContext, toolName: string, result: ToolResult): Promise<TransformResult<ToolResult>>

  // ── 步骤完成 ─────────────────────────────────────────────────────────────
  //   一个 ReAct 步骤（一次 LLM 调用 + 其触发的所有工具调用）全部完成后触发

  /** 观察型：ReAct 单步全部完成后触发（LLM 调用 + 所有工具调用均已结束） */
  onStepEnd?(ctx: StepContext, stepSummary: StepSummary): Promise<void>

  // ── 流式输出 ─────────────────────────────────────────────────────────────

  /** 观察型：流式模式下，每个 chunk 到达时触发（频率极高，插件实现必须非常轻量） */
  onStreamChunk?(ctx: RunContext, chunk: StreamChunk): Promise<void>

  // ── 进度上报 ─────────────────────────────────────────────────────────────

  /** 观察型：推理循环每步结束后由核心触发，插件负责将进度写入任务系统 */
  onProgressUpdate?(ctx: RunContext, progress: StepProgress): Promise<void>
}

// ── 辅助类型 ──────────────────────────────────────────────────────────────────

interface StepSummary {
  stepIndex: number
  llmCallCount: number         // 本步 LLM 调用次数（通常为 1）
  toolCallCount: number        // 本步工具调用次数（0 = 直接输出最终答案）
  totalTokens: number          // 本步消耗 Token 数
  durationMs: number           // 本步总耗时
}

interface StepProgress {
  stepIndex: number
  percent: number              // 进度估算（0-100），由核心根据 maxSteps 估算
  currentAction: string        // 人类可读的当前动作描述，如 "调用工具 search_web"
}
```

---

## 4. 数据流全景图

```
用户调用 agent.run(input)
│
├─ [onRunStart] ──────────────────────────────── 观察型，并发
│   └─ ConversationHistoryPlugin: 从 SQLite 加载历史消息 → 注入 ContextManager
│
│   ╔══════════════ ReAct 推理循环（重复直到 final_answer 或超步） ════════════╗
│   ║                                                                         ║
│   ║  ┌─ [onContextBuild] ─────────────────────── 变换型（聚合），并发       ║
│   ║  │   ├─ MemoryContributorPlugin: 检索长期记忆 → systemPromptAddition    ║
│   ║  │   ├─ RagContributorPlugin:    检索知识库   → messages（文档片段）    ║
│   ║  │   └─ ContextBuilder 聚合所有贡献，组装最终 messages                  ║
│   ║  │                                                                      ║
│   ║  ├─ [onBeforeLLMCall] ──────────────────── 变换型，串行 reduce          ║
│   ║  │   └─ ContentFilterPlugin: 注入安全规则到 system prompt               ║
│   ║  │                                                                      ║
│   ║  ├─ ━━━━ LLM 调用 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
│   ║  │                                                                      ║
│   ║  ├─ [onAfterLLMCall] ───────────────────── 变换型，串行 reduce          ║
│   ║  │   ├─ TraceLoggerPlugin: 记录 Token 用量、耗时（return null）         ║
│   ║  │   └─ ContentFilterPlugin: 检测危险 tool_call，必要时清除             ║
│   ║  │                                                                      ║
│   ║  │   ┌─ 若有工具调用（for each tool_call）─────────────────────────────┤
│   ║  │   │                                                                  ║
│   ║  │   ├─ [onBeforeToolCall] ─────────────── 拦截型，串行检查             ║
│   ║  │   │   ├─ ToolPermissionGuard: 检查用户权限，无权限 → abort           ║
│   ║  │   │   └─ RateLimitGuard:      检查调用频率，超限 → abort             ║
│   ║  │   │                                                                  ║
│   ║  │   ├─ ━━━━ 工具执行 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
│   ║  │   │                                                                  ║
│   ║  │   └─ [onAfterToolCall] ─────────────── 变换型，串行 reduce           ║
│   ║  │       ├─ TraceLoggerPlugin: 记录工具名、耗时（return null）          ║
│   ║  │       └─ ResultSanitizerPlugin: 截断超长返回、脱敏敏感信息           ║
│   ║  │                                                                      ║
│   ║  ├─ [onStepEnd] ──────────────────────────── 观察型，并发              ║
│   ║  │   ├─ TraceLoggerPlugin: 将本步摘要写入 AgentRunTrace                 ║
│   ║  │   └─ CostTrackerPlugin: 累计本步 Token 消耗                          ║
│   ║  │                                                                      ║
│   ║  └─ [onProgressUpdate] ────────────────────── 观察型，并发             ║
│   ║      └─ TaskProgressPlugin: 更新 tasks 表进度 → TaskEventBus → WebSocket║
│   ║                                                                         ║
│   ║  ── [onStreamChunk] ─────────────────────────── 观察型，并发           ║
│   ║      └─ StreamForwarderPlugin: 将 chunk 推送到 SSE 连接                 ║
│   ║                                                                         ║
│   ╚═════════════════════════════════════════════════════════════════════════╝
│
├─ [onRunEnd] ────────────────────────────────── 观察型，并发
│   ├─ ConversationHistoryPlugin: 新消息写入 SQLite，触发摘要压缩（异步）
│   ├─ LongTermMemoryPlugin:      LLM 提炼本轮经验 → 写入 memory_entries 表
│   └─ TraceLoggerPlugin:         写入 agent_run_traces 表，状态置为 success
│
└─ [onRunError] ─────────────────────────────── 观察型，并发（异常时替代 onRunEnd）
    └─ TraceLoggerPlugin: 写入 agent_run_traces 表，状态置为 error，记录错误信息
```

---

## 5. 与推理核心的交互机制

### 5.1 核心如何调用 hook

推理核心（`core/agent/ReActLoop`）内部维护一个 `HookRunner`，所有 hook 调用都通过 `HookRunner` 统一分发：

```typescript
class HookRunner {
  private plugins: AgentLifecycleHooks[] = []

  use(plugin: AgentLifecycleHooks): void {
    this.plugins.push(plugin)
  }

  /** 观察型 hook：并发执行，吞异常 */
  async observe<K extends ObserverHookKeys>(
    hookName: K,
    ...args: HookArgs<K>
  ): Promise<void> {
    const handlers = this.plugins
      .map(p => p[hookName])
      .filter(Boolean) as Function[]

    const results = handlers.map(fn =>
      // 每个观察型 hook 独立捕获异常，防止互相影响
      (fn(...args) as Promise<void>).catch(err => {
        logger.warn({ hookName, err }, `Observer hook threw, ignored`)
      })
    )
    await Promise.all(results)
  }

  /** 变换型 hook：串行 reduce，异常向上传播 */
  async transform<T, K extends TransformerHookKeys>(
    hookName: K,
    initial: T,
    ctx: StepContext,
    ...extraArgs: unknown[]
  ): Promise<T> {
    let current = initial
    for (const plugin of this.plugins) {
      const fn = plugin[hookName]
      if (!fn) continue
      // 异常不捕获，直接向上传播，中断推理循环
      const result = await fn.call(plugin, ctx, current, ...extraArgs)
      if (result !== null && result !== undefined) {
        current = result  // 插件返回新值则更新，否则透传
      }
    }
    return current
  }

  /** 拦截型 hook：串行检查，首个 abort 即停 */
  async guard<T, K extends GuardHookKeys>(
    hookName: K,
    ctx: StepContext,
    ...args: HookArgs<K>
  ): Promise<GuardResult<T>> {
    for (const plugin of this.plugins) {
      const fn = plugin[hookName]
      if (!fn) continue
      const result = await fn.call(plugin, ctx, ...args) as GuardResult<T>
      if (result.action === 'abort' || result.action === 'replace') {
        return result  // 首个非 continue 的结果立即返回
      }
    }
    return { action: 'continue' }
  }
}
```

### 5.2 推理核心内的调用点

推理循环是简洁的：核心只负责调用 hook，不关心 hook 里做了什么。

```typescript
class ReActLoop {
  private hooks: HookRunner

  async run(input: string, ctx: RunContext): Promise<AgentResult> {

    // ① 任务开始
    await this.hooks.observe('onRunStart', ctx)

    try {
      while (ctx.stepIndex < this.maxSteps) {
        const stepCtx: StepContext = { ...ctx, durationMs: 0 }
        const stepStart = Date.now()

        // ② 上下文构建（每步都触发）
        const additions = await this.contextBuilder.build(stepCtx)
        //   ContextBuilder 内部调用 hooks.transform('onContextBuild', ...)
        //   并把所有插件贡献聚合成最终 messages

        let messages = this.contextManager.getMessages(additions)

        // ③ LLM 调用前变换
        messages = await this.hooks.transform('onBeforeLLMCall', messages, stepCtx)

        // ④ LLM 调用
        const response = await this.llm.call(messages)

        // ⑤ LLM 调用后变换（可改写 response，如清除危险 tool_call）
        const finalResponse = await this.hooks.transform('onAfterLLMCall', response, stepCtx)

        // ⑥ 工具调用
        if (finalResponse.toolCalls?.length) {
          for (const toolCall of finalResponse.toolCalls) {

            // ⑦ 工具调用前拦截
            const guard = await this.hooks.guard('onBeforeToolCall', stepCtx, toolCall.name, toolCall.input)
            if (guard.action === 'abort') {
              throw new AbortError(guard.reason)
            }
            const toolInput = guard.action === 'replace' ? guard.replacement : toolCall.input

            // ⑧ 工具执行
            let toolResult = await this.toolRegistry.execute(toolCall.name, toolInput)

            // ⑨ 工具调用后变换
            toolResult = await this.hooks.transform('onAfterToolCall', toolResult, stepCtx, toolCall.name)

            this.contextManager.appendToolResult(toolCall.id, toolResult)
          }
        } else {
          // 没有工具调用 = 最终答案
          const result = { content: finalResponse.content }

          // ⑩ 步骤结束（聚合摘要）
          stepCtx.durationMs = Date.now() - stepStart
          await this.hooks.observe('onStepEnd', stepCtx, buildStepSummary(stepCtx, finalResponse))
          await this.hooks.observe('onProgressUpdate', ctx, buildProgress(ctx))

          // ⑪ 任务结束
          await this.hooks.observe('onRunEnd', ctx, result)
          return result
        }

        // ⑩ 步骤结束
        stepCtx.durationMs = Date.now() - stepStart
        await this.hooks.observe('onStepEnd', stepCtx, buildStepSummary(stepCtx, finalResponse))
        await this.hooks.observe('onProgressUpdate', ctx, buildProgress(ctx))

        ctx.stepIndex++
      }

      throw new MaxStepsExceededError(this.maxSteps)

    } catch (err) {
      // ⑫ 任务异常
      await this.hooks.observe('onRunError', ctx, err as Error)
      throw err
    }
  }
}
```

**核心与 hook 的交互原则：**

| 原则 | 说明 |
|------|------|
| 核心不导入任何插件 | 所有插件从外部注入，核心只知道 `AgentLifecycleHooks` 接口 |
| 核心不捕获观察型异常 | `HookRunner.observe()` 内部已捕获，核心不感知 |
| 核心对变换型异常透传 | 插件的变换异常会中断当次推理，走 `onRunError` |
| 核心遵从拦截型 abort | 收到 `abort` 即 throw `AbortError`，不执行后续步骤 |

---

## 6. 各 Hook 点位详解与示例

### 6.1 `onRunStart`

**类型**：观察型  
**触发时机**：`agent.run()` 开始，还没有任何 LLM 调用，只触发**一次**  
**可用数据**：`RunContext`（traceId、sessionId、agentId、taskId、userId）  
**典型用途**：加载历史消息、初始化追踪、会话审计

```
时序：
agent.run() 调用
  └─ [onRunStart] ← 此时 ContextManager 还是空的
  └─ ReAct 循环开始
```

**示例 A：ConversationHistoryPlugin — 加载历史消息**

```typescript
class ConversationHistoryPlugin implements AgentLifecycleHooks {
  constructor(
    private db: Database,
    private contextManager: ContextManager,
    private config: { maxRawMessages: number }
  ) {}

  async onRunStart(ctx: RunContext): Promise<void> {
    const history = await this.db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, ctx.sessionId))
      .orderBy(asc(messages.createdAt))

    if (history.length < this.config.maxRawMessages) {
      // 短对话：直接注入原始消息
      this.contextManager.prependMessages(history)
    } else {
      // 长对话：摘要 + 最近 K 条
      const summary = await this.db.query.summaries.findFirst({
        where: eq(summaries.sessionId, ctx.sessionId)
      })
      if (summary) {
        this.contextManager.prependSystemNote(summary.content)
      }
      const recent = history.slice(-this.config.maxRawMessages)
      this.contextManager.prependMessages(recent)
    }
  }
}
```

**示例 B：AuditPlugin — 会话审计**

```typescript
class AuditPlugin implements AgentLifecycleHooks {
  async onRunStart(ctx: RunContext): Promise<void> {
    // 记录谁在什么时候触发了什么 Agent
    await auditLog.write({
      event: 'agent_run_start',
      userId: ctx.userId,
      agentId: ctx.agentId,
      sessionId: ctx.sessionId,
      timestamp: Date.now()
    })
  }
}
```

---

### 6.2 `onRunEnd`

**类型**：观察型  
**触发时机**：`agent.run()` 正常结束（输出最终答案），只触发**一次**  
**可用数据**：`RunContext` + `AgentResult`（最终输出内容）  
**典型用途**：持久化对话消息、提炼长期记忆、写入完整 trace

```
时序：
ReAct 循环输出 final_answer
  └─ [onRunEnd] ← 此时推理已完成，可以安全地做 IO 操作
  └─ run() 返回 AgentResult
```

**示例 A：ConversationHistoryPlugin — 持久化新消息**

```typescript
class ConversationHistoryPlugin implements AgentLifecycleHooks {
  async onRunEnd(ctx: RunContext, result: AgentResult): Promise<void> {
    // 写入 messages 表
    await this.db.insert(messages).values([
      {
        sessionId: ctx.sessionId,
        role: 'user',
        content: result.userInput,
        createdAt: ctx.startedAt
      },
      {
        sessionId: ctx.sessionId,
        role: 'assistant',
        content: result.content,
        createdAt: Date.now()
      }
    ])

    // 异步触发摘要压缩（不阻塞响应）
    const count = await this.db.select({ count: count() }).from(messages)
      .where(eq(messages.sessionId, ctx.sessionId))
    if (count[0].count > this.config.summaryThreshold) {
      // fire-and-forget：不 await，不影响 onRunEnd 完成时间
      this.triggerSummaryCompression(ctx.sessionId).catch(err =>
        logger.warn({ err }, 'Summary compression failed, will retry next time')
      )
    }
  }
}
```

**示例 B：LongTermMemoryPlugin — 自动提炼经验**

```typescript
class LongTermMemoryPlugin implements AgentLifecycleHooks {
  async onRunEnd(ctx: RunContext, result: AgentResult): Promise<void> {
    // 让 LLM 判断本次对话是否有值得保留的经验
    const extraction = await this.llm.call([{
      role: 'system',
      content: '从以下对话中提炼值得长期记忆的内容（用户偏好、重要结论等）。如果没有，返回空数组。'
    }, {
      role: 'user',
      content: JSON.stringify(result.trace)
    }])

    const memories = JSON.parse(extraction.content) as string[]
    for (const memory of memories) {
      await this.db.insert(memoryEntries).values({
        agentId: ctx.agentId,
        content: memory,
        createdAt: Date.now()
      })
    }
  }
}
```

---

### 6.3 `onRunError`

**类型**：观察型  
**触发时机**：`run()` 过程中任何未捕获异常（包含 `onBeforeToolCall` 返回 `abort` 触发的 `AbortError`、超步、LLM 超时等），与 `onRunEnd` 互斥  
**可用数据**：`RunContext` + `Error` 对象  
**典型用途**：错误记录、trace 状态标记、告警通知

**示例：TraceLoggerPlugin — 异常 trace 入库**

```typescript
class TraceLoggerPlugin implements AgentLifecycleHooks {
  async onRunError(ctx: RunContext, error: Error): Promise<void> {
    // 将 trace 状态标记为 error 写入数据库
    await this.db
      .update(agentRunTraces)
      .set({
        status: 'error',
        error: error.message,
        endedAt: Date.now(),
        totalDurationMs: Date.now() - ctx.startedAt
      })
      .where(eq(agentRunTraces.traceId, ctx.traceId))

    // 超过阈值的错误发送告警
    if (this.isAlertWorthy(error)) {
      await this.alertService.send({
        level: 'error',
        message: `Agent ${ctx.agentId} 推理失败`,
        context: { traceId: ctx.traceId, error: error.message }
      })
    }
  }

  private isAlertWorthy(error: Error): boolean {
    // AbortError（权限拒绝）不告警，这是正常业务拦截
    return !(error instanceof AbortError)
  }
}
```

---

### 6.4 `onContextBuild`

**类型**：变换型（聚合模式）  
**触发时机**：每次 LLM 调用之前，ReAct 每步都触发  
**可用数据**：`StepContext`（含 `stepIndex`，可区分"首步"与"后续步"）  
**返回值**：`ContextAddition | null`（`null` 表示本步不贡献任何内容）  
**特殊说明**：与其他变换型不同，`onContextBuild` 是**聚合模式**——`ContextBuilder` 并发调用所有插件，把各插件的贡献合并后统一组装，而非串行 reduce（各插件贡献相互独立，不需要顺序依赖）

```
时序（每步）：
[onContextBuild] × 所有插件（并发）
  ├─ Plugin A 返回 { systemPromptAddition: "用户偏好：简洁回答" }
  ├─ Plugin B 返回 { messages: [{ role: 'user', content: '相关文档：...' }] }
  └─ Plugin C 返回 null（本步不贡献）
      ↓
ContextBuilder 聚合：
  systemPrompt += Plugin A 的贡献
  messages.unshift(Plugin B 贡献的文档片段)
      ↓
组装最终 messages → 传给 onBeforeLLMCall
```

**示例 A：LongTermMemoryPlugin — 注入相关记忆（仅首步）**

```typescript
class LongTermMemoryPlugin implements AgentLifecycleHooks {
  async onContextBuild(ctx: StepContext): Promise<ContextAddition | null> {
    // 只在第一步检索，后续步骤的上下文已经包含了足够信息
    if (ctx.stepIndex !== 0) return null

    const currentMessage = ctx.userInput
    const memories = await this.memoryStore.search({
      agentId: ctx.agentId,
      query: currentMessage,
      topK: 5
    })

    if (memories.length === 0) return null

    return {
      systemPromptAddition: [
        '\n## 关于用户的历史记忆（供参考）',
        ...memories.map(m => `- ${m.content}`)
      ].join('\n')
    }
  }
}
```

**示例 B：RagContributorPlugin — 每步动态检索知识库**

```typescript
class RagContributorPlugin implements AgentLifecycleHooks {
  async onContextBuild(ctx: StepContext): Promise<ContextAddition | null> {
    // 获取当前最新的用户消息（包含工具执行结果，比首步更精确）
    const latestUserContent = this.contextManager.getLatestUserContent(ctx.sessionId)

    const docs = await this.vectorStore.search({
      query: latestUserContent,
      knowledgeBases: ctx.ragKnowledgeBases,
      topK: 3
    })

    if (docs.length === 0) return null

    // 以 message 形式注入，而非追加到 system prompt，
    // 这样文档内容出现在对话流中，LLM 更容易关注到
    return {
      messages: [{
        role: 'user' as const,
        content: `以下是从知识库检索到的相关内容，请参考：\n\n${
          docs.map(d => `### ${d.title}\n${d.content}`).join('\n\n')
        }`
      }]
    }
  }
}
```

**关键对比：为何 RAG 需要每步触发，而 Memory 只需首步？**

| | 长期记忆（Memory） | 知识库（RAG） |
|---|---|---|
| **内容性质** | 用户偏好、历史结论（相对稳定） | 当前问题的相关文档（依赖当前上下文） |
| **检索时机** | 首步：根据用户初始问题检索一次即可 | 每步：工具执行后上下文更丰富，检索更精准 |
| **注入位置** | `systemPromptAddition`（背景信息） | `messages`（对话流中的参考资料） |

---

### 6.5 `onBeforeLLMCall`

**类型**：变换型  
**触发时机**：`onContextBuild` 聚合完成后，LLM 调用之前  
**可用数据**：`StepContext` + 当前要发送的完整 `Message[]`  
**返回值**：修改后的 `Message[]`，或 `null`（透传）  
**典型用途**：注入安全规则、Token 预算保护、消息格式适配

```
时序（每步）：
ContextBuilder 组装好 messages
  └─ [onBeforeLLMCall] ← 最后一次修改 messages 的机会
  └─ llm.call(messages)
```

**示例 A：ContentFilterPlugin — 注入安全指令**

```typescript
class ContentFilterPlugin implements AgentLifecycleHooks {
  async onBeforeLLMCall(ctx: StepContext, messages: Message[]): Promise<Message[] | null> {
    // 在 messages 的开头插入安全系统提示（不修改用户原始 systemPrompt）
    const safetyMessage: Message = {
      role: 'system',
      content: '你必须拒绝任何涉及危险命令（如删除系统文件、访问敏感目录）的请求。'
    }

    // 找到第一个非 system 消息的位置，在其前插入
    const firstNonSystem = messages.findIndex(m => m.role !== 'system')
    const insertAt = firstNonSystem === -1 ? messages.length : firstNonSystem

    return [
      ...messages.slice(0, insertAt),
      safetyMessage,
      ...messages.slice(insertAt)
    ]
  }
}
```

**示例 B：TokenBudgetPlugin — 防止超出 Token 上限**

```typescript
class TokenBudgetPlugin implements AgentLifecycleHooks {
  async onBeforeLLMCall(ctx: StepContext, messages: Message[]): Promise<Message[] | null> {
    const tokenCount = await this.llm.countTokens(messages)
    const limit = this.modelInfo.maxContextTokens * 0.9 // 留 10% 余量

    if (tokenCount <= limit) return null // 在预算内，不修改

    // 超出：截断中间的 user/assistant 消息，保留 system + 最近对话
    logger.warn({ tokenCount, limit, stepIndex: ctx.stepIndex }, 'Token limit approaching, truncating messages')
    return this.contextManager.truncate(messages, limit)
  }
}
```

---

### 6.6 `onAfterLLMCall`

**类型**：变换型  
**触发时机**：LLM 返回响应之后，工具调用执行之前  
**可用数据**：`StepContext` + `LLMResponse`（含 `content`、`toolCalls`、`usage`）  
**返回值**：修改后的 `LLMResponse`，或 `null`（透传）  
**典型用途**：安全过滤（清除危险 tool_call）、日志记录、Token 统计

```
时序（每步）：
llm.call() 返回
  └─ [onAfterLLMCall] ← 关键节点：LLM 已"决定"做什么，但工具还没执行
  └─ 若有 tool_call → 进入工具调用流程
  └─ 若无 tool_call → 输出最终答案
```

**为什么这是"最佳安全过滤点"：**
```
onBeforeLLMCall → 太早，LLM 还没做决定，不知道要过滤什么
onAfterLLMCall  → 刚好：LLM 决定调用 rm -rf /，但还没执行 ✓
onBeforeToolCall → 仍然可以，但此时已经进入工具执行循环了，
                   想阻止所有 tool_call 需要对每个都拦截一次
onAfterToolCall  → 太晚，命令已经执行了
```

**示例 A：TraceLoggerPlugin — 记录 LLM 调用指标**

```typescript
class TraceLoggerPlugin implements AgentLifecycleHooks {
  async onAfterLLMCall(ctx: StepContext, response: LLMResponse): Promise<LLMResponse | null> {
    // 观察型：记录数据，不修改 response
    await this.traceStore.appendStep(ctx.traceId, {
      stepIndex: ctx.stepIndex,
      type: 'llm_call',
      tokensUsed: response.usage?.totalTokens,
      durationMs: ctx.durationMs,
      toolCallsCount: response.toolCalls?.length ?? 0,
      timestamp: Date.now()
    })

    return null // 不修改 response
  }
}
```

**示例 B：ContentFilterPlugin — 拦截危险工具调用**

```typescript
class ContentFilterPlugin implements AgentLifecycleHooks {
  private readonly FORBIDDEN_TOOLS = ['delete_file', 'execute_shell', 'format_disk']
  private readonly DANGEROUS_PATTERNS = [/rm\s+-rf/, /sudo\s+rm/, />\s*\/dev\/sda/]

  async onAfterLLMCall(ctx: StepContext, response: LLMResponse): Promise<LLMResponse | null> {
    if (!response.toolCalls?.length) return null

    const safeCalls = response.toolCalls.filter(call => {
      // 检查工具名是否在黑名单
      if (this.FORBIDDEN_TOOLS.includes(call.name)) {
        logger.warn({ toolName: call.name, traceId: ctx.traceId }, 'Blocked forbidden tool call')
        return false
      }
      // 检查参数是否包含危险模式
      const inputStr = JSON.stringify(call.input)
      if (this.DANGEROUS_PATTERNS.some(p => p.test(inputStr))) {
        logger.warn({ toolName: call.name, input: call.input }, 'Blocked dangerous tool input')
        return false
      }
      return true
    })

    if (safeCalls.length === response.toolCalls.length) return null // 没有被过滤

    // 返回改写后的 response（危险 tool_call 已被清除）
    return {
      ...response,
      toolCalls: safeCalls,
      // 追加一条说明，让 LLM 知道部分工具调用被拦截
      content: safeCalls.length === 0
        ? '抱歉，该操作涉及危险命令，已被安全策略拦截。'
        : response.content
    }
  }
}
```

---

### 6.7 `onBeforeToolCall`

**类型**：拦截型  
**触发时机**：每次工具执行之前（一步 LLM 调用可能触发多次）  
**可用数据**：`StepContext` + `toolName: string` + `input: unknown`  
**返回值**：`GuardResult`（`continue` / `abort` / `replace`）  
**典型用途**：权限控制、调用频率限制、参数安全校验、审批流

```
时序（每个工具调用）：
[onAfterLLMCall] 完成（tool_call 已经过变换型处理）
  └─ for each tool_call:
       └─ [onBeforeToolCall] ← 最后一次阻止工具执行的机会
            ├─ continue → 正常执行工具
            ├─ abort    → throw AbortError → 走 onRunError
            └─ replace  → 用 replacement 替换 input，继续执行
       └─ toolRegistry.execute()
```

**示例 A：ToolPermissionGuard — 基于用户角色的工具权限**

```typescript
class ToolPermissionGuard implements AgentLifecycleHooks {
  async onBeforeToolCall(ctx: StepContext, toolName: string, input: unknown): Promise<GuardResult> {
    if (!ctx.userId) return { action: 'continue' } // 系统内部调用，跳过权限检查

    const permission = await this.permissionService.check({
      userId: ctx.userId,
      resource: `tool:${toolName}`,
      action: 'execute'
    })

    if (!permission.allowed) {
      return {
        action: 'abort',
        reason: `用户 ${ctx.userId} 无权调用工具 ${toolName}（所需权限：${permission.requiredRole}）`
      }
      // 推理循环收到 abort → throw AbortError → onRunError 记录
    }

    return { action: 'continue' }
  }
}
```

**示例 B：RateLimitGuard — 工具调用频率限制**

```typescript
class RateLimitGuard implements AgentLifecycleHooks {
  async onBeforeToolCall(ctx: StepContext, toolName: string, input: unknown): Promise<GuardResult> {
    const key = `rate:${ctx.agentId}:${toolName}`
    const count = await this.redis.incr(key)

    if (count === 1) {
      await this.redis.expire(key, 60) // 每分钟重置
    }

    const limit = this.config.toolLimits[toolName] ?? this.config.defaultLimit
    if (count > limit) {
      return {
        action: 'abort',
        reason: `工具 ${toolName} 调用频率超限（${count}/${limit} 次/分钟）`
      }
    }

    return { action: 'continue' }
  }
}
```

**示例 C：PathSanitizerGuard — 参数替换（replace）**

```typescript
class PathSanitizerGuard implements AgentLifecycleHooks {
  async onBeforeToolCall(ctx: StepContext, toolName: string, input: unknown): Promise<GuardResult> {
    if (toolName !== 'read_file' && toolName !== 'write_file') {
      return { action: 'continue' }
    }

    const typedInput = input as { path: string }
    const sanitizedPath = this.sanitizePath(typedInput.path)

    if (sanitizedPath === typedInput.path) return { action: 'continue' }

    // 路径被修改：用 replace 让工具以安全路径执行，而非直接 abort
    logger.info({ original: typedInput.path, sanitized: sanitizedPath }, 'Path sanitized')
    return {
      action: 'replace',
      reason: `路径已规范化：${typedInput.path} → ${sanitizedPath}`,
      replacement: { ...typedInput, path: sanitizedPath }
    }
  }

  private sanitizePath(path: string): string {
    // 限制在 /sandbox 目录内，防止路径穿越
    return `/sandbox/${path.replace(/\.\.\//g, '').replace(/^\//, '')}`
  }
}
```

---

### 6.8 `onAfterToolCall`

**类型**：变换型  
**触发时机**：工具执行完成后，结果追加到 context 之前  
**可用数据**：`StepContext` + `toolName: string` + `ToolResult`  
**返回值**：修改后的 `ToolResult`，或 `null`（透传）  
**典型用途**：结果脱敏、长度截断、格式适配、日志记录

```
时序（每个工具调用）：
toolRegistry.execute() 完成，返回 ToolResult
  └─ [onAfterToolCall] ← 追加到 context 之前，可改写结果
  └─ contextManager.appendToolResult()
  └─ 进入下一个 tool_call，或继续 LLM 推理
```

**示例 A：TraceLoggerPlugin — 记录工具调用日志**

```typescript
class TraceLoggerPlugin implements AgentLifecycleHooks {
  async onAfterToolCall(ctx: StepContext, toolName: string, result: ToolResult): Promise<ToolResult | null> {
    await this.traceStore.appendStep(ctx.traceId, {
      stepIndex: ctx.stepIndex,
      type: 'tool_call',
      toolName,
      isError: result.isError,
      durationMs: ctx.durationMs,
      timestamp: Date.now()
      // 注意：不记录完整 result.content，可能包含敏感数据
    })

    return null // 不修改结果
  }
}
```

**示例 B：ResultSanitizerPlugin — 截断超长结果 + 脱敏**

```typescript
class ResultSanitizerPlugin implements AgentLifecycleHooks {
  private readonly MAX_CONTENT_LENGTH = 8000  // 约 2000 Token

  async onAfterToolCall(ctx: StepContext, toolName: string, result: ToolResult): Promise<ToolResult | null> {
    let content = typeof result.content === 'string'
      ? result.content
      : JSON.stringify(result.content)

    let modified = false

    // 1. 截断超长内容（防止撑爆 LLM 上下文）
    if (content.length > this.MAX_CONTENT_LENGTH) {
      content = content.slice(0, this.MAX_CONTENT_LENGTH) +
        `\n\n[内容已截断，原始长度 ${content.length} 字符]`
      modified = true
    }

    // 2. 脱敏（移除 API Key、密码等）
    const desensitized = content
      .replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED_API_KEY]')
      .replace(/password["\s]*[:=]["\s]*\S+/gi, 'password: [REDACTED]')

    if (desensitized !== content) {
      content = desensitized
      modified = true
    }

    if (!modified) return null

    return { ...result, content }
  }
}
```

---

### 6.9 `onStepEnd`

**类型**：观察型  
**触发时机**：一个完整的 ReAct 步骤结束后（一次 LLM 调用 + 其触发的所有工具调用全部完成）  
**可用数据**：`StepContext` + `StepSummary`（本步聚合统计）  
**典型用途**：步骤级 trace 记录、成本统计、慢步骤预警

```
时序：
LLM 调用完成
  所有 tool_call 执行完成（含 onAfterToolCall）
    └─ [onStepEnd] ← 整步的"收尾"节点，所有本步数据均已确定
  stepIndex++
  继续下一步（或输出最终答案）
```

**为什么需要 `onStepEnd`，而不是单独用 `onAfterLLMCall` + `onAfterToolCall`？**

`onAfterLLMCall` 只有 LLM 维度的数据（tokens），`onAfterToolCall` 只有单次工具维度的数据。`onStepEnd` 提供的 `StepSummary` 是这一步的**聚合视图**：本步多少次 LLM 调用、多少次工具调用、总耗时——这是"步骤"级别的指标，不应该在 `onAfterToolCall` 里手动累加计算。

**示例 A：TraceLoggerPlugin — 步骤摘要入库**

```typescript
class TraceLoggerPlugin implements AgentLifecycleHooks {
  async onStepEnd(ctx: StepContext, summary: StepSummary): Promise<void> {
    // 更新 AgentRunTrace 的 steps 数组
    await this.db.run(sql`
      UPDATE agent_run_traces
      SET steps = json_insert(steps, '$[#]', ${JSON.stringify(summary)})
      WHERE trace_id = ${ctx.traceId}
    `)

    // 慢步骤预警
    if (summary.durationMs > this.config.slowStepThresholdMs) {
      logger.warn({
        traceId: ctx.traceId,
        stepIndex: ctx.stepIndex,
        durationMs: summary.durationMs,
        toolCallCount: summary.toolCallCount
      }, 'Slow step detected')
    }
  }
}
```

**示例 B：CostTrackerPlugin — 实时 Token 成本统计**

```typescript
class CostTrackerPlugin implements AgentLifecycleHooks {
  private stepTokens = new Map<string, number>() // traceId → 累计 tokens

  async onStepEnd(ctx: StepContext, summary: StepSummary): Promise<void> {
    const prev = this.stepTokens.get(ctx.traceId) ?? 0
    const total = prev + summary.totalTokens
    this.stepTokens.set(ctx.traceId, total)

    // 超过预算时打印警告（不中断，因为 onStepEnd 是观察型）
    const budget = this.config.tokenBudgetPerRun
    if (total > budget * 0.8) {
      logger.warn({
        traceId: ctx.traceId,
        totalTokens: total,
        budget,
        percent: Math.round(total / budget * 100)
      }, 'Token budget 80% consumed')
    }
  }

  async onRunEnd(ctx: RunContext): Promise<void> {
    // 清理，防止内存泄漏
    this.stepTokens.delete(ctx.traceId)
  }
}
```

---

### 6.10 `onStreamChunk`

**类型**：观察型  
**触发时机**：流式模式下，LLM 每输出一个 chunk 时触发（**极高频率**，每秒可能触发数十次）  
**可用数据**：`RunContext` + `StreamChunk`  
**典型用途**：推送流式内容到 SSE/WebSocket、流式内容过滤预览

```
时序（流式模式）：
llm.stream() 开始
  [onStreamChunk] chunk 1 ← "我"
  [onStreamChunk] chunk 2 ← "来"
  [onStreamChunk] chunk 3 ← "分"
  ...（数十次到数百次）
  [onStreamChunk] chunk N ← [DONE]
llm.stream() 结束
```

> **⚠️ 性能警告**：`onStreamChunk` 的实现必须极其轻量，禁止在此进行任何 IO 操作（数据库写入、HTTP 请求）。如需处理流式数据，应缓冲到内存后在 `onRunEnd` 批量处理。

**示例：StreamForwarderPlugin — 推送到 SSE 连接**

```typescript
class StreamForwarderPlugin implements AgentLifecycleHooks {
  async onStreamChunk(ctx: RunContext, chunk: StreamChunk): Promise<void> {
    const connection = this.sseRegistry.get(ctx.sessionId)
    if (!connection) return

    // ✅ 纯内存操作：写入 SSE 连接的响应流
    connection.write(`data: ${JSON.stringify({
      type: chunk.type,       // 'text_delta' | 'tool_call_start' | 'tool_call_delta' | 'done'
      content: chunk.content,
      stepIndex: ctx.stepIndex
    })}\n\n`)
  }
}
```

---

### 6.11 `onProgressUpdate`

**类型**：观察型  
**触发时机**：ReAct 每步结束后，由推理核心触发（与 `onStepEnd` 几乎同时，但数据格式不同）  
**可用数据**：`RunContext` + `StepProgress`（进度百分比 + 当前动作描述）  
**典型用途**：任务系统进度更新、WebSocket 推送前端进度条

```
关系辨析：
onStepEnd       → 提供技术细节（tokens、工具调用次数、耗时）→ 供 Trace 系统消费
onProgressUpdate → 提供用户可见的进度信息 → 供任务系统/前端消费

二者同一时机触发，消费者不同，不合并。
```

**为什么需要专门的 `onProgressUpdate`，而不是复用 `onStepEnd`？**

`onStepEnd` 在工具调用全部完成后触发，但 LLM "思考"阶段（只有 LLM 调用，没有工具调用）期间，前端需要展示"正在思考..."的 loading 状态。如果只有 `onStepEnd`，纯思考步骤（无工具调用）和有工具调用的步骤的更新时机是不对称的。`onProgressUpdate` 在每步结束时**统一**触发，无论有没有工具调用。

**示例：TaskProgressPlugin — 写入任务进度 + WebSocket 推送**

```typescript
class TaskProgressPlugin implements AgentLifecycleHooks {
  async onProgressUpdate(ctx: RunContext, progress: StepProgress): Promise<void> {
    if (!ctx.taskId) return // 纯对话场景（无 taskId）跳过

    // 1. 更新数据库
    await this.taskStore.updateProgress(ctx.taskId, {
      percent: progress.percent,
      currentStep: progress.currentAction,
      updatedAt: Date.now()
    })

    // 2. 发布事件到 TaskEventBus，由 WebSocket 层订阅推送
    this.taskEventBus.emit('progress', {
      taskId: ctx.taskId,
      traceId: ctx.traceId,
      progress
    })
    // WebSocket 层：
    // taskEventBus.on('progress', (data) => wsConn.send(JSON.stringify(data)))
  }
}
```

---

## 7. 执行机制详解

### 7.1 观察型的异常隔离

```typescript
// HookRunner 内部实现
async observe(hookName, ...args) {
  await Promise.all(
    this.plugins
      .filter(p => p[hookName])
      .map(p =>
        (p[hookName](...args) as Promise<void>)
          // ✅ 每个插件独立捕获，互不影响
          .catch(err => logger.warn({ hookName, pluginName: p.constructor.name, err },
            'Observer hook error, ignored'))
      )
  )
}
```

**行为保证**：即使 `TraceLoggerPlugin` 的数据库写入失败，`TaskProgressPlugin` 的 WebSocket 推送仍然正常进行，推理循环不受影响。

### 7.2 变换型的串行 reduce

```typescript
async transform(hookName, initial, ctx, ...extraArgs) {
  let current = initial
  for (const plugin of this.plugins) {
    if (!plugin[hookName]) continue
    // ❌ 不捕获异常：变换型异常向上传播，中断推理
    const result = await plugin[hookName].call(plugin, ctx, current, ...extraArgs)
    if (result !== null && result !== undefined) {
      current = result
    }
    // result === null 时：透传，current 保持不变
  }
  return current
}
```

**注册顺序影响结果**：如果 Plugin A 和 Plugin B 都实现了 `onAfterLLMCall`，Plugin A 的输出是 Plugin B 的输入。因此**功能性变换（如内容生成）应该先注册，防御性变换（如安全过滤）应该后注册**。

```typescript
agent.use(new TraceLoggerPlugin())       // 先：只观察，不修改，顺序无关
agent.use(new ContextEnhancerPlugin())   // 中：增强内容
agent.use(new ContentFilterPlugin())     // 后：最终过滤，确保安全
```

### 7.3 拦截型的短路逻辑

```typescript
async guard(hookName, ctx, ...args) {
  for (const plugin of this.plugins) {
    if (!plugin[hookName]) continue
    const result = await plugin[hookName].call(plugin, ctx, ...args)
    // 首个非 continue 立即返回，后续插件不再执行
    if (result.action !== 'continue') {
      logger.info({ hookName, action: result.action, reason: result.reason },
        'Guard hook triggered')
      return result
    }
  }
  return { action: 'continue' }
}

// 推理核心收到 abort 的处理
const guard = await this.hooks.guard('onBeforeToolCall', ctx, toolName, input)
if (guard.action === 'abort') {
  throw new AbortError(guard.reason ?? `Tool call aborted by guard`)
  // AbortError 会被 try/catch 捕获 → 触发 onRunError
}
```

### 7.4 `onContextBuild` 的特殊聚合模式

`onContextBuild` 是唯一采用并发聚合（而非串行 reduce）的变换型 hook，因为各插件的贡献相互独立：

```typescript
async buildContext(ctx: StepContext): Promise<ContextAddition[]> {
  // 并发调用所有插件（性能更好，各插件贡献独立）
  const results = await Promise.all(
    this.plugins
      .filter(p => p.onContextBuild)
      .map(p =>
        p.onContextBuild!(ctx).catch(err => {
          // 单个插件失败不影响其他插件（按观察型处理）
          logger.warn({ err, pluginName: p.constructor.name }, 'ContextBuild plugin failed')
          return null
        })
      )
  )

  // 聚合所有非 null 贡献
  return results.filter(Boolean) as ContextAddition[]
}

// ContextBuilder 将聚合结果组装成最终 messages
function assembleMessages(base: Message[], additions: ContextAddition[]): Message[] {
  const systemAdditions = additions
    .map(a => a.systemPromptAddition)
    .filter(Boolean)
    .join('\n')

  const injectedMessages = additions.flatMap(a => a.messages ?? [])

  return [
    // System prompt：原始 + 所有插件的追加内容
    { role: 'system', content: base[0].content + '\n' + systemAdditions },
    // 注入的 messages（如 RAG 文档片段）
    ...injectedMessages,
    // 原始对话历史
    ...base.slice(1)
  ]
}
```

---

## 8. 内置插件清单

| 插件 | 类型实现 | 职责 | 所在层 |
|------|----------|------|--------|
| `ConversationHistoryPlugin` | `onRunStart`（加载）+ `onRunEnd`（持久化） | 对话历史的读写 | 第一层（记忆系统） |
| `LongTermMemoryPlugin` | `onContextBuild`（首步注入）+ `onRunEnd`（提炼） | 跨会话长期记忆 | 第一层（记忆系统） |
| `TraceLoggerPlugin` | `onRunStart/End/Error`（观察）+ `onAfterLLMCall`（观察）+ `onAfterToolCall`（观察）+ `onStepEnd`（观察） | 推理轨迹完整记录 | 第三层（可观测性） |
| `RagContributorPlugin` | `onContextBuild`（每步检索） | 知识库动态注入 | 第三层（知识库） |
| `TaskProgressPlugin` | `onProgressUpdate`（观察） | 任务进度写库 + WebSocket 推送 | 第三层（任务系统） |
| `StreamForwarderPlugin` | `onStreamChunk`（观察） | 流式内容推送到 SSE/WS | 第三层（服务层） |
| `ContentFilterPlugin` | `onBeforeLLMCall`（变换，注入安全规则）+ `onAfterLLMCall`（变换，清除危险 tool_call） | 内容安全 | 第三层（可选） |
| `ToolPermissionGuard` | `onBeforeToolCall`（拦截，权限检查） | 工具调用权限控制 | 第三层（安全） |
| `ResultSanitizerPlugin` | `onAfterToolCall`（变换，截断 + 脱敏） | 工具结果清洗 | 第三层（安全） |
| `CostTrackerPlugin` | `onStepEnd`（观察，Token 统计） | Token 成本追踪 | 第三层（可选） |

---

## 9. 如何编写一个插件

### 9.1 最简插件骨架

```typescript
import type { AgentLifecycleHooks, RunContext, StepContext, LLMResponse } from 'core/agent/lifecycle'

export class MyPlugin implements AgentLifecycleHooks {
  // 只实现你关心的 hook，其余方法不用定义（都是可选的）

  async onRunStart(ctx: RunContext): Promise<void> {
    // 观察型：做任何事，但不要修改数据
    console.log(`[MyPlugin] Run started: ${ctx.traceId}`)
  }

  async onAfterLLMCall(ctx: StepContext, response: LLMResponse): Promise<LLMResponse | null> {
    // 变换型：修改数据，或返回 null 透传
    return null
  }
}
```

### 9.2 注册插件

```typescript
// 创建 Agent 时注入（推荐：构造时确定插件集合）
const agent = new Agent({
  id: 'my-agent',
  systemPrompt: '你是一个助手',
  provider: llmProvider,
})

agent.use(new ConversationHistoryPlugin(db, contextManager))
agent.use(new TraceLoggerPlugin(db))
agent.use(new ContentFilterPlugin())
agent.use(new ToolPermissionGuard(permissionService))
```

### 9.3 插件间通信

插件之间**不应该直接调用**，通过共享依赖（如 `db`、`eventBus`）间接协作：

```typescript
// ✅ 正确：通过共享服务协作
class PluginA implements AgentLifecycleHooks {
  constructor(private eventBus: EventBus) {}
  async onAfterLLMCall(ctx, response) {
    this.eventBus.emit('llm_response', response)  // 发布事件
    return null
  }
}

class PluginB implements AgentLifecycleHooks {
  constructor(private eventBus: EventBus) {
    this.eventBus.on('llm_response', this.handle.bind(this))
  }
  private handle(response: LLMResponse) { /* ... */ }
}

// ❌ 错误：直接引用另一个插件实例
class PluginB implements AgentLifecycleHooks {
  constructor(private pluginA: PluginA) {}  // 插件间直接依赖，禁止
}
```

### 9.4 有状态插件的注意事项

插件实例通常随 Agent 实例存活，**必须按 `traceId` 隔离同一 Agent 的并发推理**：

```typescript
class CostTrackerPlugin implements AgentLifecycleHooks {
  // ✅ 以 traceId 为 key，支持多个并发 run()
  private runTokens = new Map<string, number>()

  async onStepEnd(ctx: StepContext, summary: StepSummary) {
    const prev = this.runTokens.get(ctx.traceId) ?? 0
    this.runTokens.set(ctx.traceId, prev + summary.totalTokens)
  }

  async onRunEnd(ctx: RunContext) {
    this.runTokens.delete(ctx.traceId)  // 清理，防止内存泄漏
  }

  async onRunError(ctx: RunContext) {
    this.runTokens.delete(ctx.traceId)  // 异常也要清理
  }
}
```

---

## 10. 设计决策与常见问题

### Q1：为什么 `onContextBuild` 用并发聚合而不是串行 reduce？

各插件的 context 贡献相互独立（记忆不依赖 RAG 的结果，RAG 也不依赖记忆的结果），可以并发执行。串行 reduce 意味着 Plugin B 等 Plugin A 完成才能开始，浪费时间。特殊情况（某插件需要基于其他插件的贡献）应该合并为一个插件，而不是依赖执行顺序。

### Q2：变换型 hook 的执行顺序如何保证？

按 `agent.use(plugin)` 的注册顺序串行执行。推荐注册规范：

```
1. 观察型（日志、监控）← 顺序无关，先注册没有代价
2. 数据增强型（RAG、记忆注入）
3. 安全防御型（内容过滤、权限检查）← 最后注册，确保在所有增强之后进行防御
```

### Q3：拦截型 abort 后，对话历史会怎样？

`abort` 触发 `AbortError`，走 `onRunError` 路径，`onRunEnd` **不会**触发。这意味着本次推理不会被写入 `ConversationHistory`（因为 `ConversationHistory` 在 `onRunEnd` 写入）。这是有意的：被拦截的推理不应该污染对话历史。

如果需要记录"被拒绝的请求"，在 `onRunError` 中根据 `error instanceof AbortError` 判断并单独记录。

### Q4：`onStreamChunk` 能修改流式内容吗？

不能，`onStreamChunk` 是纯观察型。原因：流式内容是实时推送给用户的，如果允许修改，要么延迟推送（先收集完再改），要么实时修改（极难保证语义正确）。如需对流式内容进行完整处理，在 `onRunEnd` 中处理 `result.content`（最终完整内容）。

### Q5：如何新增一个 Hook 点位？

两步操作，不影响任何现有插件：

```typescript
// Step 1：在接口里加可选方法
interface AgentLifecycleHooks {
  // ...现有方法...
  onNewHook?(ctx: StepContext, data: SomeData): Promise<void>  // 新增
}

// Step 2：在推理循环对应位置调用
// ReActLoop.ts
await this.hooks.observe('onNewHook', stepCtx, someData)

// 现有插件不实现 onNewHook → 自动跳过，零影响
```

---

*本文档由 CatPaw 生成，与 `AI_Agent_Backend_Tech_Plan.md` § 2.1.6 配套阅读*
