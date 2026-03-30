这个文档不适合用md预览。比较乱一共7次问题，可以直接ctrlF 搜索```n,n为数字，就是第n个问题



```ask1
@https://www.kimi.com/preview/19d3a446-ed62-861a-8000-0518a3ef9a8a 
我要模仿这个做一个项目，从技术角度来规划一下不同层级需要做的事情，写个文档。然后我review来修改
```
好的，我已经了解了这个项目的全貌。这是一个基于 **Electron + React + MCP 协议**的 AI Agent 桌面应用（类似 OpenHanako）。我来从技术角度规划不同层级的开发任务，写一份技术规划文档供您 Review。

文档已生成：`AI_Agent_Desktop_Tech_Plan.md`

---

## 文档结构概览

整份文档从 **5 个技术层级**自上而下规划了需要做的事情：

| 层级             | 主要职责                        | 核心模块                                     |
| ---------------- | ------------------------------- | -------------------------------------------- |
| **基础设施层**   | 原子能力，无业务逻辑            | LLM Client / 文件解析 / 向量数据库 / MCP SDK |
| **核心服务层**   | 独立后端进程，提供 HTTP/WS API  | Hono 服务 / 对话API / 知识库API / Agent API  |
| **Agent 引擎层** | 多 Agent 调度与记忆，核心差异化 | Orchestrator / 4种 Agent 角色 / 四级记忆系统 |
| **桌面应用层**   | Electron 特有能力 + 安全桥梁    | 主进程 / IPC 处理器 / Preload                |
| **UI 表现层**    | 纯渲染，原子设计                | 组件库 / 5个核心页面 / Zustand Store         |

另外还包含：
- **20 周渐进式路线图**（7 个 Phase，每 Phase 有明确验收标准）
- **工程规范**（命名、提交、分支）
- **质量保障**（测试策略、CI/CD、性能基准）
- **待决策事项清单**（需要和产品/团队对齐的 7 个关键问题）

您可以直接对文档进行 Review，告诉我哪些部分需要调整、补充或删除。



```ask2
1.好像没有写日志系统，我希望能有一个完善的日志系统，能够追踪到系统中各种消息，agent思考过程，每一步思考的结果，以及发送给agent的数据等等。
这个系统有利于我们发现问题并优化系统。
这个系统需要能够持久化，并且可以把日志输出到不同的地方，因为系统复杂之后，日志可能会很多，比如各种消息，到时候会更不好排查，我想的是不同职责的日志输出到不同的地方啥的，还有什么traceid串联起来（不知道需不需要），或者你有什么成熟的方案吗。
评估一下这个系统应该放在哪个阶段？当然他应该可能会跟着不同阶段的开发而一起开发，也可能是一开始就做好了，后面只是用就行了，只不过参数不通。

2.由于我们的核心部分很早就完成了，后续的模块的输出是会作为上下文发送给LLM的，这一点需要考虑一下是否能兼容。不过应该也还行，比如后面更新了某个主动读老记忆的功能，这个其实属于记忆模块，我们前期已经弄好了，不会再修改核心模块。不过也正是有这种可能我才希望能把核心做的更加可扩展。

3.会话隔离有吗，比如后期同一个agent可能又跟用户在对话又跟其他agent在对话。或者都不一定到后期，前期，一个agent用户也可以开不同的对话跟他对话。这个我没仔细看文档，但这个应该算基本功能，你应该已经写了

4.没有消息总线。当然，不知道有没有必要，其他很多agent项目都有。

5.类aop或者说洋葱模型或者说httpfilter机制，比如一条消息的整个阶段，从输入到输出，有固定hook，为后续插件开发打基础。


以上几个你仔细评估考虑一下，给出方案，先不急着改文档
```
我先读取现有的技术方案文档，然后仔细评估这几个问题。

好，两份文档都读完了。现在仔细分析你提的5个问题，逐一给出评估和方案。

---

## 问题1：日志系统

### 现状评估
文档在 `2.3.4 可观测性` 里只写了结构化日志的几个字段和 Prometheus 指标，根本没有设计一个完整的日志体系。你说的"追踪 agent 思考过程"、"每步思考结果"、"发送给 agent 的数据"这些属于 **Application-level Observability**，不是普通的请求日志。

### 日志分类设计（按职责输出到不同目的地）

这个问题可以用分层+分类的思路解决。日志天然分三类，不应混在一起：

```
┌─────────────────────────────────────────────────────────────┐
│  分类               │  内容                    │  输出目的地  │
├─────────────────────────────────────────────────────────────┤
│  系统日志            │  HTTP请求、启动/关闭、错误 │  stdout/文件 │
│  (System Log)       │  中间件、配置加载          │  (运维看)    │
├─────────────────────────────────────────────────────────────┤
│  会话日志            │  用户消息、AI回复          │  SQLite表    │
│  (Session Log)      │  发送给LLM的完整Prompt     │  (可查询)    │
├─────────────────────────────────────────────────────────────┤
│  推理轨迹日志        │  Thought/Action/Obs        │  专用存储    │
│  (Trace Log)        │  每步Token数、耗时          │  (调试核心)  │
│                     │  工具调用输入输出            │              │
└─────────────────────────────────────────────────────────────┘
```

### 技术方案

**日志库选型**：用 [pino](https://github.com/pinojs/pino)（Node.js 生态里性能最好的结构化日志库），配合 `pino-pretty` 开发时终端可读输出，生产写文件。

**多目的地输出** - pino 支持 transport 配置：
```typescript
// 不同类型的日志流向不同地方
const logger = pino({
  transport: {
    targets: [
      { target: 'pino-pretty', level: 'info' },      // 控制台
      { target: 'pino/file', options: { destination: './logs/system.log' } },  // 系统日志
    ]
  }
})

