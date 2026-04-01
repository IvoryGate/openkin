# 第一层详细设计：通用 Agent 基础框架

> 文档定位：供人类评审的第一层详细设计稿  
> 对应主文档：`docs/archive/backend-plan/AI_Agent_Backend_Tech_Plan.md` § 2.1  
> 文档状态：Draft · 待 Review  
> 更新时间：2026-03-31

---

## 1. 文档目标

这份文档只解决一件事：**把“第一层：通用 Agent 基础框架”定义成一套稳定、可实现、可被上层依赖的底座。**

它不是功能清单，也不是开发排期，而是一份面向实现和评审的**基础层设计说明**。评审这份文档时，重点应该看：

- 第一层的对象模型是否自洽
- 第一层的边界是否稳定，能否支撑第二到第五层
- 运行时契约是否足够完整，避免上层反向定义底层
- 并发、会话隔离、记忆、Hook 等核心机制是否闭环

---

## 2. 设计结论先行

### 2.1 第一层要解决什么

第一层提供的是**Agent 运行时内核**，而不是“完整产品能力”。

它负责：

- 抽象不同 LLM Provider
- 管理一次推理运行的上下文
- 驱动单 Agent 的 ReAct 推理循环
- 通过 Hook 暴露扩展点
- 定义 Session 隔离、记忆接入、执行轨迹等基础契约

它不负责：

- HTTP / WebSocket 服务
- 数据库选型与表结构实现
- MCP / Skill / 工具生态
- 多 Agent 调度
- 定时任务、知识库、可观测性落地实现

### 2.2 第一层的最终产物是什么

第一层完成后，系统应该能做到：

1. 用代码创建一个 Agent 定义。
2. 为某个 Session 发起一次 `run()`。
3. 在没有 HTTP 服务的情况下完成多轮推理。
4. 允许外部通过 Hook 接入历史对话、长期记忆、日志、权限控制等能力。
5. 在并发运行多个 Session 时不发生上下文串台。

### 2.3 第一层的核心判断

**Agent 是“能力定义”，Run 是“执行实例”，Session 是“上下文隔离容器”。**

这三个概念必须分开，否则上层能力会在并发、持久化和扩展上反复返工。

---

## 3. 第一层的边界

### 3.1 依赖方向

第一层允许依赖：

- `lib/llm`
- `lib/context`
- 基础类型、工具函数、错误定义

第一层禁止依赖：

- `server/*`
- HTTP 请求对象
- 数据库实现细节
- MCP、Skill、知识库、任务系统

### 3.2 与上层的关系

第一层对上层提供两类能力：

| 类型 | 作用 | 例子 |
| --- | --- | --- |
| **稳定契约** | 上层围绕这些类型和接口构建功能 | `AgentRunInput`、`RunContext`、`Message`、`ToolCall` |
| **扩展点** | 上层通过这些点接入自身能力，但不修改核心 | `AgentLifecycleHooks`、`ContextContributor`、`MemoryStore` |

因此，第一层必须做到：

- 核心对象少而稳
- 接口清晰，避免“文档里说有、类型里没有”
- 上层的新增能力主要通过**实现接口**来接入，而不是**修改核心类型**

---

## 4. 核心概念模型

### 4.1 四个基础对象

#### A. `AgentDefinition`

表示一个 Agent 的静态定义，是“这个 Agent 是谁、会什么、默认怎么思考”。

它包含：

- `id`
- `name`
- `systemPrompt`
- `llmProfile`
- `maxSteps`
- 默认启用的插件 / 能力配置

它**不包含运行态数据**，例如：

- 当前消息列表
- 当前 trace
- 当前 Session 的上下文
- 本轮推理缓存

#### B. `Session`

表示一个对话或任务的隔离容器，是“上下文属于谁”的问题。

它负责界定：

- 哪些历史消息属于这次会话
- 哪个 `ContextManager` 归属于它
- 谁发起了这个会话
- 这个会话属于什么用途

