# v2 L1 Core Runtime 设计

> **状态**：🔍 探索中
> **说明**：本文档记录 L1 Core 的设计思考，尚未冻结。冻结后将成为 v2 的权威 contract。

---

## 一、L1 的职责边界

L1 Core Runtime 是系统的最底层。它负责：

- **Agent 运行时**：`TheWorldAgent` — 一个可运行的智能体
- **Session 管理**：会话的创建、查找、生命周期
- **RunEngine**：一次 `run()` 的完整执行循环
- **Context 管理**：prompt 的组装、压缩、记忆注入
- **Tool Runtime**：工具的注册、发现、执行
- **Hook 系统**：生命周期钩子，供上层扩展

L1 **不负责**：
- HTTP 服务
- 持久化（只提供 `MemoryPort` 接口）
- 权限产品面（只提供 `PermissionHook` 接口）
- 客户端 UI
- 多 Agent 编排

---

## 二、当前 v1 的 L1 实现回顾

v1 的 L1 经过 007-012 的验证，已经证明了以下核心能力：

```typescript
// v1 核心对象
class TheWorldAgent {
  createSession(session: Session): void
  getSession(sessionId: string): Session | undefined
  run(sessionId: string, userText: string, options?: RunOptions): Promise<AgentResult>
}

class ReActRunEngine {
  run(args: RunArgs): Promise<AgentResult>
  // ReAct loop: LLM → tool call → execute → next step
}

class SimpleContextManager {
  buildSnapshot(state: RunState): Promise<Message[]>
  // ContextBlock: system / memory / history / recent
  // CompressionPolicy: TrimCompressionPolicy
}

interface MemoryPort {
  read(request: MemoryReadRequest): Promise<Message[]>
  write(request: MemoryWriteRequest): Promise<void>
}

interface AgentLifecycleHook {
  onBeforeToolCall?(ctx: HookContext, call: ToolCall): Promise<GuardResult<ToolCall>>
  // ... 其他钩子
}
```

v1 L1 的**验证成果**：
- ReAct loop 稳定运行
- ContextBlock 压缩策略有效
- Hook 系统可扩展
- MockLLMProvider + OpenAiCompatibleChatProvider 双 provider

v1 L1 的**不足**：
- `MemoryPort` 只有 `InMemoryMemoryPort`（Map），无持久化
- `PermissionHook` 不强制检查，只是回调
- `CompressionPolicy` 只有 Trim，无 Summarize
- `RunState` 无 background 状态

---

## 三、v2 L1 的探索方向

### 3.1 记忆系统（Memory）

**问题**：v1 的 `MemoryPort` 太简单。

```typescript
// v1: 只有 read/write
interface MemoryPort {
  read(request: MemoryReadRequest): Promise<Message[]>
  write(request: MemoryWriteRequest): Promise<void>
}
```

**v2 探索方向**：

```typescript
// v2: 分层记忆系统

interface MemoryLayer {
  kind: 'working' | 'summary' | 'long_term'
  sourceKind: 'session' | 'workspace' | 'persona' | 'skill'
  messages: Message[]
  metadata: MemoryMetadata
}

interface MemoryMetadata {
  createdAt: number
  updatedAt: number
  summaryOf?: string[]      // 指向被摘要的消息 ID
  pinned?: boolean          // 是否固定
  importance?: number       // 重要性评分（0-1）
}

interface MemoryPort {
  // 基础读写
  read(request: MemoryReadRequest): Promise<MemoryLayer[]>
  write(request: MemoryWriteRequest): Promise<void>
  
  // 分层操作
  summarize(sessionId: string, messageIds: string[]): Promise<MemoryLayer>
  pin(sessionId: string, messageId: string): Promise<void>
  unpin(sessionId: string, messageId: string): Promise<void>
  
  // 召回
  recall(query: MemoryRecallRequest): Promise<Message[]>
}

interface MemoryRecallRequest {
  sessionId: string
  query: string              // 查询文本
  limit?: number             // 返回数量
  kinds?: MemoryLayer['kind'][]  // 指定层
}
```

**待决策**：
1. `recall` 的语义是什么？关键词匹配？语义相似度？时间衰减？
2. `summarize` 由谁触发？自动（每 N 轮）？手动（/compact）？还是两者都有？
3. `long_term` 记忆的生命周期？按 session？按 workspace？全局？
4. `MemoryPort` 的实现是否应该在 L1？还是只保留接口，实现放在 L3？

**我的倾向**：
- L1 只保留 `MemoryPort` 接口
- 提供 `InMemoryMemoryPort`（默认，进程内）
- 持久化实现（`SQLiteMemoryStore`）放在 L3
- L1 通过 `MemoryPort` 接口消费，不关心实现