// Agent推理轨迹单独落SQLite（便于后续查询分析）
// 不用pino，直接写DB，因为它是结构化的查询对象，不是文本日志
```

**TraceId 串联**：值得做，而且不复杂。一次用户消息 → 触发 Agent 推理 → 多步工具调用，全程用一个 `traceId` 串联。用户发消息时生成（`nanoid()`），所有后续操作带上这个 id。好处是出问题时能一把捞出整个链路的所有日志。

**推理轨迹**的数据结构（这是最有价值的）：
```typescript
interface AgentRunTrace {
  traceId: string
  sessionId: string
  agentId: string
  startedAt: number
  steps: Array<{
    stepIndex: number
    type: 'llm_call' | 'tool_call' | 'tool_result' | 'final_answer'
    // llm_call: 发给LLM的完整messages（含system prompt）
    input: object     
    // 从LLM/工具拿到的返回
    output: object    
    tokensUsed?: number
    durationMs: number
    timestamp: number
  }>
  totalTokens: number
  totalDurationMs: number
  status: 'success' | 'error' | 'timeout'
  error?: string
}
```

这个落在 `agent_run_traces` 表里，提供 `GET /api/sessions/:id/traces` 接口就能在前端完整回放整个推理过程。

### 放在哪个阶段？

**建议：第一层开发期间就设计好接口，第三层服务化时完成完整实现。**

- **第一层（现在）**：定义 `AgentRunTrace` 数据结构，在推理核心里埋好 hook（回调），具体存哪里不管
- **第二层**：工具调用时补充 `tool_call` / `tool_result` 的 trace 步骤
- **第三层**：接入 pino、实现 SQLite 持久化、暴露查询 API

理由：第一层核心如果没有 hook，后面补非常痛苦（要改核心循环）。但真正的持久化是第三层的事，不用提前做，只要接口留好就行。

---

## 问题2：核心可扩展性（后续模块输出作为上下文注入）

### 问题本质
你描述的场景是：**将来某个新模块（比如主动读老记忆）的结果需要注入到 LLM 的上下文里**，但核心推理循环已经写死了，不好改。

### 现状
文档里 `2.1.4 Agent 推理核心` 写到了 `onToolCall` 回调，但对于"System Prompt 的动态扩充"和"消息列表的动态注入"没有设计扩展点。

### 方案：Context Builder 管道

在每次 LLM 调用之前，加一个 **Context Builder 阶段**，这个阶段是一个有序的管道，每个模块可以向其中注入内容：

```typescript
interface ContextContributor {
  // 模块名（日志用）
  name: string
  // 优先级，决定注入顺序
  priority: number
  // 向system prompt追加内容（可选）
  contributeSystemPrompt?(context: RunContext): Promise<string | null>
  // 向messages列表注入额外消息（可选）
  contributeMessages?(context: RunContext): Promise<Message[]>
}

// Agent 持有一个 contributors 列表
class Agent {
  private contributors: ContextContributor[] = []
  
  addContributor(c: ContextContributor) {
    this.contributors.push(c)
    this.contributors.sort((a, b) => a.priority - b.priority)
  }
  
  private async buildContext(runContext: RunContext): Promise<{ systemPrompt: string, messages: Message[] }> {
    // 收集所有模块的贡献
    const systemAdditions = await Promise.all(
      this.contributors.map(c => c.contributeSystemPrompt?.(runContext))
    )
    // ...组装
  }
}
```

这样，你后来加的"主动读老记忆模块"只需要实现 `ContextContributor` 接口，调用 `agent.addContributor(memoryContributor)` 即可，**核心推理循环完全不动**。

这个模式在各大 Agent 框架里都有对应概念（LangChain 里叫 Runnable / Chain，AutoGen 里叫 middleware）。本质是 **在推理前的 context 准备阶段预留扩展点**。

---

## 问题3：会话隔离

### 现状评估
文档在 `2.3.2 持久化层` 里有 `sessions` 表，`2.3.3` 里有会话 CRUD API，但没有明确说明隔离维度。

### 你的场景需求
- 同一个 agent，用户开多个对话 → 不同 sessionId，正交
- 同一个 agent，在与用户对话的同时，又被 scheduler 分配了子任务 → **这是隔离的核心挑战**

### 方案
`session` 需要多一个维度区分"人机对话"和"agent间对话"：

```typescript
// sessions 表补充字段
interface Session {
  id: string
  agentId: string
  // 新增
  sessionType: 'user_conversation' | 'agent_task'
  // 如果是agent_task，关联的taskId
  taskId?: string
  // 发起方（userId或agentId）
  initiatorId: string
  // ...原有字段
}
```

每个 session 有自己独立的 `contextManager` 实例，互相不共享消息历史。agent 的**长期记忆**是共享的（跨 session 的），但**工作记忆和对话历史**是严格隔离的。

这个其实文档已经暗含了（有 session 概念），只是没有明确写 session type 的区分。属于细节设计，但确实需要补充。

---

## 问题4：消息总线

### 有没有必要？

结论：**第四层（多 Agent 协作）必要，第一~三层不需要**。

文档里 `2.4.3 Agent 间通信协议` 已经写了 `InMemoryMessageBus`，这是对的。但值得思考的是**为什么很多 Agent 项目都有消息总线**：

消息总线解决的核心问题是**解耦**——发送方不需要知道接收方在哪，甚至不需要接收方此刻存在。在以下场景它就有价值：

1. **Agent A 完成任务，异步通知 Agent B 继续**：不用 A 直接调 B，通过 bus 发布事件
2. **一个事件多个订阅者**：比如 Agent 执行完一步，日志系统、进度追踪、前端 WebSocket 都要知道
3. **调试工具**：可以 tap 进 bus 观察所有消息流动

现在文档里 `InMemoryMessageBus` 方向是对的，但有一点要补充：**消息总线和同步调用要共存**。子任务的结果回传、简单的工具调用，用同步调用就够了；跨 Agent 的异步协调才走消息总线。不要把所有通信都强制走 bus，过度设计。

---

## 问题5：AOP / 洋葱模型 / Message Pipeline

### 这个很值得做，而且与问题2的 Context Builder 是配套设计

一条消息的完整生命周期：

```
用户输入
  ↓