#### C. `AgentRun`

表示一次具体的执行，是“这次运行正在发生什么”的问题。

它是一次 `run()` 调用的运行态实例，天然短生命周期。它应当持有：

- `traceId`
- `runInput`
- `RunContext`
- 当前步号
- 当前累计 token / 耗时
- 当前步骤内的中间状态

#### D. `SessionRuntime`

表示某个 Session 在内存中的运行时资源，是“会话当前有什么暂存对象”的问题。

它至少包含：

- `session`
- `contextManager`
- 与该 Session 绑定的内存态缓存

### 4.2 三者关系

```
AgentDefinition
  └─ 被复用，不保存会话状态

Session
  └─ 定义隔离边界

SessionRuntime
  └─ 属于某个 Session
      └─ 包含 ContextManager

AgentRun
  └─ 基于 AgentDefinition + SessionRuntime 发起
      └─ 每次 run() 独立创建，结束即销毁
```

### 4.3 关键设计决策

**`ContextManager` 不属于 `AgentDefinition`，而属于 `SessionRuntime`。**

原因很简单：

- 同一个 Agent 可能同时服务多个用户
- 同一个 Agent 也可能同时执行多个后台任务
- 如果 `ContextManager` 挂在 Agent 实例上，就会天然制造串台风险

这条规则是第一层能否支撑第三层和第四层的关键前提。

---

## 5. 统一运行时契约

第一层必须明确一组统一 contract。后续所有扩展文档都只能在这个 contract 上延伸，不能绕开它另起一套字段。

### 5.1 `AgentRunInput`

```typescript
interface AgentRunInput {
  sessionId: string
  input: UserInput
  requester?: {
    type: 'user' | 'agent' | 'system'
    id: string
  }
  stream?: boolean
  metadata?: Record<string, unknown>
}
```

说明：

- `sessionId` 是必填，因为第一层天然要求会话隔离
- `requester` 用于权限、审计、任务系统等上层能力
- `metadata` 允许上层透传附加信息，但核心只负责携带，不解释业务语义

### 5.2 `RunContext`

```typescript
interface RunContext {
  traceId: string
  sessionId: string
  agentId: string
  sessionType: string
  requester?: {
    type: 'user' | 'agent' | 'system'
    id: string
  }
  startedAt: number
  stepIndex: number
  abortSignal?: AbortSignal
  runtime: SessionRuntime
  metadata?: Record<string, unknown>
}
```

设计要求：

- 这是第一层统一的运行上下文
- 所有 Hook 看到的上下文都从这里派生
- `runtime` 明确提供 `SessionRuntime`，避免插件私自去拿全局单例

### 5.3 `StepContext`

```typescript
interface StepContext extends RunContext {
  stepIndex: number
  stepStartedAt: number
  stepBudget?: {
    maxInputTokens?: number
    maxOutputTokens?: number
    maxDurationMs?: number
  }
}
```

`StepContext` 解决的问题不是“多几个字段”，而是把“每一步可以依赖什么数据”界定清楚，避免插件随意读取外部状态。

### 5.4 `AgentResult`

```typescript
interface AgentResult {
  traceId: string
  sessionId: string
  agentId: string
  finalMessage: Message
  finishReason: 'final_answer' | 'max_steps' | 'aborted' | 'error'
  usage?: TokenUsage
  steps: StepTrace[]
}
```

第一层建议直接把 `traceId` 和 `steps` 纳入结果对象。这样第三层的任务系统、日志系统、调试界面都不用猜测“trace 到底在哪里取”。

---

## 6. 消息模型设计

### 6.1 设计要求

第一层的消息模型不能只够“纯文本对话”，必须从一开始就能承接：

- 文本
- 图片 / 多模态输入
- 工具调用
- 工具结果
- 后续可能的结构化输出

### 6.2 建议的数据结构