### 3.2 权限系统（Permission）

**问题**：v1 的 `beforeToolCall` Hook 不强制。

```typescript
// v1: Hook 返回 GuardResult，但 core 不强制检查 RiskClass
interface AgentLifecycleHook {
  onBeforeToolCall?(ctx: HookContext, call: ToolCall): Promise<GuardResult<ToolCall>>
}
```

**v2 探索方向**：

```typescript
// v2: Permission Gate

interface PermissionConfig {
  mode: 'auto' | 'confirm' | 'deny'
  defaultRiskThreshold: RiskClass
  toolOverrides: Record<string, PermissionMode>
}

type PermissionMode = 'auto' | 'confirm' | 'deny'

type RiskClass = 'safe' | 'shell_command' | 'file_mutation' | 'network' | 'destructive'

interface PermissionGate {
  check(call: ToolCall, config: PermissionConfig): Promise<PermissionCheckResult>
}

interface PermissionCheckResult {
  action: 'allow' | 'block' | 'request_approval'
  reason?: string
  approvalRequest?: ApprovalRequest
}

interface ApprovalRequest {
  id: string
  toolName: string
  riskClass: RiskClass
  toolCallArgs: Record<string, unknown>
  requestedAt: number
  ttlMs: number
}
```

**在 RunEngine 中的集成**：

```typescript
class ReActRunEngine {
  async run(args: RunArgs): Promise<AgentResult> {
    // ...
    for (const originalCall of response.toolCalls) {
      // v2 新增：权限检查（在 Hook 之前）
      const permission = await this.permissionGate.check(
        originalCall,
        args.permissionConfig ?? DEFAULT_PERMISSION_CONFIG
      )
      
      if (permission.action === 'block') {
        throw createRunError('RUN_PERMISSION_DENIED', permission.reason!, 'permission')
      }
      
      if (permission.action === 'request_approval') {
        state.status = 'awaiting_approval'
        state.approvalRequest = permission.approvalRequest
        return await this.finish(args.runtime, state)
      }
      
      // 原有 Hook 逻辑
      const toolCall = await args.runtime.hookRunner.beforeToolCall(state, originalCall)
      // ...
    }
  }
}
```

**待决策**：
1. `PermissionGate` 是否在 L1 中默认启用？还是可选？
2. `RiskClass` 的分类是否足够？是否需要可扩展？
3. `awaiting_approval` 状态的 run 如何恢复？由谁触发 resume？
4. 审批记录是否应该在 L1 中管理？还是只生成请求，管理放在 L3？

**我的倾向**：
- L1 提供 `PermissionGate` 接口和默认实现
- 默认启用（安全优先）
- 审批记录的**管理**放在 L3（持久化）
- L1 只负责生成 `ApprovalRequest` 和暂停 run

### 3.3 Context 压缩策略

**问题**：v1 只有 `TrimCompressionPolicy`（从尾部丢弃）。

**v2 探索方向**：

```typescript
// v2: 可插拔压缩策略

interface CompressionPolicy {
  fit(blocks: ContextBlock[], budget: CompressionBudget): Promise<ContextBlock[]>
}

class TrimCompressionPolicy implements CompressionPolicy {
  // v1 的原有实现：从尾部丢弃
}

class SummarizeCompressionPolicy implements CompressionPolicy {
  // 对 history 块进行摘要，而不是丢弃
  async fit(blocks: ContextBlock[], budget: CompressionBudget): Promise<ContextBlock[]> {
    // 1. 保留不可压缩块
    // 2. 对 history 块调用 LLM 摘要
    // 3. 用摘要替换原 history 块
    // 4. 如果仍然超出预算，选择性丢弃
  }
}

class SelectiveCompressionPolicy implements CompressionPolicy {
  // 根据消息重要性选择性保留
  async fit(blocks: ContextBlock[], budget: CompressionBudget): Promise<ContextBlock[]> {
    // 1. 评分每条消息的重要性
    // 2. 按重要性排序
    // 3. 在预算内保留最重要的消息
  }
}
```

**待决策**：
1. `SummarizeCompressionPolicy` 需要调用 LLM，这会增加延迟和成本。是否值得？
2. 压缩策略是否应该在 run 时动态选择？还是固定配置？
3. `ContextBlock` 是否需要更多层？比如 `skill_context`、`persona_context`？

**我的倾向**：
- 保留 `TrimCompressionPolicy` 作为默认（简单、可预测）
- `SummarizeCompressionPolicy` 作为可选策略
- 压缩策略通过 `RunOptions` 传入，可动态选择

### 3.4 Background Run

**问题**：v1 的 `executionMode: 'background'` 只是声明式字段。

**v2 探索方向**：