[InputMiddleware]    → 输入校验、敏感词过滤、内容预处理
  ↓
[ContextBuildMiddleware] → 注入记忆、RAG召回结果（问题2的方案）
  ↓
[LLM推理]
  ↓
[OutputMiddleware]   → 格式化输出、内容审查、token统计
  ↓
[LoggingMiddleware]  → 记录trace（问题1的方案）
  ↓
最终响应
```

这就是洋葱模型，和 Koa/Express 中间件完全一个概念。实现上：

```typescript
type MessageMiddleware = (
  ctx: MessageContext,
  next: () => Promise<void>
) => Promise<void>

class MessagePipeline {
  private middlewares: MessageMiddleware[] = []
  
  use(mw: MessageMiddleware) { 
    this.middlewares.push(mw)
    return this  // 链式调用
  }
  
  async execute(ctx: MessageContext) {
    // 洋葱执行
    const dispatch = (i: number) => {
      const mw = this.middlewares[i]
      if (!mw) return Promise.resolve()
      return mw(ctx, () => dispatch(i + 1))
    }
    return dispatch(0)
  }
}
```

这个放在**第一层推理核心里**，但初期可以只有一个 `DefaultMiddleware`（直接 pass through），后续每个功能模块以 middleware 形式插入，完全不动核心。

---

## 综合建议：这几个方案的内在关联

这5个问题不是独立的，它们互相关联：

```
消息总线（问题4）
    ↑
洋葱中间件（问题5）
    ↑ 使用
日志中间件     Context Build中间件
（问题1）         （问题2）
    ↑
TraceId（问题1）──串联──→ 会话隔离（问题3）
```

所以**核心架构要在第一层就设计进去的**是：
1. `MessagePipeline`（洋葱中间件框架）- 只需要 pipeline 骨架，不需要写具体中间件
2. `TraceId` 生成与传播
3. `AgentRunTrace` 数据结构和 hook 接口

这三件事加起来代码量不多（可能 300-400 行），但给后面所有层提供了扩展基础。真正的实现（日志持久化、记忆注入、消息总线）按层推进就行。

具体改文档的话，主要是：
- 在**第一层**新增 `MessagePipeline` 和 `AgentRunTrace hook` 两个子模块
- 在**第三层可观测性**大幅扩充日志系统设计
- **第四层**消息总线明确适用边界（同步 vs 异步）
- **会话表**补充 `session_type` 字段

你看这个分析方向是否对路？如果确认了，再来改文档。



```ask3
你在问题5中提到的一条消息的完整生命周期，如果后面还有要增加的点位咋办，如果目前设计不全面后面好扩展吗
```
这是个很好的问题，核心矛盾是：**中间件的顺序和点位是固定的吗？**

---

## 现在那个方案的问题

我之前画的生命周期是线性的：

```
输入 → [中间件1] → [中间件2] → [LLM推理] → [中间件3] → 输出
```

这个设计有个隐含假设：**所有中间件都处理同一种东西（消息上下文）**。但 Agent 推理实际上是一个有内部结构的循环，不是一次线性过过去就完了：

```
用户输入
  ↓
[ReAct 循环开始]
  ├── 第N步：调用LLM
  │     ↓
  │   LLM返回：工具调用？
  │     ├── 是 → 执行工具 → 结果追加上下文 → 下一步
  │     └── 否 → 最终回答 → 退出循环
[ReAct 循环结束]
  ↓
输出
```

**这意味着真正需要 hook 的点位远不止"输入前"和"输出后"，而是分布在循环内部：**

```
- 整个任务开始前 / 结束后
- 每一步 LLM 调用前 / 调用后
- 工具调用前 / 调用后（每次工具）
- 最终回答产生前
```

如果用单一的线性 pipeline，就没法 hook 到"第3步的工具调用前"这个位置。

---

## 更好的方案：生命周期 Hook 系统

不用洋葱模型，改用**声明式的 Hook 点位系统**。参考 Rollup/Webpack 插件机制、Fastify 的生命周期钩子：

```typescript
// 定义所有可 hook 的时机
interface AgentLifecycleHooks {
  // 任务级别
  onRunStart?(ctx: RunContext): Promise<void>
  onRunEnd?(ctx: RunContext, result: AgentResult): Promise<void>
  onRunError?(ctx: RunContext, error: Error): Promise<void>

  // LLM 调用级别（每步都触发）
  onBeforeLLMCall?(ctx: StepContext, messages: Message[]): Promise<Message[]>  // 可修改入参
  onAfterLLMCall?(ctx: StepContext, response: LLMResponse): Promise<LLMResponse>  // 可修改出参

  // 工具调用级别
  onBeforeToolCall?(ctx: StepContext, toolName: string, input: unknown): Promise<unknown>
  onAfterToolCall?(ctx: StepContext, toolName: string, result: ToolResult): Promise<ToolResult>