```typescript
type MessageRole = 'system' | 'user' | 'assistant' | 'tool'

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; imageUrl: string; detail?: 'low' | 'high' | 'auto' }
  | { type: 'input_json'; value: unknown }
  | { type: 'output_json'; value: unknown }

interface Message {
  id?: string
  role: MessageRole
  content: ContentPart[]
  name?: string
  toolCallId?: string
  createdAt?: number
  metadata?: Record<string, unknown>
}
```

### 6.3 为什么不用 `content: string`

因为第一层已经明确要支持：

- OpenAI / Anthropic 的 tool use
- Vision
- 上下文注入
- 可追踪的 tool result

如果现在把 `Message` 简化成 `{ role, content: string }`，未来引入多模态和结构化内容时，会波及：

- `ContextManager`
- `ConversationHistory`
- `LLMProvider`
- `TraceLogger`
- `ToolRegistry`

这类返工代价太高，不应该推迟到第三层再补。

---

## 7. LLM 抽象层设计

### 7.1 目标

`LLMProvider` 的职责不是“尽量暴露所有厂商细节”，而是：

- 对核心层暴露稳定语义
- 把 provider 差异吸收在 adapter 内部
- 让上层在不关心厂商细节的情况下做推理、工具调用和流式输出

### 7.2 建议接口

```typescript
interface LLMProvider {
  invoke(request: LLMRequest): Promise<LLMResponse>
  stream(request: LLMRequest): AsyncIterable<StreamChunk>
  countTokens(input: Message[] | string): Promise<number>
  getModelInfo(): Promise<ModelInfo>
}

interface LLMRequest {
  model: string
  messages: Message[]
  tools?: ToolSchema[]
  temperature?: number
  maxOutputTokens?: number
  responseFormat?: 'text' | 'json'
  metadata?: Record<string, unknown>
}

interface LLMResponse {
  message: Message
  toolCalls?: ToolCall[]
  usage?: TokenUsage
  finishReason?: string
  raw?: unknown
}
```

### 7.3 Provider 层必须消化的差异

Provider adapter 负责吸收以下差异：

- OpenAI 的 `tool_calls`
- Anthropic 的 `tool_use`
- 各家不同的 usage 字段
- 各家不同的 stream chunk 事件格式
- 各家不同的 image / multi-part 输入格式

核心层不应该知道这些细节。

---

## 8. ContextManager 设计

### 8.1 职责

`ContextManager` 只做一件事：**维护当前一次推理要送给 LLM 的合法消息集。**

它不负责：

- 长期存储
- 权限判断
- 业务级知识库检索
- 任务调度

### 8.2 设计原则

- 只面向一次运行中的消息拼装
- 始终显式处理 token 预算
- 与持久化层解耦
- 与 SessionRuntime 绑定，而不是与 AgentDefinition 绑定

### 8.3 建议接口

```typescript
interface ContextManager {
  reset(): void
  loadBaseMessages(messages: Message[]): void
  append(message: Message): void
  appendMany(messages: Message[]): void
  snapshot(): Message[]
  ensureWithinBudget(policy: ContextBudgetPolicy): Promise<Message[]>
}
```

### 8.4 与历史、记忆的分工

| 模块 | 负责什么 | 不负责什么 |
| --- | --- | --- |
| `ContextManager` | 当前发送给 LLM 的消息集合 | 历史存盘、长期记忆检索 |
| `ConversationHistory` | 会话历史读写 | 当前推理的裁剪策略 |
| `LongTermMemory` | 跨会话经验检索与写入 | 会话级消息还原 |

这个边界必须稳定，否则第一层会逐渐变成“大杂烩”。

---

## 9. ReAct 推理核心

### 9.1 核心职责

推理核心负责：

1. 初始化本次 `AgentRun`
2. 构建上下文
3. 调用 LLM
4. 解析工具调用
5. 执行工具回路
6. 生成最终结果
7. 在关键节点触发 Hook

### 9.2 核心不负责