```typescript
// v2: Background Run 支持

interface RunOptions {
  // ... 原有字段
  executionMode?: 'foreground' | 'background'
  streamAttachment?: 'attached' | 'detached'
}

interface RunState {
  // ... 原有字段
  executionMode: 'foreground' | 'background'
  streamAttachment: 'attached' | 'detached'
}
```

**待决策**：
1. Background run 的实现是否应该在 L1？还是只标记状态，调度放在 L3？
2. Background run 的 stream 如何消费？SSE？Polling？
3. Background run 的 attach/detach 语义是什么？

**我的倾向**：
- L1 只标记 `executionMode` 和 `streamAttachment`
- Background run 的**调度**放在 L3（通过 TaskScheduler）
- Attach/detach 是 L3/L4 的产品语义

---

## 四、L1 接口冻结清单

在 v2 开始实现 L3/L4/L5 之前，L1 必须冻结以下接口：

- [ ] `AgentDefinition` — Agent 定义
- [ ] `TheWorldAgent` — Agent 运行时
- [ ] `Session` / `SessionRuntime` — 会话模型
- [ ] `RunEngine` / `ReActRunEngine` — 执行引擎
- [ ] `RunState` / `RunOptions` / `AgentResult` — Run 生命周期
- [ ] `ContextManager` / `ContextBlock` — 上下文管理
- [ ] `CompressionPolicy` — 压缩策略接口
- [ ] `MemoryPort` — 记忆端口接口
- [ ] `PermissionGate` — 权限门接口
- [ ] `AgentLifecycleHook` / `HookRunner` — 钩子系统
- [ ] `ToolRuntime` / `ToolProvider` — 工具运行时
- [ ] `LLMProvider` — LLM 提供者接口

---

## 附录 A — 与论文对齐的 L1 边界（工单 208）

- **薄主循环**：业务状态机不进 `ReActRunEngine` 内核；扩展走 `AgentLifecycleHook`、`ToolProvider`、`MemoryPort`、`CompressionPolicy`。  
- **状态外化**：会话轨迹在 `SessionRuntime.history`；跨进程事实在 `MemoryPort` / workspace 文件（见 `docs/v2/11-memory.md`）。  
- **对 LLM 载荷窄化**：`toLlmMessages` 在进入 `LLMProvider.generate` 前剥离 `frameworkMeta` 等框架字段（`packages/core/src/llm-messages.ts`）。  
- **常驻安全条款**：`SimpleContextManager` 在 system 文本末尾追加短硬安全后缀（与论文「系统不进可覆盖上下文」一致：规则由代码注入，不由用户消息改写）。

## 附录 B — Context 分层与压缩优先级（面向 LLM 的 messages）

`SimpleContextManager.buildBlocks` 产出四类块（实现见 `packages/core/src/context.ts`）：

| 块 id | 论文角色（近似） | 保护级别 | 说明 |
|-------|------------------|----------|------|
| `system` | 常驻 | immutable | Agent 定义 + 常驻安全后缀 |
| `memory` | 语义 / 会话摘要入口 | pinned | `MemoryPort.read`；注入发生在压缩策略之前参与预算 |
| `history` | 按需 / 可丢上下文 | compressible | 较早轮次；可对其中 **tool** 消息做大 JSON **占位截断**（`compactToolOutputsInMessages`） |
| `recent` | 工作记忆窗口 | pinned | 最近 `recentWindow` 条用户/助手轮次 |

**保留优先级（文档化映射）**：架构与安全相关（system 块、memory 中操作者明确写入的摘要）优先于可压缩历史；**验证状态 / TODO** 若放在用户可见文本中仍属 `history`/`recent`，由 `TrimCompressionPolicy` 按 token 预算裁剪；**大工具输出**在 `history` 中优先被占位以释放预算（相对「完整保留最近 tool」的折中，最近轮次仍在 `recent` 中完整保留）。

## 附录 C — L2 工具层在本仓库中的位置

- **内置工具**：`packages/core/src/tools/`（由 `createBuiltinToolProvider` 聚合），含路径白名单、`run_command` 工作目录约束、结构化 `ToolResult`（含 `suggestion`）。  
- **验证**：`pnpm test:tools`、`pnpm test:mcp`、`pnpm test:skills`、`pnpm test:sandbox`；架构 lint：`pnpm lint:architecture`。  
- **示例 Skills**：`workspace/skills/*/SKILL.md` 与 `list_skills` **索引级**输出（模型按需再 `read_skill` 取全文）。

---

## 五、下一步

1. 讨论并确认上述探索方向
2. 冻结 L1 接口定义（TypeScript 类型）
3. 编写 L1 验收标准（测试脚本）
4. 开始 L1 实现