  // 流式输出级别
  onStreamChunk?(ctx: RunContext, chunk: StreamChunk): Promise<StreamChunk>

  // 上下文构建（问题2的 ContextContributor 其实就是这个hook的一种）
  onContextBuild?(ctx: RunContext): Promise<ContextAddition>
}
```

插件只需要实现自己关心的 hook，不关心的不写：

```typescript
// 日志插件 - 只关心整体开始/结束和每次LLM调用
const loggingPlugin: AgentLifecycleHooks = {
  async onRunStart(ctx) {
    logger.info({ traceId: ctx.traceId }, 'agent run started')
  },
  async onAfterLLMCall(ctx, response) {
    logger.debug({ step: ctx.stepIndex, tokens: response.usage }, 'llm call done')
    return response  // 透传不修改
  },
  async onRunEnd(ctx, result) {
    logger.info({ traceId: ctx.traceId, duration: result.durationMs }, 'agent run ended')
  }
}

// 记忆注入插件 - 只关心上下文构建时机
const memoryPlugin: AgentLifecycleHooks = {
  async onContextBuild(ctx) {
    const memories = await memoryStore.search(ctx.userInput)
    return { systemPromptAddition: formatMemories(memories) }
  }
}

// 敏感词过滤插件 - 只关心LLM调用前
const contentFilterPlugin: AgentLifecycleHooks = {
  async onBeforeLLMCall(ctx, messages) {
    return messages.map(m => ({ ...m, content: filter(m.content) }))
  }
}
```

---

## 扩展性如何保证？

**后面新增 hook 点位，只需要两步：**

**第1步**：在 `AgentLifecycleHooks` 接口上加一个新方法（可选的，用 `?`）
```typescript
interface AgentLifecycleHooks {
  // ... 原有的
  onBeforeMemoryWrite?(ctx: StepContext, entry: MemoryEntry): Promise<MemoryEntry>  // 新加
}
```

**第2步**：在推理核心里调用这个 hook
```typescript
// core/agent 推理循环里
let entry = buildMemoryEntry(...)
entry = await this.runHook('onBeforeMemoryWrite', stepCtx, entry) ?? entry
await memoryStore.write(entry)
```

**现有插件完全不受影响**，因为 `onBeforeMemoryWrite` 是可选的，没实现的插件自动跳过。

---

## 与洋葱模型的关键区别

|          | 洋葱模型（Koa 风格）   | Hook 系统（Rollup 风格） |
| -------- | ---------------------- | ------------------------ |
| 适合场景 | 请求/响应的线性流      | 有内部循环的复杂生命周期 |
| 扩展点   | 只有"进入前"和"返回后" | 任意内部节点都可 hook    |
| 新增点位 | 要改中间件链的结构     | 加个接口方法 + 一行调用  |
| 插件实现 | 必须调用 `next()`      | 只实现关心的方法         |
| 执行顺序 | 注册顺序（栈）         | 每个 hook 独立排序       |

对于 HTTP 服务（Hono 的路由中间件那层），继续用洋葱模型没问题。但 **Agent 推理核心内部应该用 Hook 系统**，两者互补，不是非此即彼。

---

## 一个容易踩的坑

Hook 系统要注意区分两类 hook：

```typescript
// 类型1：纯观察，不能修改数据（void返回）
onRunStart?(ctx: RunContext): Promise<void>