- 具体数据库读写
- HTTP 推送
- 权限模型
- 定时任务状态更新
- 知识库检索实现

这些能力都只能通过 Hook 或回调进入。

### 9.3 建议执行流程

```
创建 AgentRun
  → onRunStart
  → while(stepIndex < maxSteps)
      → build context
      → onContextBuild
      → onBeforeLLMCall
      → LLM invoke / stream
      → onAfterLLMCall
      → 如果有 tool calls
          → 对每个 tool call:
              → onBeforeToolCall
              → execute tool
              → onAfterToolCall
              → 回注工具结果到 context
      → onStepEnd
      → 若已得到最终答案，结束
  → onRunEnd / onRunError
```

### 9.4 关键规则

- 一个 `run()` 对应一个 `traceId`
- 一个步骤内允许多个工具调用
- 每次 LLM 调用前都重新构建 context
- 核心只依赖接口，不依赖具体插件实现

---

## 10. Hook 系统

### 10.1 为什么第一层必须内建 Hook

因为第一层不是“把所有能力都做完”，而是“给后续能力留下标准接入点”。

如果没有 Hook：

- 历史消息只能硬编码进核心
- 日志只能硬编码进核心
- 权限拦截只能硬编码进核心
- 长期记忆和知识库只能侵入核心

这样第一层根本无法长期演进。

### 10.2 Hook 的设计原则

- **观察型**：不影响主流程
- **变换型**：可修改数据，但必须串行明确
- **拦截型**：允许中止或替换
- **聚合型上下文贡献**：允许多个插件共同构建 context

### 10.3 建议保留的 hook

```typescript
interface AgentLifecycleHooks {
  onRunStart?(ctx: RunContext): Promise<void>
  onRunEnd?(ctx: RunContext, result: AgentResult): Promise<void>
  onRunError?(ctx: RunContext, error: Error): Promise<void>

  onContextBuild?(ctx: StepContext): Promise<ContextAddition | null>
  onBeforeLLMCall?(ctx: StepContext, messages: Message[]): Promise<Message[] | null>
  onAfterLLMCall?(ctx: StepContext, response: LLMResponse): Promise<LLMResponse | null>

  onBeforeToolCall?(ctx: StepContext, toolCall: ToolCall): Promise<GuardResult<ToolCall>>
  onAfterToolCall?(ctx: StepContext, result: ToolResult): Promise<ToolResult | null>

  onStepEnd?(ctx: StepContext, summary: StepSummary): Promise<void>
  onStreamChunk?(ctx: RunContext, chunk: StreamChunk): Promise<void>
}
```

### 10.4 暂不纳入第一层核心 contract 的内容

`onProgressUpdate` 这类能力目前更偏第三层任务系统语义。建议：

- 可以在后续扩展
- 但不要在第一层详细设计里默认它已经是底层核心 contract

否则会把任务系统语义提前压进基础层。

---

## 11. Session 隔离设计

### 11.1 Session 的职责

Session 是**上下文隔离单位**，不是“业务对象的补充字段”。

它的意义在于回答：

- 这次对话属于谁
- 这次运行应该看到哪些历史
- 哪个 `ContextManager` 和它绑定
- 它属于用户对话、Agent 子任务还是其他运行形态

### 11.2 建议数据模型

```typescript
type BuiltinSessionType =
  | 'user_conversation'
  | 'agent_task'
  | 'scheduled_task'

interface Session {
  id: string
  agentId: string
  sessionType: BuiltinSessionType | (string & {})
  initiator: {
    type: 'user' | 'agent' | 'system' | 'task'
    id: string
  }
  createdAt: number
  updatedAt: number
  metadata?: Record<string, unknown>
}
```

### 11.3 设计决策

这里故意把 `sessionType` 设计成：

- 一组内置保留值
- 加一个可扩展字符串空间

这样做的目的，是避免第三层或第四层每新增一种运行方式，就必须回过头修改第一层模型。

