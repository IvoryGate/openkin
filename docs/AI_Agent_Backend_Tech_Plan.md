# AI Agent 后端服务技术开发分层规划

> 文档状态：草稿 · 待 Review  
> 更新时间：2026-03-30

---

## 目录

1. [整体分层架构](#1-整体分层架构)
2. [分层任务规划](#2-分层任务规划)
   - 2.1 [第一层：通用 Agent 基础框架](#21-第一层通用-agent-基础框架)
     - 2.1.1 LLM 统一抽象接口
     - 2.1.2 多 LLM Provider 接入
     - 2.1.3 上下文管理器
     - 2.1.4 Agent 推理核心
     - 2.1.5 记忆系统
     - 2.1.6 生命周期 Hook 系统（新增）
     - 2.1.7 会话隔离（新增）
   - 2.2 [第二层：工具生态与协议层](#22-第二层工具生态与协议层)
   - 2.3 [第三层：服务化与工程能力层](#23-第三层服务化与工程能力层)
     - 2.3.1 服务框架
     - 2.3.2 持久化层
     - 2.3.3 核心 API 路由
     - 2.3.4 日志与可观测性系统（大幅扩充）
     - 2.3.5 统一任务基础设施（新增）
     - 2.3.6 代码执行沙箱
     - 2.3.7 可插拔向量存储
     - 2.3.8 安全与配置
   - 2.4 [第四层：多 Agent 协作层](#24-第四层多-agent-协作层)
   - 2.5 [第五层：特化场景与智能进化层](#25-第五层特化场景与智能进化层)
3. [渐进式开发路线图](#3-渐进式开发路线图)
4. [工程规范](#4-工程规范)
5. [待决策事项](#5-待决策事项)

---

## 1. 整体分层架构

**核心原则：每一层是且仅是下一层的基础设施，层与层之间单向依赖，上层可替换下层实现，下层不感知上层存在。**

```
┌──────────────────────────────────────────────────────────────────┐
│              第五层：特化场景与智能进化层                              │
│   垂直场景 Agent / 自我反思 / Prompt 自进化 / Fine-tuning 流水线      │
├──────────────────────────────────────────────────────────────────┤
│              第四层：多 Agent 协作层                                  │
│   Supervisor 模式 / Plan-and-Execute / 共享记忆 / AgentScheduler   │
├──────────────────────────────────────────────────────────────────┤
│              第三层：服务化与工程能力层                                 │
│   HTTP/WebSocket 服务 / 持久化 / 可观测性 / 安全鉴权 / 配置中心         │
├──────────────────────────────────────────────────────────────────┤
│              第二层：工具生态与协议层                                   │
│   MCP 协议 / Skill 框架 / 工具注册中心 / 内置工具集                     │
├──────────────────────────────────────────────────────────────────┤
│              第一层：通用 Agent 基础框架                                │
│   LLM 抽象接口 / 多 Provider 接入 / 推理核心 / 上下文管理 / 记忆系统    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. 分层开发规划

### 2.1 第一层：通用 Agent 基础框架

**职责**：提供与业务无关的通用 Agent 运行时，是整个系统的地基。上层所有模块均依赖此层，此层不依赖任何上层代码。

**完成标志**：可以在没有任何 HTTP 服务、没有任何工具的情况下，通过代码直接驱动一个 Agent 与任意 LLM 完成多轮对话与推理。

---

#### 2.1.1 LLM 统一抽象接口（`lib/llm/interface`）

定义 LLM Provider 的统一契约，所有上层代码只依赖此抽象，不依赖具体 Provider。

- [ ] 定义 `LLMProvider` 接口：`chat()` / `stream()` / `countTokens()` / `getModelInfo()`
- [ ] 定义标准消息格式：`Message = { role: 'system' | 'user' | 'assistant' | 'tool', content }`
- [ ] 定义工具调用标准结构：`ToolCall` / `ToolResult`
- [ ] 定义流式响应数据结构：`StreamChunk`
- [ ] 错误类型标准化：`LLMError`（RateLimit / ContextOverflow / NetworkError / AuthError）

#### 2.1.2 多 LLM Provider 接入（`lib/llm/providers/`）

每个 Provider 独立实现 `LLMProvider` 接口，可按需插拔。

| Provider                      | 支持能力                          | 优先级 |
| ----------------------------- | --------------------------------- | ------ |
| OpenAI（GPT-4o / GPT-4.1）    | Chat / Stream / Tool Use / Vision | P0     |
| Anthropic（Claude 3.x / 4.x） | Chat / Stream / Tool Use / Vision | P0     |
| Ollama（本地模型）            | Chat / Stream / Tool Use          | P1     |
| Google（Gemini）              | Chat / Stream / Tool Use          | P2     |
| 自定义 OpenAI 兼容端点        | Chat / Stream                     | P2     |

- [ ] 实现 `OpenAIProvider`：支持流式 SSE、tool_calls 解析、vision
- [ ] 实现 `AnthropicProvider`：支持流式事件、tool_use 格式转换
- [ ] 实现 `OllamaProvider`：本地 HTTP 调用，格式适配
- [ ] 实现 Provider 工厂：`LLMProviderFactory.create(config)` 按配置实例化
- [ ] 统一重试机制：指数退避，可配置最大次数与超时
- [ ] Token 计数工具（`tiktoken` / 模型自报）

> 可用于测试的LLM API（OpenAI接口标准）：https://api.longcat.chat/openai apikey:ak_2VJ9F82Iu2GO3Aa86J7J44tQ9O452
> 支持接口：/v1/chat/completions
> **如果用以上信息无法成功调用**，再阅读接入文档：https://longcat.chat/platform/docs/zh/

#### 2.1.3 上下文管理器（`lib/context`）

管理单次推理的上下文窗口，独立于具体 Provider。

- [ ] 消息列表的增删查操作
- [ ] 上下文窗口溢出检测（与模型 `max_context_length` 比对）
- [ ] 溢出策略：滑动窗口（丢弃最早消息）/ 摘要压缩（调 LLM 生成摘要）
- [ ] System Prompt 固定注入（不参与裁剪）
- [ ] 上下文序列化/反序列化（供持久化使用）

#### 2.1.4 Agent 推理核心（`core/agent`）

单个 Agent 的推理循环，不含任何工具执行逻辑，只负责"决策"。采用自研 ReAct 模式，不引入 LangChain 等第三方框架，原因如下：

> **为什么自研 ReAct 而非 LangChain/LangGraph？**
> - **可控性**：LangChain 封装层级深，出错时难以定位根因；自研代码调用路径清晰，每一步都可断点调试
> - **轻量**：LangChain 的 npm 包体积超过 100MB，包含大量我们不需要的抽象；自研核心逻辑 < 500 行
> - **定制化**：我们的记忆系统、Skill 框架与 LangChain 的抽象不吻合，强行适配反而增加复杂度
> - **稳定性**：LangChain API 变动频繁，升级成本高；自研接口由我们控制，不受上游影响
>
> ReAct 循环本质上是一个 while 循环：调用 LLM → 解析是否有工具调用 → 有则执行并追加结果 → 无则输出。核心逻辑并不复杂，自研完全可行。

- [ ] 定义 `Agent` 基类：`{ id, name, systemPrompt, provider, contextManager, plugins: AgentLifecycleHooks[] }`
- [ ] 实现 ReAct 推理循环（Thought → Action → Observation → ...）：
  - 接收用户输入，调用 LLM 推理
  - 解析返回：普通回复 vs 工具调用请求
  - 工具调用请求通过回调（`onToolCall`）交由上层执行，结果回注上下文
  - 循环直到 LLM 输出最终答案或达到最大步骤数
- [ ] 执行步骤上限配置（防止无限循环）
- [ ] Agent 执行轨迹结构定义：
  ```typescript
  interface AgentRunTrace {
    traceId: string           // 单次推理的唯一标识，贯穿整个 ReAct 循环
    taskId?: string           // 关联的任务 ID（由任务系统注入，核心不感知）
    sessionId: string
    agentId: string
    startedAt: number
    steps: Array<{
      stepIndex: number
      type: 'llm_call' | 'tool_call' | 'tool_result' | 'final_answer'
      input: object           // 发送给 LLM/工具的完整数据
      output: object          // 从 LLM/工具拿到的返回
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
- [ ] 流式输出支持：推理过程中间步骤可逐步 emit
- [ ] **Context Builder 阶段**：每次 LLM 调用前，运行所有已注册的 `ContextContributor`，收集各模块的上下文贡献（详见 2.1.6）

#### 2.1.5 记忆系统（`core/memory`）

Agent 跨会话的信息持久化能力，此层只定义接口和内存实现，持久化后端由第三层提供。

| 记忆类型                      | 作用域            | 存储介质（此层）                        |
| ----------------------------- | ----------------- | --------------------------------------- |
| 工作记忆（Working Memory）    | 当前 Agent 执行内 | in-memory                               |
| 短期记忆（Session Memory）    | 单次会话          | in-memory（接口定义留给上层实现持久化） |
| 长期记忆（Long-term Memory）  | 跨会话            | 接口定义，实现在第三层                  |
| 程序记忆（Procedural Memory） | Agent 技能描述    | JSON 文件                               |

- [ ] 定义 `MemoryStore` 接口：`get()` / `set()` / `search()` / `delete()`
- [ ] 实现 `InMemoryStore`（用于测试和工作记忆）
- [ ] 实现记忆注入策略：在每次推理前自动检索相关记忆并注入 System Prompt（通过 `ContextContributor` 机制，见 2.1.6）
- [ ] 记忆压缩：超过阈值时触发 LLM 摘要

#### 2.1.6 生命周期 Hook 系统（`core/agent/lifecycle`）

Agent 推理循环有丰富的内部结构（循环内含多次 LLM 调用、多次工具调用），单一的线性中间件无法 hook 到循环内部的各个节点。因此采用**声明式 Hook 系统**（参考 Rollup/Fastify 插件机制），在推理生命周期的关键节点预埋 hook，插件只实现自己关心的方法。

> **为什么不用洋葱模型（Koa 风格中间件）？**
>
> 洋葱模型适合"输入→处理→输出"的线性请求流（Hono 的 HTTP 路由层仍然使用）。但 Agent 的 ReAct 循环是一个有状态的迭代过程：一次用户输入可能触发 3 次 LLM 调用、5 次工具调用，每次都需要独立 hook。洋葱模型只有"进入前"和"返回后"两个时机，远远不够。Hook 系统可以精确地 hook 到"第 2 步的工具调用前"这样的位置。

**所有可 hook 的时机：**

```typescript
interface AgentLifecycleHooks {
  // ── 任务级别（整个 run() 调用的开始和结束）──────────────────
  onRunStart?(ctx: RunContext): Promise<void>
  onRunEnd?(ctx: RunContext, result: AgentResult): Promise<void>
  onRunError?(ctx: RunContext, error: Error): Promise<void>

  // ── 上下文构建（每次 LLM 调用前的 context 准备阶段）─────────
  // 返回 null/undefined 表示不贡献内容
  onContextBuild?(ctx: RunContext): Promise<ContextAddition | null>

  // ── LLM 调用级别（ReAct 循环内每步都触发）────────────────────
  // 变换型：返回新 messages，null 表示不修改
  onBeforeLLMCall?(ctx: StepContext, messages: Message[]): Promise<Message[] | null>
  // 变换型：返回新 response，null 表示不修改
  onAfterLLMCall?(ctx: StepContext, response: LLMResponse): Promise<LLMResponse | null>

  // ── 工具调用级别────────────────────────────────────────────
  onBeforeToolCall?(ctx: StepContext, toolName: string, input: unknown): Promise<unknown>
  onAfterToolCall?(ctx: StepContext, toolName: string, result: ToolResult): Promise<ToolResult | null>

  // ── 流式输出级别────────────────────────────────────────────
  // 观察型：不能修改 chunk
  onStreamChunk?(ctx: RunContext, chunk: StreamChunk): Promise<void>

  // ── 进度上报（供任务系统消费）──────────────────────────────
  // 观察型
  onProgressUpdate?(ctx: RunContext, progress: StepProgress): Promise<void>
}

interface ContextAddition {
  systemPromptAddition?: string   // 追加到 system prompt 的内容
  messages?: Message[]            // 在消息列表中注入额外 message
}
```

**两类 hook 的执行方式不同：**

| 类型       | 识别方式                      | 执行方式                  | 说明                                       |
| ---------- | ----------------------------- | ------------------------- | ------------------------------------------ |
| **观察型** | 返回 `void` / `Promise<void>` | `Promise.all`（并发）     | 不修改数据，顺序无关                       |
| **变换型** | 返回新值或 `null`             | `for...of`（串行 reduce） | 按注册顺序依次变换，前一个输出是后一个输入 |

**扩展方式：** 后续新增 hook 点位只需两步——① 在 `AgentLifecycleHooks` 接口加可选方法（`?:`）；② 在推理循环对应位置调用 `await this.runHook('新方法名', ...)`。现有插件不受影响，因为所有方法都是可选的。

**内置插件列表（由上层模块注册，核心不感知）：**

| 插件                      | 实现的 hook                                                   | 所在层             |
| ------------------------- | ------------------------------------------------------------- | ------------------ |
| `TraceLoggerPlugin`       | `onRunStart/End/Error` + `onAfterLLMCall` + `onAfterToolCall` | 第三层             |
| `MemoryContributorPlugin` | `onContextBuild`                                              | 第一层（记忆系统） |
| `RagContributorPlugin`    | `onContextBuild`                                              | 第三层（知识库）   |
| `TaskProgressPlugin`      | `onProgressUpdate`                                            | 第三层（任务系统） |
| `ContentFilterPlugin`     | `onBeforeLLMCall`                                             | 第三层（可选）     |

- [ ] 定义 `AgentLifecycleHooks` 接口，区分观察型与变换型
- [ ] `Agent` 基类实现插件注册：`agent.use(plugin: AgentLifecycleHooks)`
- [ ] 推理循环中在各关键节点调用对应 hook
- [ ] 实现 `ContextBuilder`：`onContextBuild` 阶段收集所有插件贡献，组装最终 messages

#### 2.1.7 会话隔离（`core/session`）

系统中存在两类并发场景：同一 Agent 被用户在多个对话窗口同时使用；同一 Agent 既参与用户对话又被 AgentScheduler 分配了子任务。这两种场景都要求 **工作记忆和对话历史严格隔离**，但 **长期记忆跨 session 共享**。

**Session 数据模型：**

```typescript
interface Session {
  id: string
  agentId: string
  // 区分会话来源，避免用户对话与 Agent 任务的上下文互相污染
  sessionType: 'user_conversation' | 'agent_task'
  // 发起方：userId（用户发起）或 agentId（AgentScheduler 分配）
  initiatorId: string
  // 如果是 agent_task 类型，关联的 taskId
  taskId?: string
  createdAt: number
  updatedAt: number
}
```

**隔离规则：**

| 资源                          | 隔离粒度              | 说明                                |
| ----------------------------- | --------------------- | ----------------------------------- |
| 工作记忆（in-memory 上下文）  | 每个 Session 独立实例 | Session 销毁即释放                  |
| 对话历史（messages 表）       | 按 `session_id` 查询  | 不同 session 互不可见               |
| 长期记忆（memory_entries 表） | 按 `agent_id` 共享    | 跨 session 积累知识                 |
| TraceId                       | 每次推理独立生成      | 多 session 并发时各有自己的 traceId |

- [ ] 定义 `Session` 数据结构，补充 `sessionType` 和 `initiatorId` 字段
- [ ] `ContextManager` 实例与 Session 一一绑定，Session 销毁时释放
- [ ] Session 创建时自动生成初始 `traceId`，每次推理更新为新 `traceId`
- [ ] 提供 `SessionRegistry`：管理活跃 Session 的生命周期（创建 / 查找 / 销毁）

---

### 2.2 第二层：工具生态与协议层

**前提**：第一层全部完成并通过测试。

**职责**：为 Agent 的 `onToolCall` 回调提供完整的工具生态，包括工具定义规范、MCP 协议接入、Skill 框架和内置工具集。此层完成后，Agent 具备调用外部能力的基础，但尚未服务化。

**完成标志**：可以在无 HTTP 服务的情况下，通过代码直接让 Agent 使用内置工具（文件读写、网络请求等）或连接任意 MCP Server 执行工具调用。

---

#### 2.2.1 工具定义规范（`lib/tool`）

统一工具的描述格式和调用约定。

- [ ] 定义 `Tool` 接口：`{ name, description, inputSchema: JSONSchema, execute(input) -> ToolResult }`
- [ ] 定义 `ToolResult`：`{ content: string | object, isError: boolean, metadata? }`
- [ ] 工具参数校验（`ajv` 对 JSONSchema 校验）
- [ ] 工具执行超时控制
- [ ] 工具错误标准化处理

#### 2.2.2 MCP 协议接入（`lib/mcp`）

完整实现 MCP 客户端，追踪 MCP 最新规范草案（当前为 2025-03 草案），优先支持最新传输协议。

> **为什么追踪最新草案而非稳定版（2024-11）？**
> MCP 协议仍处于高速迭代期，最新草案引入了 Streamable HTTP（取代旧的 HTTP+SSE 双连接模式）等重要改进，生产可用性更高。追踪最新草案可以避免未来大规模迁移成本。实现时以接口抽象隔离传输层，即使协议再次更新也只需替换传输层实现。

- [ ] MCP 客户端连接管理：
  - `stdio` 传输（本地进程 MCP Server，最稳定）
  - `Streamable HTTP` 传输（最新草案推荐，单连接双向流）
  - `HTTP SSE` 传输（兼容旧版 2024-11 Server）
- [ ] 工具发现：连接后自动拉取 MCP Server 暴露的工具列表
- [ ] 工具调用代理：将标准 `Tool.execute()` 调用转为 MCP 协议报文发出，结果回包解析
- [ ] MCP Server 注册中心：管理多个 MCP Server 的连接生命周期（连接 / 重连 / 断开）
- [ ] MCP Server 内置实现（框架自带）：
  - [ ] `FileSystemMCPServer`：文件读写、目录遍历、搜索
  - [ ] `BrowserMCPServer`：网页抓取、截图（可选，按需引入）

#### 2.2.3 Skill 框架（`lib/skill`）

Skill 是比 MCP Tool 更高层的封装，代表一类有业务语义的能力组合。

- [ ] 定义 `Skill` 接口：`{ name, description, tools: Tool[], systemPromptAddition? }`
  - 一个 Skill 可包含多个工具，并可附加特定领域的 System Prompt 片段
- [ ] Skill 注册中心：`SkillRegistry.register(skill)` / `SkillRegistry.get(name)`
- [ ] Skill 动态加载：支持从目录扫描加载 Skill 插件（Node.js 动态 require）
- [ ] Skill 与 Agent 的绑定：`agent.useSkill(skill)` 将 Skill 的工具注入 Agent 可用工具列表
- [ ] 内置 Skill 集合：
  - [ ] `WebSearchSkill`：网络搜索（工具：`search_web` / `fetch_url`）
  - [ ] `CodeExecutionSkill`：代码执行沙箱（工具：`execute_python` / `execute_js`）——沙箱方案详见 2.3.5
  - [ ] `KnowledgeBaseSkill`：知识库检索（接口预留，实现在第三层）

#### 2.2.4 工具注册与路由（`core/tool-registry`）

Agent 运行时的工具调度层，把上面的 MCP 工具和 Skill 工具统一管理。

- [ ] `ToolRegistry`：统一注册来自 MCP / Skill / 直接注册的工具
- [ ] 工具去重与命名冲突解决（namespace 前缀）
- [ ] Agent 执行时自动将 `ToolRegistry` 中的工具 schema 列表注入到 LLM 请求的 `tools` 字段
- [ ] `onToolCall` 回调实现：根据工具名路由到对应实现执行

---

### 2.3 第三层：服务化与工程能力层

**前提**：第二层全部完成并通过测试。

**职责**：将第一、二层的能力包装为可独立部署的服务，提供对外 HTTP/WebSocket 接口，同时补全持久化、可观测性、鉴权等工程能力。此层完成后，Agent 系统可以被任何 HTTP 客户端（桌面应用、Web、CLI）调用。

**完成标志**：启动服务后，通过 HTTP 接口可以创建会话、驱动单个 Agent 完成多步工具调用任务，对话历史可持久化，请求链路可追踪。

---

#### 2.3.1 服务框架（`server/`）

- [ ] Hono 应用初始化，注册全局中间件：
  - 请求日志（method / path / duration / status）
  - 统一错误处理（映射 LLMError 等到 HTTP 状态码）
  - 请求 ID 注入（traceId）
  - CORS 配置
- [ ] WebSocket 支持（流式 Agent 输出推送）
- [ ] 健康检查接口：`GET /health`
- [ ] 进程优雅退出：`SIGTERM` 信号处理，等待进行中的请求完成

#### 2.3.2 持久化层（`server/db`）

- [ ] SQLite（`better-sqlite3`）集成，数据库文件路径可配置
- [ ] Schema 定义与迁移管理（`drizzle-orm` 或手写迁移脚本）
- [ ] 核心数据表：

  | 表名                     | 主要字段                                                                                                        | 说明                                  |
  | ------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
  | `sessions`               | id, agent_id, **session_type, initiator_id, task_id**, created_at                                               | 补充会话类型与发起方（见 2.1.7）      |
  | `messages`               | id, session_id, role, content, tool_calls, created_at                                                           | 按 session_id 严格隔离                |
  | `agent_run_traces`       | id, trace_id, task_id, session_id, agent_id, steps JSON, total_tokens, duration_ms, status, created_at          | 完整推理轨迹，替代原 agent_traces     |
  | `memory_entries`         | id, agent_id, content, embedding vector, created_at                                                             | 长期记忆，按 agent_id 跨 session 共享 |
  | `tasks`                  | id, type, status, progress JSON, triggered_by, task_id, parent_task_id, created_at, started_at, ended_at, error | 通用任务表（见 2.3.5）                |
  | `scheduled_task_configs` | id, name, cron_expression, task_template JSON, enabled, last_run_at, next_run_at                                | 定时任务配置（见 2.3.5）              |

- [ ] 向量存储（见 2.3.7）
- [ ] 实现 `SQLiteMemoryStore`，满足第一层定义的 `MemoryStore` 接口

#### 2.3.3 核心 API 路由（`server/routes/`）

**对话 API**（`/api/chat`）

- [ ] `POST /api/sessions`：创建会话（指定 Agent 配置）
- [ ] `GET /api/sessions`：会话列表
- [ ] `DELETE /api/sessions/:id`：删除会话
- [ ] `POST /api/sessions/:id/messages`：向会话发送消息，触发 Agent 推理
  - 非流式：等待结果后返回完整响应
  - 流式：`Accept: text/event-stream`，SSE 推送推理步骤和最终结果
- [ ] `GET /api/sessions/:id/messages`：获取会话消息历史

**Agent 配置 API**（`/api/agents`）

系统支持完整的 Agent 生命周期管理，用户可在运行时动态创建、编辑、启用/禁用 Agent，每个 Agent 的所有配置项均可独立调整。

**Agent 完整配置结构：**

```typescript
interface AgentConfig {
  // ── 基础身份 ──────────────────────────────────────────
  id: string
  name: string                        // 显示名称（如 "代码助手"）
  avatar?: string                     // 头像 URL 或 emoji
  description?: string                // 对外展示的能力描述（也用于 AgentScheduler 选人）

  // ── 个性与职能 ────────────────────────────────────────
  systemPrompt: string                // 核心性格 + 职能定义，支持变量占位符
  role: 'general' | 'specialist' | 'supervisor'  // general=通用, specialist=专项, supervisor=调度

  // ── LLM 配置 ─────────────────────────────────────────
  provider: 'openai' | 'anthropic' | 'ollama' | 'custom'
  model: string                       // 如 'gpt-4o', 'claude-3-5-sonnet-20241022'
  temperature?: number                // 0-2，控制回答随机性
  maxTokens?: number                  // 单次回复上限
  maxSteps?: number                   // ReAct 循环最大步数，防无限循环

  // ── 能力开关（Skill + MCP + 插件）────────────────────
  skills: string[]                    // 启用的 Skill 名称列表，如 ['WebSearchSkill', 'CodeExecutionSkill']
  mcpServers: string[]                // 关联的 MCP Server ID 列表
  plugins: string[]                   // 启用的生命周期插件，如 ['ContentFilterPlugin']

  // ── 记忆行为 ─────────────────────────────────────────
  memoryEnabled: boolean              // 是否启用长期记忆
  ragEnabled: boolean                 // 是否在推理前自动检索知识库
  ragKnowledgeBases?: string[]        // 指定可访问的知识库 ID（空表示全部）

  // ── 运行时控制 ───────────────────────────────────────
  enabled: boolean                    // 是否对外可用
  isBuiltIn: boolean                  // 内置 Agent 不可删除，只可禁用
  createdBy: string                   // 创建者 userId
  createdAt: number
  updatedAt: number
}
```

- [ ] `GET /api/agents`：获取可用 Agent 列表（含 Skill、工具清单、`role` 类型）
- [ ] `GET /api/agents/:id`：获取单个 Agent 完整配置详情
- [ ] `POST /api/agents`：动态创建 Agent（传入完整 `AgentConfig`，`isBuiltIn` 默认 false）
- [ ] `PUT /api/agents/:id`：更新 Agent 配置（支持部分更新，`systemPrompt` / Skill / MCP / 插件均可热更新）
- [ ] `DELETE /api/agents/:id`：删除 Agent（`isBuiltIn=true` 的不可删除）
- [ ] `POST /api/agents/:id/enable` / `disable`：启用 / 禁用 Agent

**工具与 MCP API**（`/api/tools`）

- [ ] `GET /api/tools`：列出所有已注册工具（含来源：MCP / Skill / 内置）
- [ ] `GET /api/mcp/servers`：已连接的 MCP Server 列表及状态
- [ ] `POST /api/mcp/servers`：新增 MCP Server 连接
- [ ] `DELETE /api/mcp/servers/:id`：断开 MCP Server

**知识库 API**（`/api/knowledge`）

- [ ] `POST /api/knowledge/import`：导入文件，触发解析 → 分块 → 向量化 → 入库
- [ ] `POST /api/knowledge/search`：语义搜索
- [ ] `GET /api/knowledge`：知识条目列表
- [ ] `DELETE /api/knowledge/:id`：删除条目
- [ ] 实现 `KnowledgeBaseSkill`（第二层预留接口的真正实现）

#### 2.3.4 日志与可观测性系统（`server/observability`）

系统中存在多种截然不同的"日志"，混在一起输出会极大增加排查难度。按职责拆分为三类，各自独立存储和查询：

**三类日志的职责划分：**

| 类型                          | 内容                                                                 | 存储目的地              | 查询场景                  |
| ----------------------------- | -------------------------------------------------------------------- | ----------------------- | ------------------------- |
| **系统日志**（System Log）    | HTTP 请求、启动/关闭、中间件错误、配置加载                           | stdout + 本地文件       | 运维监控、进程级排查      |
| **会话日志**（Session Log）   | 用户消息、AI 回复、发送给 LLM 的完整 Prompt                          | `messages` 表（SQLite） | 复现用户对话、审查内容    |
| **推理轨迹日志**（Trace Log） | 每步 Thought/Action/Observation、工具调用入参/出参、Token 用量、耗时 | `agent_run_traces` 表   | 调试 Agent 行为、性能分析 |

**TraceId 串联机制：**

```
用户发送消息
  → 生成 traceId（nanoid，如 trc_8x2kq）
    → 所有系统日志打印 traceId
    → Agent 推理循环全程携带 traceId
    → agent_run_traces 表按 traceId 查询整条链路
    → 若为多 Agent 任务，taskId 关联多个 traceId
```

**关联键层级（从大到小）：**
```
taskId          ← 一个用户目标（可含多个 Agent 运行）
  └─ traceId    ← 一次 Agent run() 调用
       └─ stepIndex  ← ReAct 循环内的第 N 步
```

**日志库选型：`pino`**（Node.js 生态性能最佳的结构化日志库）

```typescript
// 系统日志：pino 多目的地输出
const logger = pino({
  transport: {
    targets: [
      // 开发环境：终端可读格式
      { target: 'pino-pretty', level: 'debug', options: { colorize: true } },
      // 生产环境：写文件（按日轮转）
      { target: 'pino-roll', level: 'info', options: { file: './logs/system.log', frequency: 'daily' } },
    ]
  }
})
```

- [ ] 集成 `pino`，区分 development（pino-pretty 终端输出）/ production（写文件）两种输出模式
- [ ] HTTP 请求中间件：自动注入 `traceId`（每个请求生成，写入响应头 `X-Trace-Id`）
- [ ] 系统日志字段规范：所有日志必须包含 `{ traceId, sessionId, agentId, taskId, level, timestamp, msg }`
- [ ] 实现 `TraceLoggerPlugin`（`AgentLifecycleHooks` 实现）：
  - `onRunStart`：记录推理开始，写入 `traceId` / `agentId` / `sessionId`
  - `onAfterLLMCall`：记录每步 LLM 调用的完整 messages（入参）和 response（出参）、token 用量、耗时
  - `onAfterToolCall`：记录工具名、入参、出参、耗时
  - `onRunEnd` / `onRunError`：写入 `agent_run_traces` 表，状态为 success/error
- [ ] 推理轨迹查询 API：`GET /api/sessions/:id/traces`（返回该 session 下所有推理轨迹）
- [ ] 推理轨迹查询 API：`GET /api/traces/:traceId`（返回单条推理轨迹的完整步骤）
- [ ] 关键指标采集（内存计数器，Prometheus 格式 `/metrics` 暴露）：
  - `llm_request_total`（按 provider / model 分类）
  - `llm_latency_ms`（P50 / P95 / P99）
  - `tool_call_total`（按工具名分类）
  - `agent_steps_per_run`
  - `task_total`（按 type / status 分类）
- [ ] 慢推理告警：单次 Agent 执行超过阈值（可配置，默认 30s）时打印 WARN 日志

#### 2.3.5 统一任务基础设施（`server/task`）

系统中存在多种异步过程——单次 Agent 推理、多 Agent 协作任务、知识库导入、定时触发的任意任务——原先只有多 Agent 协作被抽象成"任务"，其余均为无状态的同步调用，出问题无法追踪进度。此层将"任务"提升为通用基础设施，所有需要追踪状态和进度的异步过程都走统一机制。

> **为什么从第四层下移到第三层？**
>
> 任务的基础数据结构（状态机、进度上报、持久化）与多 Agent 协作逻辑是两件事。前者是纯工程能力，在单 Agent 场景（如一次长时间知识库导入）就需要；后者才是第四层的业务逻辑。把基础设施放在第三层，第四层的多 Agent 任务只是在此之上叠加协作逻辑，不重复造轮子。

**任务类型（都基于 `BaseTask` 扩展）：**

| 任务类型              | 触发方式                        | 典型用途                |
| --------------------- | ------------------------------- | ----------------------- |
| `AgentRunTask`        | 用户发消息 / 内部调用           | 单次 Agent 推理执行     |
| `KnowledgeImportTask` | `POST /api/knowledge/import`    | 文件解析 + 向量化入库   |
| `MultiAgentTask`      | `POST /api/tasks`（第四层扩展） | 多 Agent 协作（见 2.4） |
| `ScheduledTask`       | cron 表达式触发                 | 定时执行任意 task       |

**核心数据结构：**

```typescript
interface BaseTask {
  id: string
  type: TaskType
  status: 'PENDING' | 'RUNNING' | 'PAUSED' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'
  progress: {
    percent: number          // 0-100
    currentStep: string      // 当前阶段描述（人类可读）
    steps?: Array<{ name: string; status: 'pending' | 'running' | 'done' | 'failed' }>
  }
  triggeredBy: string        // userId / agentId / 'scheduler'
  createdAt: number
  startedAt?: number
  endedAt?: number
  error?: string
}

// 定时任务配置（持久化，应用重启后恢复）
interface ScheduledTaskConfig {
  id: string
  name: string
  cronExpression: string     // 标准 cron，如 "0 9 * * *" = 每天9点
  taskTemplate: object       // 触发时创建的任务配置
  enabled: boolean
  lastRunAt?: number
  nextRunAt?: number
}
```

**TaskId 与 TraceId 的关联关系：**

```
taskId: task_abc          ← 一个用户目标或定时触发
  ├─ traceId: trc_001     ← SubAgent-1 的一次推理（可多次）
  ├─ traceId: trc_002     ← SubAgent-2 的一次推理
  └─ traceId: trc_003     ← SubAgent-3 的一次推理
```

单次 Agent 推理也会生成 `AgentRunTask`（轻量），便于用户在任务中心看到"这次回复为什么慢"。

**与 Hook 系统的集成：**
`TaskProgressPlugin` 实现 `onProgressUpdate` hook，Agent 推理循环每步结束时触发，插件将进度写入 `tasks` 表，`TaskEventBus` 发布事件，WebSocket 推送到前端。核心推理代码不感知任务系统的存在。

- [ ] 定义 `BaseTask` 数据结构和 `TaskStatus` 状态机
- [ ] 实现 `TaskRunner`：提交任务、管理并发上限（防止 LLM API 限流）、任务排队
- [ ] 实现 `TaskStore`（SQLite）：任务 CRUD + 进度更新
- [ ] 实现 `TaskEventBus`：状态变更时发布事件（对接 WebSocket 推送）
- [ ] 实现 `TaskScheduler`（`node-cron`）：
  - 应用启动时从 `scheduled_task_configs` 表恢复所有 cron job
  - 支持动态增删定时任务（不重启应用）
  - 定时任务触发时通过 `TaskRunner` 创建对应类型任务
- [ ] 实现 `TaskProgressPlugin`（`AgentLifecycleHooks` 实现）：将 `onProgressUpdate` 写入任务进度
- [ ] 任务相关 API：
  - `GET /api/tasks`：任务列表（支持按 type / status / triggeredBy 过滤）
  - `GET /api/tasks/:id`：任务详情（含进度、关联 traceId 列表）
  - `POST /api/tasks/:id/cancel`：取消任务
  - `GET /api/scheduled-tasks`：定时任务配置列表
  - `POST /api/scheduled-tasks`：新增定时任务
  - `PUT /api/scheduled-tasks/:id`：更新（含启用/禁用）
  - `DELETE /api/scheduled-tasks/:id`：删除
  - WebSocket：`/ws/tasks/:id` 实时订阅任务状态变更

#### 2.3.6 代码执行沙箱（`server/sandbox`）

`CodeExecutionSkill` 允许 Agent 执行任意代码，若不隔离则任意代码都可访问宿主机文件系统和网络，存在严重安全风险。沙箱的职责是**将代码执行限制在一个受控的隔离环境中**。

> **三种沙箱方案对比**
>
> | 方案 | 隔离强度 | 实现复杂度 | 适用场景 |
> |---|---|---|---|
> | **Node.js `vm` 模块** | 低 | 低 | 只隔离 JS，无法防止 `require('fs')` 等系统调用，不推荐用于生产 |
> | **Docker 容器** | 高 | 中 | 每次执行启动独立容器（或复用容器池），完全隔离文件系统、网络、进程。例：`docker run --rm --network none --memory 256m python:3.11 python -c "print(1+1)"` |
> | **WebAssembly（WASM）** | 中 | 高 | 代码在 WASM 虚拟机内运行，无法访问宿主 API，但支持的语言有限，Python 支持不成熟 |
>
> **决策：采用 Docker 容器方案**
> - 隔离最彻底：文件系统、网络、进程、内存全部独立
> - 支持任意语言（Python / JS / Shell 等），只需准备对应镜像
> - 超时强制终止：`docker run --rm --timeout 30s`
> - 预热容器池可降低冷启动延迟（复用已就绪的容器，执行完后 reset 状态）
>
> **执行示例（用户让 Agent 计算斐波那契数列）：**
> 1. Agent 决定调用 `execute_python` 工具，传入代码字符串
> 2. `CodeExecutionSkill` 将代码写入临时文件，挂载到容器内 `/sandbox/code.py`
> 3. `docker run --rm --network none --memory 256m --cpus 0.5 python:3.11 python /sandbox/code.py`
> 4. 捕获 stdout/stderr，30 秒超时强制 kill
> 5. 返回执行结果（输出文本）给 Agent

- [ ] Docker 容器池管理（预热 N 个 Python/JS 容器，执行完后销毁重建）
- [ ] 容器资源限制配置（内存 / CPU / 超时 / 禁止网络访问）
- [ ] 临时文件挂载与清理
- [ ] 执行结果截断（防止超长输出撑爆 LLM 上下文）

#### 2.3.7 可插拔向量存储（`lib/vector-store`）

向量存储与 LLM Provider 采用同样的接口抽象设计：上层只依赖 `VectorStore` 接口，底层实现可按需替换——本地部署用 LanceDB，有独立服务的场景可切换到 Qdrant 或 pgvector，无需改动任何业务代码。

同时，Embedding 模型也设计为可插拔：支持在线 API（OpenAI `text-embedding-3-small`）和本地模型（`nomic-embed-text` via Ollama）两种方式，通过配置切换。

```
IVectorStore（接口）
├── LanceDBVectorStore    ← 默认，纯本地文件，无需额外服务
├── QdrantVectorStore     ← 独立 Qdrant 服务，适合数据量大的场景
└── PgVectorStore         ← 复用已有 PostgreSQL，适合服务端部署

IEmbeddingProvider（接口）
├── OpenAIEmbeddingProvider   ← 在线，效果好，有成本
└── OllamaEmbeddingProvider   ← 本地，零成本，需本地运行 Ollama
```

- [ ] 定义 `IVectorStore` 接口：`upsert(id, vector, metadata)` / `search(vector, topK)` / `delete(id)`
- [ ] 定义 `IEmbeddingProvider` 接口：`embed(text) -> number[]` / `batchEmbed(texts) -> number[][]`
- [ ] 实现 `LanceDBVectorStore`（默认，零配置本地运行）
- [ ] 实现 `QdrantVectorStore`（可选，需外部服务）
- [ ] 实现 `OpenAIEmbeddingProvider` 和 `OllamaEmbeddingProvider`
- [ ] `VectorStoreFactory.create(config)` 按配置实例化对应实现
- [ ] 文本分块策略（chunk size / overlap 参数化，独立于具体存储实现）

#### 2.3.8 安全与配置（`server/security`）

- [ ] API Key 鉴权中间件（服务端 key，区别于 LLM Provider Key）
- [ ] LLM Provider API Key 安全存储（操作系统 Keychain 或加密本地文件）
- [ ] 请求体大小限制
- [ ] 配置中心：支持环境变量 / `.env` 文件 / 运行时动态配置，统一 `Config` 对象访问

---

### 2.4 第四层：多 Agent 协作层

**前提**：第三层全部完成，服务化能力稳定。

**职责**：在单 Agent 能力的基础上，构建多个 Agent 协作执行复杂任务的调度系统。此层完成后，系统可以将一个复合目标自动分解，由多个专项 Agent 并行或串行完成。

**完成标志**：用户发布一个需要多步骤、多角色协作才能完成的任务，AgentScheduler 能自动规划并驱动多个 Agent 完成，中途可查看各子任务状态，任何子任务失败可重试。

---

#### 2.4.1 多 Agent 任务模型（`core/multi-agent-task`）

> 任务的通用基础设施（`BaseTask` 数据结构、状态机、进度上报、`TaskRunner`、`TaskScheduler`、WebSocket 推送）已在第三层（2.3.5）统一实现。本层只定义多 Agent 协作场景**专有**的数据结构，扩展自第三层的 `BaseTask`。

**多 Agent 任务专有字段：**

```typescript
interface MultiAgentTask extends BaseTask {
  type: 'multi_agent'
  goal: string                   // 用户原始目标描述
  planningTraceId?: string       // Planner Agent 的推理 traceId
  subTasks: SubTask[]
}

interface SubTask {
  id: string
  parentTaskId: string
  assignedAgentId: string
  input: object
  output?: object
  status: TaskStatus
  traceId?: string               // 对应的 AgentRunTrace
  dependsOn: string[]            // 依赖的其他 SubTask id（DAG 边）
}
```

- [ ] 定义 `MultiAgentTask` 和 `SubTask` 数据结构，扩展第三层 `BaseTask`
- [ ] DB Schema 新增 `sub_tasks` 表（tasks 表已在第三层建立）
- [ ] `SubTask` 状态变更通过第三层 `TaskEventBus` 发布事件

#### 2.4.2 SupervisorAgent 与 AgentScheduler（`core/scheduler`）

> **AgentScheduler vs Orchestrator——为什么改名？**
>
> "Orchestrator"（编排器）在分布式系统中通常指一个**中心化的权威控制节点**，它掌握全局视图并直接发号施令，类比"乐团指挥"。这个比喻在多 Agent 场景中有一个隐患：它暗示存在一个"万能的"中心节点负责一切，容易让模块边界模糊。
>
> "Scheduler"（调度器）更精准地描述了这个组件的实际职责：**接收任务 → 生成执行计划 → 按依赖关系分配给各 Agent → 监控执行状态 → 收集结果**。调度器只关心"谁在什么时候做什么"，不参与具体的推理过程，边界清晰。类比操作系统的进程调度器：它决定哪个进程何时运行，但不关心进程内部做了什么。

**SupervisorAgent：可对话的调度入口**

用户既可以直接和某个专项 Agent 对话（一对一），也可以和 `SupervisorAgent` 对话，由它决定是直接回答还是拆解分配——就像公司里既可以找同事直聊，也可以找老板派活。

> **为什么 SupervisorAgent 本身也是一个 Agent？**
>
> AgentScheduler 是纯粹的调度逻辑（程序代码），它不能"被聊天"。如果把调度智能也封装成一个 Agent（叫 SupervisorAgent，`role: 'supervisor'`），它就拥有独立的 `agentId`，用户可以与它开 Session，它的 System Prompt 包含所有下属 Agent 的能力描述，它通过自身的 ReAct 推理判断是直接回答还是调用 AgentScheduler 触发多 Agent 任务。这样调度能力就自然融入了统一的对话体验，不需要额外的交互模式。

**多入口对话模型：**

```
用户
├─ 直接与 Agent-A（代码助手）对话  ← 一对一，创建 sessionType='user_conversation'
├─ 直接与 Agent-B（研究员）对话    ← 一对一，创建 sessionType='user_conversation'
└─ 与 SupervisorAgent 对话         ← 由 Supervisor 判断是否需要分配子任务
     ├─ 简单问题 → SupervisorAgent 自己回答
     └─ 复杂任务 → 调用 AgentScheduler → 分解 → 分配给 Agent-A / Agent-B 并行执行
```

**Session 与 Agent 的多对多关系：**
- 用户可以同时与多个 Agent 维护独立的对话历史（各自的 Session）
- 同一个 Agent 可以被多个用户同时对话（Session 隔离保证互不干扰）
- SupervisorAgent 发起的子任务会创建 `sessionType='agent_task'` 的内部 Session，不出现在用户的对话列表里

**AgentScheduler 调度引擎（由 SupervisorAgent 调用）：**

- [ ] **SupervisorAgent** 实例化为 `role: 'supervisor'` 的特殊 Agent，内置一个系统级别的 `agentId`（如 `agent_supervisor`）
  - System Prompt 动态注入当前所有 `enabled=true` 的 Agent 清单及其 `description`
  - 推理时判断：直接回答 vs 触发 AgentScheduler
- [ ] **Supervisor 模式**：SupervisorAgent 分析目标，输出子任务列表和 Agent 分配方案
  - 输出格式：结构化 JSON（子任务列表、依赖关系、分配 Agent）
- [ ] **Plan-and-Execute 模式**：先用 Planner Agent 生成完整计划，再逐步执行
  - 适合需要前置规划的长任务
- [ ] 子任务依赖图（DAG）解析：提取并行与串行关系
- [ ] 子任务调度：
  - 无依赖的子任务并发执行
  - 有依赖的子任务等待前置完成后触发
  - 并发度可配置（防止 LLM API 限流）
- [ ] 全局任务上下文共享：子任务结果可被后续子任务读取
- [ ] 子任务失败处理：重试策略 / 降级策略 / 失败后停止整个任务（可配置）
- [ ] SupervisorAgent 的对话 Session 中可实时查看子任务进度（WebSocket 推送，嵌入对话流）

#### 2.4.3 Agent 间通信协议（`core/messaging`）

> **消息总线的适用边界——不是所有通信都走总线**
>
> 消息总线解决的核心问题是**解耦**：发送方不需要知道接收方在哪，甚至不需要接收方此刻存在。它在以下场景有价值：
> 1. **一个事件多个订阅者**：AgentScheduler 完成子任务后，日志系统、进度追踪、下一个 Agent 都需要知道
> 2. **跨 Agent 的异步通知**：Agent A 完成后异步通知 Agent B 继续，不需要 A 等待 B 的结果
>
> **不应该走总线的场景：** 子任务结果的同步回传（AgentScheduler 直接收集返回值更清晰）、工具调用（同步调用，有明确的调用方和被调用方）。过度使用总线会让数据流向难以追踪。
>
> **原则：同步有直接依赖关系的调用走函数调用；跨 Agent 的异步事件通知走总线。**

- [ ] 定义 Agent 消息格式：`AgentMessage = { from, to, type, payload, correlationId, timestamp }`
- [ ] 消息类型：
  - `TASK_ASSIGN`：AgentScheduler 向 Agent 分配子任务
  - `TASK_RESULT`：Agent 向 AgentScheduler 返回子任务结果
  - `STATUS_UPDATE`：Agent 推送执行状态（监控订阅）
  - `QUERY` / `RESPONSE`：Agent 向其他 Agent 发起查询（结果互相引用）
- [ ] 实现内存消息总线（`InMemoryMessageBus`）：发布 / 订阅模式，同一进程内使用
- [ ] 消息总线与第三层 `TaskEventBus` 的关系：`TaskEventBus` 是任务状态事件专用（供 WebSocket 消费），`InMemoryMessageBus` 是 Agent 间业务消息通道，两者职责不同，不合并

#### 2.4.4 共享记忆与任务上下文（`core/shared-memory`）

- [ ] `TaskContext`：任务执行期间所有 Agent 共享的键值空间
  - `set(key, value)` / `get(key)` / `list()`
  - 变更日志：记录是哪个 Agent 在何时写入什么值
- [ ] 跨 Agent 长期记忆共享策略：
  - Agent 执行完成后，将关键结论写入长期记忆
  - 其他 Agent 在执行前检索相关记忆注入上下文

#### 2.4.5 多 Agent 任务 API 扩展（`server/routes/multi-agent`）

> 任务的通用 API（列表、详情、取消、WebSocket 推送、定时任务 CRUD）已在第三层（2.3.5）实现。本层只补充多 Agent 协作**专有**的 API。

- [ ] `POST /api/tasks`：发布多 Agent 任务目标，触发 AgentScheduler 规划（在第三层 `TaskRunner` 上扩展）
- [ ] `GET /api/tasks/:id/subtasks`：获取子任务列表（含各 Agent 分配情况、依赖关系 DAG）
- [ ] `GET /api/tasks/:id/plan`：获取 Planner Agent 的规划结果（目标分解方案）
- [ ] `GET /api/tasks/:id/trace`：完整执行轨迹（规划 traceId + 所有 SubTask 的 traceId 汇总）

---

### 2.5 第五层：特化场景与智能进化层

**前提**：第四层全部完成，多 Agent 协作链路稳定。

**职责**：在通用框架之上构建垂直场景特化能力，以及让 Agent 自我改进的进化机制。此层是产品差异化所在，依赖下面四层提供的完整基础设施。

**完成标志**：特定垂直场景 Agent 显著优于通用 Agent；Agent 能从历史执行中学习并改进自身行为。

---

#### 2.5.1 垂直场景 Agent（`agents/specialized/`）

> 每个特化 Agent 继承通用 Agent 基类，叠加垂直 Skill 和专属 Prompt 策略。

| Agent              | 专属能力                           | 关键 Skill                              |
| ------------------ | ---------------------------------- | --------------------------------------- |
| **代码助手 Agent** | 多文件代码理解、架构分析、测试生成 | `CodeExecutionSkill` + 代码检索 Skill   |
| **研究员 Agent**   | 多源信息聚合、观点对比、报告生成   | `WebSearchSkill` + `KnowledgeBaseSkill` |
| **数据分析 Agent** | 结构化数据处理、图表生成、统计分析 | `CodeExecutionSkill` + 数据库 Skill     |
| **写作助手 Agent** | 长文创作、风格迁移、内容审查       | `KnowledgeBaseSkill` + 文档工具         |

- [ ] 实现以上 Agent 角色的专属 System Prompt 模板（可动态参数注入）
- [ ] 每个 Agent 的默认 Skill 组合配置
- [ ] Agent 能力评估基准（针对垂直场景的评测集）

#### 2.5.2 自我反思机制（`core/reflection`）

让 Agent 在完成任务后对自身执行质量进行反思并生成改进建议。

- [ ] `ReflectionModule`：任务完成后，使用 LLM 对执行轨迹进行自我评估
  - 输入：完整的 `AgentTrace`（每一步的 Thought / Action / Observation）
  - 输出：`ReflectionResult = { rating, bottleneck, improvementSuggestions }`
- [ ] 反思结果持久化（新增 `reflections` 表）
- [ ] 将高评分的执行轨迹标记为"优质样本"，低评分的标记为"待改进"

#### 2.5.3 Prompt 自进化（`core/prompt-evolution`）

基于反思结果和用户反馈，自动优化 Agent 的 System Prompt。

> **什么是 Prompt 版本管理？**
>
> Agent 的行为由 System Prompt 决定（类比软件的"配置文件"）。随着用户使用，我们会发现某些场景 Agent 表现不好，需要修改 Prompt。如果直接覆盖旧版本，就无法回退，也无法对比哪个版本更好。
>
> Prompt 版本管理的核心是：**把每一次 Prompt 修改都当作一次"代码提交"来对待**。
>
> 具体来说：
> - 每个版本有唯一 ID、创建时间、修改原因（"用户反馈回答太啰嗦" / "反思模块建议增加步骤拆解"）
> - 可以随时回滚到任意历史版本
> - 可以同时运行 A/B 两个版本，各承接 50% 流量，统计哪个版本的用户满意度更高，再决定升级
>
> **示例：**
> ```
> prompt_versions 表
> ─────────────────────────────────────────────────────────────
> id  | agent_id | version | content           | created_at | reason
> ----+----------+---------+-------------------+------------+---------------------------
> 1   | code-001 | v1.0    | "你是一个代码助手..." | 2026-03-01 | 初始版本
> 2   | code-001 | v1.1    | "你是一个代码助手，回答时先分析再给出代码..." | 2026-03-15 | 反思模块：步骤拆解不清晰
> 3   | code-001 | v1.2    | "你是一个代码助手，..."  | 2026-03-28 | 用户反馈：代码注释太少
> ─────────────────────────────────────────────────────────────
> 当前生效版本：v1.2（回滚只需改一个配置项）
> ```
>
> 是否对接 Langfuse 等外部平台？**两者同时支持**：本地版本管理表永远存在，可选集成 Langfuse 获得更强的实验分析和可视化能力（Langfuse 支持 Prompt 版本管理、A/B 实验追踪、效果指标看板）。

- [ ] 反馈收集：
  - 显式：用户对 Agent 回复的点赞 / 踩 / 文字评价
  - 隐式：用户是否对回复进行了编辑修改，是否重新提问
- [ ] Prompt 版本管理：每个 Prompt 版本独立存储，带创建时间和触发原因（本地 DB）
- [ ] 可选对接 Langfuse：将版本和实验数据同步到 Langfuse，利用其可视化分析能力
- [ ] 基于 LLM 的 Prompt 优化器：
  - 输入：当前 Prompt + 失败样本 + 用户反馈
  - 输出：优化后的 Prompt（附说明）
- [ ] A/B 实验框架：新旧 Prompt 版本分流，统计效果指标后决定是否升级
- [ ] Prompt 回滚机制：一键切换回任意历史版本

#### 2.5.4 Fine-tuning 数据流水线（`core/finetuning-pipeline`）（可选）

为后续 Fine-tuning 本地/私有模型提供数据准备能力。

- [ ] 优质样本自动提取（来自"优质样本"标记的轨迹）
- [ ] 数据清洗与格式化（转换为各模型微调所需的数据格式：JSONL / ShareGPT 等）
- [ ] 数据脱敏处理（移除用户个人信息）
- [ ] 数据导出接口：`GET /api/training-data/export`（管理员权限）

---

## 4. 工程规范

### 4.1 目录结构

```
.
├── packages/
│   ├── lib/
│   │   ├── llm/             # LLM 接口 + 多 Provider 实现
│   │   ├── context/         # 上下文窗口管理
│   │   ├── tool/            # 工具定义规范
│   │   ├── mcp/             # MCP 协议客户端
│   │   ├── skill/           # Skill 框架 + 内置 Skill
│   │   └── vector-store/    # 可插拔向量存储接口 + 实现
│   ├── core/
│   │   ├── agent/           # Agent 推理核心（自研 ReAct）
│   │   │   └── lifecycle/   # AgentLifecycleHooks 接口 + ContextBuilder（★新增）
│   │   ├── session/         # 会话隔离 + SessionRegistry（★新增）
│   │   ├── memory/          # 记忆系统（含 MemoryContributorPlugin）
│   │   ├── tool-registry/   # 工具注册与路由
│   │   ├── scheduler/       # 多 Agent 调度（AgentScheduler）
│   │   ├── multi-agent-task/# MultiAgentTask + SubTask 数据结构（★重命名）
│   │   ├── messaging/       # Agent 间通信（InMemoryMessageBus）
│   │   └── reflection/      # 自我反思 + Prompt 进化
│   ├── agents/
│   │   ├── definitions/     # Agent 角色定义（Prompt + Skill 组合）
│   │   └── specialized/     # 垂直场景特化 Agent
│   └── server/
│       ├── routes/          # HTTP 路由（按领域拆分）
│       │   ├── chat/        # 对话 API
│       │   ├── agents/      # Agent 配置 API
│       │   ├── knowledge/   # 知识库 API
│       │   ├── tools/       # 工具与 MCP API
│       │   ├── tasks/       # 通用任务 API（★新增）
│       │   ├── scheduled-tasks/ # 定时任务配置 API（★新增）
│       │   └── multi-agent/ # 多 Agent 协作专有 API
│       ├── db/              # 持久化层（SQLite + drizzle-orm）
│       ├── task/            # 统一任务基础设施（TaskRunner/Store/EventBus/Scheduler）（★新增）
│       ├── sandbox/         # 代码执行沙箱（Docker）
│       ├── ws/              # WebSocket 处理
│       ├── security/        # 鉴权 + 配置中心
│       └── observability/   # 结构化日志（pino）+ 指标 + TraceLoggerPlugin（★大幅扩充）
├── pnpm-workspace.yaml
└── package.json
```

### 4.2 层间依赖规则

| 包         | 允许依赖                        | 禁止依赖                        |
| ---------- | ------------------------------- | ------------------------------- |
| `lib/*`    | 无（纯工具库）                  | `core/` / `agents/` / `server/` |
| `core/*`   | `lib/*`                         | `agents/` / `server/`           |
| `agents/*` | `lib/*` / `core/*`              | `server/`                       |
| `server/*` | `lib/*` / `core/*` / `agents/*` | 无限制                          |

CI 阶段通过 `dependency-cruiser` 自动校验，违反层间依赖规则的 PR 直接阻断合并。

### 4.3 测试分层策略

| 测试类型 | 工具         | 适用层                        | 覆盖目标                              |
| -------- | ------------ | ----------------------------- | ------------------------------------- |
| 单元测试 | Vitest       | `lib/*` / `core/*`            | > 85%，LLM 调用全部 Mock              |
| 集成测试 | Vitest       | `server/*` / `core/scheduler` | 核心 API 契约，Mock 外部依赖          |
| E2E 测试 | 自研脚本     | 全链路                        | 关键用户场景，真实 LLM 调用           |
| 性能基准 | `autocannon` | `server/*`                    | 并发对话 P99 < 200ms（不含 LLM 耗时） |
|          |

---

*文档由 CatPaw 生成，待 Review 后迭代更新*