// 类型2：可以变换数据（返回新值，null/undefined = 不修改）
onBeforeLLMCall?(ctx: StepContext, messages: Message[]): Promise<Message[] | null>
```

**变换型 hook 的多个插件叠加时**，用 reduce 串行执行（顺序敏感）：
```typescript
// 多个插件都实现了 onBeforeLLMCall，按注册顺序依次变换
let messages = originalMessages
for (const plugin of this.plugins) {
  if (plugin.onBeforeLLMCall) {
    messages = await plugin.onBeforeLLMCall(stepCtx, messages) ?? messages
  }
}
```

**观察型 hook** 可以并发执行（`Promise.all`），因为不改数据，顺序无所谓。

这个区分如果一开始没想清楚，后面 hook 越来越多时会很乱，建议从第一层就在接口层面用返回类型区分开。


```ask4
还有个问题，目前系统有设计各种任务吗，比如什么定时任务之类的，这种系统还能看见任务的各种状态、进度。
哦对，这也是个很好的考虑我们前两次对话的点，如果我们目前没有设计任务系统，现在要加进去，之前的设计好扩展吗？
```
先看清楚现有文档里任务相关的设计。

现在有清楚的全貌了，来认真分析。

---

## 现状：有任务设计，但只有一种任务，且放错了层

现有文档里"任务"出现在**第四层（多 Agent 协作层）**，是专指"用户发布一个目标，AgentScheduler 分解成多个子任务分配给多个 Agent 执行"这一种场景。

但实际上系统中存在多种任务，文档里完全没有统一抽象：

| 任务类型                       | 现在在哪里                          | 有没有统一管理                   |
| ------------------------------ | ----------------------------------- | -------------------------------- |
| 多 Agent 协作任务              | 第四层 `core/task`                  | 有，但只有这一种                 |
| 单次 Agent 推理（ReAct 循环）  | 第一层 `core/agent`，叫"执行"       | 没有作为任务管理                 |
| 知识库导入（解析+分块+向量化） | 第三层 `POST /api/knowledge/import` | 没有，接口直接返回，没有异步任务 |
| 定时任务                       | **完全没有**                        | 完全没有                         |
| 代码沙箱执行                   | 第三层 `server/sandbox`             | 没有，是同步调用                 |

**所以问题不只是"没有定时任务"，而是"系统里有多种异步过程，但只有多 Agent 协作这一种被抽象成了任务"**。

---

## 现有设计扩展性评估

回到你的核心问题：**如果现在加一个统一任务系统，之前的设计好扩展吗？**

分三个角度看：

### ✅ 好的地方

**第四层的任务模型数据结构设计是对的**，`Task` / `SubTask` / 状态机 / WebSocket 推送这套思路可以复用，不用推翻。

**第三层的服务化框架（Hono）** 加路由很容易，任务相关 API 直接补充进去。

### ⚠️ 需要调整但不算破坏性的地方

**第一层推理核心没有"任务感知"**。现在 Agent 的推理循环是一个直接执行的函数调用，没有 `taskId`、没有进度上报、没有暂停/恢复接口。如果要让任务系统能管控 Agent 推理，需要在推理核心里加 hook（但如果上一个问题的 **Hook 系统**已经做了，这里就是加一个 `onProgressUpdate` hook，成本很低）。

**第三层知识库导入是同步接口**。现在设计的是 `POST /api/knowledge/import` 直接返回结果，但导入大文件可能要几分钟，这应该是异步任务。这里需要改 API 语义，不算破坏性修改，但要改。

### ❌ 麻烦的地方

**定时任务完全没有载体**。定时任务需要一个持久化的调度器（记录"每天 9 点执行 XX"），不是临时起意跑一次的任务。这不是加几个字段能解决的，需要新增一个调度模块。但因为目前代码还没写，加到第三层或第四层都可以，不存在"改已有代码"的问题。

---

## 真正应该做的：统一任务基础设施

思路是把"任务"从第四层提前到**第三层**，作为通用基础设施，所有需要异步执行的操作都走这套机制：

```
┌──────────────────────────────────────────────────────────────┐
│  任务类型（都是 Task 的子类型）                                │
│                                                              │
│  AgentRunTask      ← 单次 Agent 推理（原来叫"执行"）          │
│  MultiAgentTask    ← 多 Agent 协作（原第四层的 Task）         │
│  KnowledgeImportTask ← 知识库导入                            │
│  ScheduledTask     ← 定时触发的任意任务                      │
│  SandboxRunTask    ← 代码沙箱执行（可选，看需不需要追踪）     │
└──────────────────────────────────────────────────────────────┘
         ↓ 所有任务共享
┌──────────────────────────────────────────────────────────────┐
│  通用任务基础设施（新增到第三层）                               │
│                                                              │
│  TaskRunner        ← 执行器，管理并发、排队                   │
│  TaskStore         ← 持久化（tasks 表）                      │
│  TaskEventBus      ← 状态变更事件（对接 WebSocket 推送）      │
│  TaskScheduler     ← 定时调度（cron 表达式）                  │
└──────────────────────────────────────────────────────────────┘
```

### 核心数据结构

```typescript
// 所有任务的公共基础
interface BaseTask {
  id: string
  type: TaskType           // 任务类型枚举
  status: TaskStatus       // PENDING | RUNNING | PAUSED | SUCCEEDED | FAILED | CANCELLED
  progress: TaskProgress   // { current: number, total: number, message: string }
  createdAt: number
  startedAt?: number
  endedAt?: number
  error?: string
  // 谁触发的（userId、agentId、scheduler）
  triggeredBy: string
}

interface TaskProgress {
  percent: number          // 0-100
  currentStep: string      // 当前在做什么（人类可读）
  steps?: Array<{          // 可选：细粒度步骤列表
    name: string
    status: 'pending' | 'running' | 'done' | 'failed'
  }>
}

// 定时任务额外字段
interface ScheduledTaskConfig {
  cronExpression: string   // "0 9 * * *" = 每天9点
  taskTemplate: TaskPayload // 触发时创建的任务配置
  enabled: boolean
  lastRunAt?: number
  nextRunAt?: number
}
```

### 定时任务选型

不需要引入复杂的 Redis + Bull 那套，桌面应用场景用 **`node-cron`** 就够了：

```typescript
// 轻量，纯内存，支持标准 cron 表达式
import cron from 'node-cron'

class TaskScheduler {
  schedule(config: ScheduledTaskConfig) {
    cron.schedule(config.cronExpression, async () => {
      await taskRunner.submit({
        type: 'scheduled',
        triggeredBy: 'scheduler',
        payload: config.taskTemplate
      })
    })
  }
}
```

定时任务的配置持久化到 SQLite，应用重启后从 DB 里恢复所有 cron job。

---

## 与之前设计的衔接

回顾上两次讨论，任务系统跟它们的关系是：

**与 Hook 系统（问题5）的关系：**
Agent 推理核心通过 `onProgressUpdate` hook 向上报告进度，TaskRunner 注册这个 hook，把进度写到 `tasks` 表，前端通过 WebSocket 拿到实时进度。核心完全不感知 TaskRunner 的存在。

```
Agent推理核心
  → onProgressUpdate hook 触发
    → TaskRunner 的 hook 实现：更新 tasks 表 progress 字段
      → TaskEventBus 发布 task:progress 事件
        → WebSocket 推送到前端
```

**与日志系统（问题1）的关系：**
每个任务有 `taskId`，和 `traceId` 一起作为日志的关联键。一个任务可能对应多个 traceId（比如多 Agent 任务里每个子 Agent 有自己的 traceId），但都关联到同一个 `taskId`。

```
taskId: task_abc
  ├── traceId: trace_001  (SubAgent-1 的推理轨迹)
  ├── traceId: trace_002  (SubAgent-2 的推理轨迹)
  └── traceId: trace_003  (SubAgent-3 的推理轨迹)