### 11.4 必须隔离的资源

| 资源 | 隔离粒度 | 说明 |
| --- | --- | --- |
| `ContextManager` | 每个 SessionRuntime 独立 | 防止多会话串台 |
| 会话历史 | 按 `sessionId` | 只读本会话历史 |
| 本轮 trace | 每次 run 独立 | 用于调试和审计 |

### 11.5 可以共享的资源

| 资源 | 共享粒度 | 说明 |
| --- | --- | --- |
| `AgentDefinition` | 同一个 Agent 共享 | 静态定义，可复用 |
| `LLMProvider` | Provider 实例可共享 | 只要调用无状态 |
| `LongTermMemory` | 按 `agentId` 共享 | 经验属于 Agent，不属于会话 |

---

## 12. 记忆系统设计

### 12.1 总原则

记忆系统是第一层能力，但必须以**插件 + 存储接口**形式存在，而不是直接耦合某种数据库实现。

### 12.2 两类记忆

#### A. ConversationHistory

职责：

- 按 `sessionId` 存储会话消息
- 在 `onRunStart` 阶段恢复历史
- 在 `onRunEnd` 阶段持久化本轮新增消息

#### B. LongTermMemory

职责：

- 按 `agentId` 存储跨会话经验
- 在首步 `onContextBuild` 阶段检索注入
- 在 `onRunEnd` 阶段提炼值得保留的经验

### 12.3 第一层不应绑定 SQLite

第一层可以默认“先以 SQLite adapter 实现”，但不应把 SQLite 细节写进核心 API。

建议定义以下端口：

```typescript
interface ConversationStore {
  loadBySession(sessionId: string): Promise<Message[]>
  append(sessionId: string, messages: Message[]): Promise<void>
}

interface MemoryStore {
  search(agentId: string, query: string, topK: number): Promise<MemoryEntry[]>
  save(agentId: string, entries: MemoryEntry[]): Promise<void>
}
```

这样第三层可以实现：

- `SQLiteConversationStore`
- `SQLiteMemoryStore`
- 未来再替换为更强的存储实现

---

## 13. 执行轨迹与可观测性边界

### 13.1 第一层该负责什么

第一层负责定义：

- `traceId`
- `StepTrace`
- `AgentResult.steps`
- Hook 可以拿到哪些执行信息

### 13.2 第一层不负责什么

第一层不负责：

- 日志库选型
- Trace 持久化到哪张表
- 指标平台接入
- HTTP trace 查询接口

这些都属于第三层。

### 13.3 建议的步骤级结构

```typescript
interface StepTrace {
  stepIndex: number
  llmRequest?: LLMRequest
  llmResponse?: LLMResponse
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  usage?: TokenUsage
  startedAt: number
  finishedAt: number
  status: 'success' | 'aborted' | 'error'
  error?: string
}
```

设计上，第一层应当把“记录什么”定义清楚，把“写去哪里”留给上层。

---

## 14. 并发模型

### 14.1 并发原则

第一层默认运行在 Node.js 单线程异步模型中。

因此它面对的主要问题不是传统多线程共享内存，而是：

- 不同 Session 的运行态对象是否隔离
- 有状态插件是否按 `traceId` 或 `sessionId` 正确分桶
- 是否误把运行态缓存挂在单例 Agent 上

### 14.2 并发安全红线

以下内容**不得挂在全局单例或 AgentDefinition 上**：

- 当前消息数组
- 当前步骤号
- 当前 trace 累积数据
- 当前 run 的 token 统计

这些都必须放在：

- `AgentRun`
- `RunContext`
- `SessionRuntime`
- 或以 `traceId` 为 key 的插件内部状态

### 14.3 插件状态要求

任何有状态插件都必须满足：

- 以 `traceId` 或 `sessionId` 做隔离键
- 在 `onRunEnd` / `onRunError` 做清理
- 不持有上一次运行的临时消息对象引用

---