```

**与会话隔离（问题3）的关系：**
`user_conversation` 类型的 session 里的 Agent 推理，是否要生成一个 `AgentRunTask`？

建议是：**生成，但轻量化**。这样用户能在任务中心看到"我跟 xxx Agent 的所有对话里，每次 AI 回复对应的执行记录"，用于排查"为什么这次回复很慢"或"为什么这次结果不对"。不生成的话，这个链路就断了，出问题只能靠日志，不够直观。

---

## 分层归属建议

| 新增内容                                               | 放在哪层                     | 理由                                  |
| ------------------------------------------------------ | ---------------------------- | ------------------------------------- |
| `BaseTask` 数据结构 + `TaskStatus`/`TaskProgress` 接口 | **第三层**                   | 这是服务化的工程能力，不是 Agent 逻辑 |
| `TaskRunner`（执行与并发管理）                         | **第三层**                   | 同上                                  |
| `TaskStore`（SQLite 持久化）                           | **第三层**                   | 复用持久化层                          |
| `TaskScheduler`（cron）                                | **第三层**                   | 同上                                  |
| `TaskEventBus`（状态变更事件）                         | **第三层**                   | 与 WebSocket 推送同层                 |
| 多 Agent 协作任务的调度逻辑                            | **第四层**（原位不变）       | 这是业务逻辑，复用第三层的基础设施    |
| `AgentRunTask` 的进度上报                              | **第一层通过 hook 暴露接口** | 核心不感知任务系统，只 emit hook      |

**原来第四层的 `core/task` 模块要往下挪一层（到第三层）**，这是唯一需要调整层次的地方，但因为还没写代码，现在调整零成本。


```ask5
好的，根据以上讨论更新文档。
另外我还想问一下，目前LLM只会被动接受输入，即使是主动问候用户，也只是某些定时任务来触发，这个点我们是不是暂时没法解决

(ai表示确实没有主动对话，都是某种条件触发)
```
先更新文档，同时回答你的问题。

好，现在开始更新文档，把四次讨论的所有内容整合进去。改动比较大，涉及多处，我来逐块处理。

现在更新第一层，补充 Hook 系统和会话隔离。

现在在记忆系统之后插入两个新小节：生命周期 Hook 系统和会话隔离。

现在更新第三层：先更新持久化表结构，再大幅扩充可观测性/日志章节，然后新增统一任务基础设施章节，并重新编排章节序号。

现在替换旧的可观测性章节，扩充为完整的日志系统设计：

现在在代码执行沙箱章节之前插入新的"统一任务基础设施"章节，并更新后续章节编号：

现在更新剩余章节编号（2.3.6→向量存储改为2.3.7，2.3.7→安全配置改为2.3.8）：

现在更新第四层，移除已下移到第三层的任务基础模型，补充消息总线适用边界说明：

现在更新消息总线章节，补充适用边界说明：

现在更新第四层的 API 扩展章节，移除已下移到第三层的任务 API，只保留多 Agent 专有 API：

最后更新目录结构图，增加新模块：

文档更新完毕。现在回答你关于 LLM 主动性的问题。

---

## 关于"LLM 主动问候用户"的问题

你说的很准确：**LLM 本质上是被动的**，它是一个无状态的函数——有输入才有输出，没有输入什么都不做。这是 LLM 的架构本质，不是我们系统设计的缺陷。

那"主动问候"怎么实现？**确实只能靠外部触发**，本质都是"有东西触发了一次对 LLM 的调用，然后把结果推送给用户"。路径有几种：

| 触发方式         | 举例                          | 实现途径                                                     |
| ---------------- | ----------------------------- | ------------------------------------------------------------ |
| **定时任务触发** | 每天早上8点说早安             | cron job → 创建 AgentRunTask → LLM 生成问候 → WebSocket 推送 |
| **事件触发**     | 用户3天没来，触发一条关心消息 | 监听 `session.lastActiveAt` 字段，超时触发任务               |
| **条件触发**     | 检测到用户刚完成某事          | 其他模块写事件到消息总线，订阅方触发 Agent 回复              |

这三种触发方式，我们刚更新的文档里的 **`TaskScheduler`（定时任务）和 `TaskEventBus`（事件总线）** 已经是基础设施了，完全可以承载这些场景。

**所以结论是：**
- 不存在"暂时无法解决"的问题
- 只是"LLM 主动"这个说法是个幻觉，底层永远是"系统触发了一次 LLM 调用"
- 我们的定时任务 + 事件总线已经覆盖了所有需要"主动"的场景
- 真正要开发的是各种触发条件的**监控逻辑**（比如检测用户不活跃的逻辑），而不是 LLM 本身


```ask6
目前的架构是否支持（或者后期方便扩展）自定义agent性格、职能，以及agent自行沉淀一些经验之类的，比如大后期，不同agent需要做事情的时候，可以了解到哪些agent擅长哪些事情，就把事情委派给他，或者说可以直接从大家一起沉淀的知识库找到解决方案。目前的各项能力能否实现这些功能，也许他并不需要单独再做什么技术上的模块就已经能满足了？
```
这是个很好的问题，让我先看一下当前文档的完整内容，再做系统性评估。

文档读完了，现在可以做一个非常深入的评估了。

---

## 对你问题的系统性评估

你的问题拆解成三个子问题：
1. **自定义 Agent 性格和职能** — 现在支持吗？
2. **Agent 自行沉淀经验** — 有没有机制？
3. **大后期 Agent 相互感知、智能委派，以及共享知识库** — 需要额外模块吗？

---

### 子问题一：自定义性格与职能

**结论：完全已覆盖，不需要任何新模块。**

目前架构中天然支持这两件事：

**性格** → 由 `systemPrompt` 控制。Agent 基类就有这个字段：

```128:128:AI_Agent_Backend_Tech_Plan.md
- [ ] 定义 `Agent` 基类：`{ id, name, systemPrompt, provider, contextManager, plugins: AgentLifecycleHooks[] }`
```

你想让某个 Agent"严谨学术风"还是"活泼助手风"，写在 `systemPrompt` 里就行，而且第五层还有 **Prompt 自进化（2.5.3）** 和 **版本管理**，可以对性格描述做 A/B 实验、回滚、动态优化。

**职能** → 由 **Skill 绑定** 决定：

```330:330:AI_Agent_Backend_Tech_Plan.md
- [ ] Skill 与 Agent 的绑定：`agent.useSkill(skill)` 将 Skill 的工具注入 Agent 可用工具列表
```

不同职能的 Agent 绑定不同的 Skill 组合，已有四个垂直 Agent 定义（代码助手、研究员、数据分析、写作助手），可以随意扩展。

---

### 子问题二：Agent 自行沉淀经验

**结论：基础设施已在，但"自动沉淀"这个闭环还差一环连接。**

目前有的：
- **长期记忆系统（2.1.5）**：`memory_entries` 表按 `agent_id` 跨 session 共享，是经验的储存容器
- **自我反思机制（2.5.2）**：任务完成后，Agent 对自身执行轨迹打分、找瓶颈
- **推理轨迹持久化（2.3.4）**：每次 `agent_run_traces` 都有完整的 Thought/Action/Observation

**目前缺的一环**：反思产出的 `improvementSuggestions` 自动写回长期记忆的连接器。

现在的设计里，`ReflectionModule` 输出 `ReflectionResult`，但没有明确说"谁来把反思结论提炼成一条 `memory_entry` 写进数据库"。这需要在第五层加一个很轻量的连接逻辑，不需要新模块，就是一个函数调用：

```
ReflectionModule.onReflectionComplete
  → 提炼出 "这次任务的关键经验"
  → 调用 MemoryStore.set(agentId, experienceEntry)
```

可以用 `onRunEnd` Hook 挂载一个 `ExperienceAccumulatorPlugin`，写入长期记忆。整个机制已经具备，只差这个"胶水"逻辑。

---

### 子问题三：Agent 相互感知与智能委派

**结论：框架支持，但有一个目前还没有设计的概念——"Agent 能力注册表"。**

你描述的场景是：AgentScheduler 要把事情委派给"最擅长"的 Agent，而不是随机分配。这需要两件事：

**① 当前已有：AgentScheduler 知道 Agent 清单**

```680:681:AI_Agent_Backend_Tech_Plan.md
- [ ] **Supervisor 模式**：Root Agent（LLM 驱动）分析目标，输出子任务列表和 Agent 分配方案
  - System Prompt 包含可用 Agent 清单及其能力描述
```

现在是"可用 Agent 清单及其能力描述"，但这个**描述是静态的**（人工写死在 Prompt 里），不会随着 Agent 积累的经验动态更新。

**② 目前缺少：动态能力画像（Agent Capability Profile）**

"大后期 Agent 擅长什么"这个信息应该随运行时数据动态积累，而不是靠人工维护。目前架构里没有这个东西。

这并不需要一个复杂的新模块，可以作为**现有 `agents` 表的扩展字段**来实现：在 `agents` 表加一个 `capability_profile` JSON 字段，随着每次 `ReflectionModule` 产出更新：

```
capability_profile = {
  strengths: ["代码重构", "Python调试", "算法分析"],  // 从高分反思中提炼
  weaknesses: ["前端CSS", "数据库优化"],            // 从低分反思中提炼
  successRate: { "代码任务": 0.92, "写作任务": 0.61 },
  avgTokensPerTask: 3200,
  lastUpdated: timestamp
}
```

AgentScheduler 的 Planner Agent System Prompt 就从这里动态读取，而不是人工写死能力描述。

---

**④ 共享知识库**

```713:720:AI_Agent_Backend_Tech_Plan.md
#### 2.4.4 共享记忆与任务上下文（`core/shared-memory`）

- [ ] `TaskContext`：任务执行期间所有 Agent 共享的键值空间
- [ ] 跨 Agent 长期记忆共享策略：
  - Agent 执行完成后，将关键结论写入长期记忆
  - 其他 Agent 在执行前检索相关记忆注入上下文