## 15. 目录与模块建议

建议将第一层组织为以下结构：

```text
packages/
  core/
    agent/
      definition.ts
      runner.ts
      types.ts
      errors.ts
      lifecycle/
        hooks.ts
        hook-runner.ts
        context-builder.ts
    session/
      types.ts
      registry.ts
      runtime.ts
    memory/
      conversation-history.ts
      long-term-memory.ts
      ports.ts
  lib/
    llm/
      interface.ts
      providers/
    context/
      context-manager.ts
      token-budget.ts
```

这样拆分的好处是：

- `agent` 只关心运行
- `session` 只关心隔离
- `memory` 只关心读写契约
- `llm` 只关心 provider 适配
- `context` 只关心消息拼装和裁剪

---

## 16. 建议的实现顺序

如果这份详细设计通过评审，建议按下面顺序落地第一层：

1. 先冻结核心类型：
   `Message`、`LLMRequest`、`LLMResponse`、`AgentRunInput`、`RunContext`、`AgentResult`
2. 完成 `LLMProvider` 抽象和一个最小 provider 实现
3. 完成 `ContextManager`
4. 完成 `AgentRunner` 的最小 ReAct 循环
5. 完成 `HookRunner`
6. 完成 `SessionRegistry` 和 `SessionRuntime`
7. 用 mock store 接入 `ConversationHistory` / `LongTermMemory`
8. 最后再让第三层提供 SQLite adapter

顺序上要避免一开始就把数据库和服务层细节灌进核心。

---

## 17. 本文档解决了哪些关键问题

相对于主方案中的第一层描述，这份详细设计明确收敛了以下问题：

- 明确区分 `AgentDefinition`、`Session`、`AgentRun`、`SessionRuntime`
- 明确 `ContextManager` 属于 SessionRuntime，而不是 Agent
- 明确第一层必须先冻结统一运行时 contract
- 明确消息模型应支持多模态和工具调用，不再局限于字符串
- 明确记忆系统通过 Store port 接入，而不是直接绑定 SQLite
- 明确 `sessionType` 需要保留内置值，同时允许后续扩展

---

## 18. 评审清单

在决定是否采纳这份设计前，建议重点看以下问题：

1. `AgentDefinition` 与 `AgentRun` 的分离是否足够清楚？
2. `ContextManager` 绑定 SessionRuntime 是否能接受？
3. 第一层是否应该直接采用可扩展的消息模型？
4. `RunContext` / `StepContext` 的字段是否已经足够稳定？
5. `sessionType` 是否接受“内置枚举 + 可扩展字符串”的设计？
6. 第一层是否应该显式定义 `ConversationStore` / `MemoryStore` 等端口？
7. 这套设计是否足以支撑第三层任务系统和第四层多 Agent 协作？

---

## 19. 暂未决策事项

这份文档刻意没有在第一轮强行定死以下内容，建议后续单独评审：

- 是否在第一层就纳入 `onProgressUpdate`
- `ToolCall` / `ToolResult` 的最终字段细节
- 结构化输出是否统一为 JSON Schema 约束
- `Message.content` 中是否还需要加入音频、文件等 content part
- `LongTermMemory` 首期是否只做关键词检索，还是直接保留向量接口

---

## 20. 总结

第一层真正要做的，不是“先把一套 Agent 跑起来”，而是**先定义一套以后不用反复打破的底座**。

如果这层设计稳定，那么：

- 第二层可以放心把工具生态挂上来
- 第三层可以把服务化和持久化做成 adapter
- 第四层可以复用 Session 和 Run 模型做多 Agent 协作
- 第五层可以在不重写底层的前提下演进能力

如果这层设计不稳定，后面的每一层都会把业务语义反压回基础层，最终导致核心层边界混乱、类型漂移、并发风险增大。

因此，这份文档的核心目标不是“把第一层写得更详细”，而是**让第一层成为真正可以长期承压的基础设施层**。