```

框架里已经有了。不同 Agent 往共同知识库（`memory_entries` 按 `agent_id` 分桶，但可以有一个全局 `shared` agent_id）写入，其他 Agent 通过 `RagContributorPlugin` 在 `onContextBuild` 阶段检索注入。整个链路已经打通了。

---

### 综合总结

| 需求               | 现有支持                           | 缺口                          | 补充方式                                                      |
| ------------------ | ---------------------------------- | ----------------------------- | ------------------------------------------------------------- |
| 自定义性格         | ✅ `systemPrompt` + Prompt 版本管理 | 无                            | 直接用                                                        |
| 自定义职能         | ✅ Skill 绑定 + 垂直 Agent 定义     | 无                            | 直接用                                                        |
| Agent 沉淀个人经验 | ⚠️ 存储容器有，闭环缺一环           | 反思结论→长期记忆的写入逻辑   | 在 2.5.2 加 `ExperienceAccumulatorPlugin`，挂 `onRunEnd` hook |
| Agent 相互感知能力 | ⚠️ 静态清单有，动态画像没有         | `capability_profile` 动态更新 | 在 `agents` 表加字段，由反思模块写入                          |
| 智能委派           | ⚠️ 依赖动态画像                     | 同上                          | Planner System Prompt 动态读取 profile                        |
| 共享知识库沉淀     | ✅ `shared-memory` + RAG 链路已有   | 无                            | 直接用                                                        |

**整体结论**：不需要增加任何新的顶层模块，现有分层已经把基础设施都建好了。缺失的两块（经验自动写回、Agent 动态能力画像）都是**在现有模块内增加逻辑的问题**，属于第五层的实现细节，可以在真正开发第五层时补充。架构的可扩展性完全支撑这些需求。

```ask7
关于AgentScheduler我有个问题，后面我能不能既可以跟调度者对话又可以跟各个其他agent对话？
就像开公司一样，或者说聊天软件一样。另外我还可以新创建agent，自定义各项指标，指定他可以用哪些skill、mcp、插件开关之类的
```
这个问题非常好，触及了 Agent 系统的**交互范式**设计。让我结合当前架构做一个完整评估。

---

## 问题一：既能与 AgentScheduler 对话，也能直接找具体 Agent

**现有架构的理解**

目前 AgentScheduler 是一个**调度引擎**，它接收任务目标、分解、分配、监控——但它本身不是一个"聊天对象"，它是程序逻辑。

你描述的场景是：
- 和"总调度"说"帮我分析一下这个项目"，它负责拆解并分配
- 也可以直接找"代码助手"单独聊"帮我看一下这个函数"
- 就像公司里：可以找老板派活，也可以直接跟某个同事聊

**当前架构评估**

这个能力**基础设施已完全具备**，但缺少一个统一的**"收件箱"路由层**来承接"你在和谁聊"这件事。

核心问题是：
- 创建 Session 时需要指定 `agentId`（见 2.3.3 `POST /api/sessions`）
- 但现在没有一个机制表达"和 AgentScheduler 本身对话"——它目前只是被调用，不能接收对话

解决方案非常轻量：**把 AgentScheduler 本身也实例化为一个 Agent**（一个特殊的 `SupervisorAgent`），它有自己的 `agentId`，可以和它开 Session，它内部的推理逻辑会判断是要直接回答你，还是拆解成子任务分配出去。

这完全符合现有 `Agent` 基类的扩展方式，不需要新模块。

---

## 问题二：动态创建 Agent，自定义各项指标

**当前已有**

```400:403:AI_Agent_Backend_Tech_Plan.md
- [ ] `POST /api/agents`：动态创建 Agent（指定 Provider / Prompt / Skill 组合）
- [ ] `PUT /api/agents/:id`：更新 Agent 配置
```

框架里已经有动态创建 Agent 的 API，但设计得比较粗糙，只提到了"Provider / Prompt / Skill 组合"，没有展开你说的这些细粒度配置。

**你描述的完整 Agent 配置清单**需要系统化整理进文档，否则实现时会遗漏。我把两个问题的方案都更新进文档里。

好，现在清楚了，直接更新文档，把两个问题的设计都补进去。

更新完成。现在把评估结论整理清楚：

---

## 评估结论

### 问题一：既能和 Supervisor 聊，又能和各个 Agent 直聊

**现在完全支持，不需要新模块，只需要一个设计决策的明确化。**

关键思路：**把 SupervisorAgent 本身也实例化成一个 `Agent`**（`role: 'supervisor'`），而不是让 AgentScheduler 作为一个纯程序入口。

交互模式就像文档里画的图：

```
用户
├─ 直接找"代码助手"聊  → 单独 Session，一对一
├─ 直接找"研究员"聊    → 单独 Session，一对一  
└─ 找 Supervisor 聊   → Supervisor 自己判断：
     简单问题 → 直接回答
     复杂任务 → 拆解 → 分配给多个 Agent 并行跑
```

底层 Session 隔离机制已经完全支撑这种模式——无论用户同时开多少个对话窗口，每个 Session 的上下文都是独立的。SupervisorAgent 发出的子任务会创建 `sessionType='agent_task'` 的内部 Session，不会混进用户的对话列表。

---

### 问题二：动态创建 Agent，自定义各项指标

文档里原来只有一行 `POST /api/agents`，描述太粗糙。现在补充了完整的 `AgentConfig` 结构，你想调整的所有东西都在里面：

| 配置维度 | 字段                                                 | 说明                                           |
| -------- | ---------------------------------------------------- | ---------------------------------------------- |
| 基础身份 | `name` / `avatar` / `description`                    | 名字、头像、对外能力描述                       |
| 性格职能 | `systemPrompt` / `role`                              | 核心人设，`role` 区分通用/专项/调度            |
| LLM 选型 | `provider` / `model` / `temperature` / `maxTokens`   | 选哪个模型、回答风格随机性、长度               |
| 能力开关 | `skills` / `mcpServers` / `plugins`                  | Skill 清单、连接哪些 MCP 工具、哪些插件开启    |
| 记忆行为 | `memoryEnabled` / `ragEnabled` / `ragKnowledgeBases` | 是否记住历史、是否检索知识库、可访问哪些知识库 |
| 运行控制 | `enabled` / `isBuiltIn`                              | 对外开关、内置 Agent 防删除                    |

所有配置都支持热更新（`PUT /api/agents/:id`），不需要重启服务。`description` 字段同时被 SupervisorAgent 的 System Prompt 消费，所以你给某个 Agent 写的能力描述，Supervisor 在分配任务时就会自动参考——这把"Agent 自我介绍"和"Supervisor 选人"串联起来了。
