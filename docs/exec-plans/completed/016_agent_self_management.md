# 016 Agent Self-Management

## 目标

让 Agent 具备**自我管理能力**：

1. **写 Skill**：Agent 可以为自己创建新的 Skill（`write_skill` 工具）
2. **管理 MCP**：Agent 可以动态注册/卸载 MCP server，并持久化配置（`manage-mcp` Skill + `mcp-registry.json`）
3. **日志系统**：工具调用、Skill 执行、MCP 调用全链路结构化日志（文件 + `read_logs` 工具）
4. **MCP 热注册**：`InMemoryToolRuntime` 支持运行时 `registerProvider()` / `unregisterProvider()`，无需重启

本计划建立在 [`014`](./014_mcp_tool_provider.md) 和 [`015`](./015_skill_framework.md) 已完成的前提上。

---

## 背景

### 为什么需要自我管理

`015` 建立了 Skill 框架，但 Agent 只能**读取和执行**已存在的 Skill，无法：
- 在用户提供接口文档时，为自己创建新的 Skill
- 在用户提供 MCP server 信息时，动态接入新的工具源
- 查看自己做了什么（工具调用日志）

`016` 补全这三个能力，使 Agent 从"静态能力执行者"升级为"可自我扩展的 Agent"。

### MCP 热注册的意义

`014` 中 MCP provider 在 `cli.ts` 启动时 `connect()`，之后无法添加新的 MCP server（需重启）。

`016` 允许 Agent 通过 `manage-mcp` Skill 调用底层 `registerProvider()` 接口，在运行时动态接入新 MCP server，并将配置写入 `workspace/mcp-registry.json` 持久化，下次重启自动恢复。

### 日志的两个读者

| 读者 | 需求 | 方案 |
|---|---|---|
| 开发者/运维 | 结构化日志用于排查和监控 | 写入 `workspace/logs/agent-YYYY-MM-DD.log`（JSON Lines） |
| Agent 自身 | 在 ReAct 循环中回顾自己的行为 | `read_logs` 内置工具，返回最近 N 条日志 |

---

## 已冻结决策

### `write_skill` 工具

Agent 通过此工具在 `workspace/skills/` 下创建新的 Skill 目录。

```typescript
name: 'write_skill'
description: '在 workspace/skills/ 下创建或更新一个 Skill。写入 SKILL.md 后需调用 read_skill 验证，再用 run_script 测试。'
inputSchema: {
  skillId: string           // Skill 目录名，格式 [a-z0-9-]+
  skillMd: string           // SKILL.md 的完整内容（含 frontmatter）
  scripts?: Array<{
    filename: string        // 脚本文件名（相对于 skill 目录）
    content: string         // 脚本内容
  }>
}
output: {
  path: string              // 创建的 skill 目录绝对路径
  filesWritten: string[]    // 实际写入的文件列表
}
```

安全约束：
- `skillId` 只允许 `[a-z0-9-]+`（防止路径穿越）
- 所有文件写入目标必须在 `$OPENKIN_WORKSPACE_DIR/skills/<skillId>/` 内（路径校验）
- 脚本文件名不允许包含 `..` 或绝对路径
- 写入后**不自动执行**，由 Agent 主动调用 `run_script` 测试

写入后 System Prompt 不会即时更新（需要重启）；但 Agent 可立即通过 `read_skill` + `run_script` 使用新 Skill。下次重启时新 Skill 自动出现在 System Prompt 的 Skill 描述列表中。

### `manage-mcp` Skill

这是一个内置 Skill（随框架提供），Agent 通过它管理 MCP server，而非在代码里硬编码管理逻辑。

位置：`workspace/skills/manage-mcp/`

`SKILL.md` 描述：
- 如何查看当前已注册的 MCP server 列表
- 如何添加新的 MCP server（stdio 方式）
- 如何卸载 MCP server
- `mcp-registry.json` 的位置和格式说明

`SKILL.md` 对应脚本：
- `list-mcp.ts`：读取 `mcp-registry.json`，输出当前注册列表
- `add-mcp.ts`：写入新条目到 `mcp-registry.json`，并通过 HTTP API 触发热注册
- `remove-mcp.ts`：从 `mcp-registry.json` 删除条目，并触发热注销

### MCP 热注册机制

**`InMemoryToolRuntime` 增加两个方法**（不改 `ToolRuntime` 接口，只改实现类）：

```typescript
export class InMemoryToolRuntime implements ToolRuntime {
  // 原有构造器和 getRuntimeView 不变

  registerProvider(provider: ToolProvider): void {
    // 防止重复注册同 id
    const existing = this._providers.findIndex(p => p.id === provider.id)
    if (existing >= 0) {
      this._providers[existing] = provider
    } else {
      this._providers.push(provider)
    }
  }

  unregisterProvider(id: string): void {
    this._providers = this._providers.filter(p => p.id !== id)
  }
}
```

**热注册 HTTP 内部 API**：

`manage-mcp` Skill 的脚本通过内部 HTTP API 与 server 通信触发热注册（不暴露给外部客户端）：

```
POST /_internal/mcp/register    ← 热注册新 MCP server
POST /_internal/mcp/unregister  ← 热注销
GET  /_internal/mcp/list        ← 查询当前注册列表
```

该 API 只绑定 loopback（`127.0.0.1`），不对外暴露。`run_script` 在执行 `manage-mcp` 脚本时，通过 `OPENKIN_INTERNAL_PORT` 环境变量（加入白名单）传入端口号。

**`mcp-registry.json` 格式**：

```json
{
  "version": 1,
  "servers": [
    {
      "id": "everything",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-everything"],
      "env": {}
    }
  ]
}
```

`cli.ts` 启动时读取此文件，对每个条目调用 `McpToolProvider.connect()`。

### 日志系统

#### `Logger` 接口（新增，`packages/core`）

```typescript
export interface Logger {
  toolCall(event: ToolCallLogEvent): void
  toolResult(event: ToolResultLogEvent): void
  skillRun(event: SkillRunLogEvent): void
  mcpCall(event: McpCallLogEvent): void
  error(event: ErrorLogEvent): void
}

export interface ToolCallLogEvent {
  type: 'tool_call'
  ts: string          // ISO 8601
  traceId: string
  sessionId: string
  stepIndex: number
  toolName: string
  sourceType: 'builtin' | 'skill' | 'mcp' | 'custom'
  input: Record<string, unknown>
}

export interface ToolResultLogEvent {
  type: 'tool_result'
  ts: string
  traceId: string
  toolName: string
  durationMs: number
  exitCode?: number   // run_script 专用
  isError: boolean
  outputSummary: string  // stdout 前 500 字符，防止日志过大
}

export interface SkillRunLogEvent {
  type: 'skill_run'
  ts: string
  traceId: string
  skillId: string
  script: string
  args: Record<string, unknown>
  durationMs: number
  exitCode: number
}

export interface McpCallLogEvent {
  type: 'mcp_call'
  ts: string
  traceId: string
  providerId: string
  toolName: string
  durationMs: number
  isError: boolean
}

export interface ErrorLogEvent {
  type: 'error'
  ts: string
  traceId?: string
  message: string
  stack?: string
}
```

#### `FileLogger` 实现（`packages/server`）

- 写入 `$OPENKIN_WORKSPACE_DIR/logs/agent-YYYY-MM-DD.log`（JSON Lines，每行一个事件）
- 同时输出到 `stderr`（格式：`[TOOL_CALL] toolName args={...}`）
- 文件自动按日期滚动（新的一天写新文件）
- 单文件上限 100MB（超出停止写入并记录警告，不 crash）

#### `read_logs` 内置工具

```typescript
name: 'read_logs'
description: '读取 Agent 最近的工具调用日志，用于回顾自己的行为或排查问题'
inputSchema: {
  limit?: number      // 返回条数，默认 20，最大 100
  type?: string       // 过滤事件类型（tool_call / tool_result / skill_run / mcp_call / error）
  traceId?: string    // 过滤特定 trace
}
output: {
  events: LogEvent[]
  total: number
}
```

实现：读取当天日志文件末尾 N 行，解析 JSON Lines，按条件过滤后返回。

#### 日志注入点

日志在以下位置触发（不改 `run-engine.ts` 接口，通过 `Logger` 依赖注入）：
- `executeToolCall` 前后：记录 `tool_call` + `tool_result`
- `run_script` executor 前后：额外记录 `skill_run`
- `McpToolProvider.getExecutor` 执行前后：记录 `mcp_call`

`Logger` 通过 `ToolExecutionContext` 扩展或独立注入方式传递，**不改 `ToolRuntime` / `ToolExecutor` 接口**。

> 实现策略：`packages/server/src/cli.ts` 构造 `FileLogger` 实例，通过工厂函数注入到 `run_script`、`McpToolProvider` 的 executor 构造中。`executeToolCall` 的日志包装在 server 的 run 处理路径中添加。

---

## 影响范围

| 层级 | 影响 |
|---|---|
| `packages/core/src/logger.ts` | 新建：`Logger` 接口 + 所有 `*LogEvent` 类型 |
| `packages/core/src/tool-runtime.ts` | 仅 `InMemoryToolRuntime` 类新增 `registerProvider()` / `unregisterProvider()`，接口不变 |
| `packages/core/src/tools/` | 新增 `write-skill.ts`、`read-logs.ts`；更新 `index.ts` |
| `packages/core/src/index.ts` | re-export 新增工具和 Logger 接口 |
| `packages/server/src/logger.ts` | 新建：`FileLogger` 实现 |
| `packages/server/src/http-server.ts` | 新增 `/_internal/mcp/*` 路由（仅 loopback） |
| `packages/server/src/cli.ts` | 构造 `FileLogger`；读取 `mcp-registry.json`；注入 `write_skill`、`read_logs` 工具 |
| `workspace/skills/manage-mcp/` | 新建：`SKILL.md`、`list-mcp.ts`、`add-mcp.ts`、`remove-mcp.ts` |
| `workspace/mcp-registry.json` | 新建（初始内容：空 servers 数组） |
| `workspace/logs/` | 运行时创建，`.gitignore` 忽略 |
| `scripts/test-self-management.mjs` | 新增 smoke 脚本 |
| `package.json`（根） | 新增 `test:self-management`，纳入 `verify` |
| `docs/architecture-docs-for-agent/ARCHITECTURE.md` | 更新 Tool Layer 说明，补充日志系统和自我管理能力 |

---

## 允许修改的目录

- `packages/core/src/`（新增 `logger.ts`，修改 `tool-runtime.ts` 的实现类，修改 `tools/index.ts`）
- `packages/server/src/`（新增 `logger.ts`，修改 `http-server.ts`、`cli.ts`）
- `workspace/skills/manage-mcp/`（新建）
- `workspace/mcp-registry.json`（新建）
- `scripts/`
- `docs/architecture-docs-for-agent/ARCHITECTURE.md`
- `docs/exec-plans/active/`
- `package.json`（根，仅 `scripts` 字段）
- `.gitignore`（新增 `workspace/logs/`）

## 禁止修改的目录

- `packages/core/src/tool-runtime.ts` 中的**接口定义部分**（`ToolRuntime` / `ToolProvider` / `ToolExecutor` 接口不变，只改 `InMemoryToolRuntime` 实现类）
- `packages/core/src/run-engine.ts`
- `packages/core/src/types.ts`
- `packages/shared/contracts/`
- `packages/sdk/client/`
- `packages/channel-core/`
- `apps/dev-console/`

---

## 本轮范围

1. **新建** `packages/core/src/logger.ts`
   - `Logger` 接口 + 所有 `*LogEvent` 类型
   - `NoopLogger` 实现（用于测试，不写文件）

2. **修改** `packages/core/src/tool-runtime.ts`
   - 在 `InMemoryToolRuntime` 类上增加 `registerProvider()` / `unregisterProvider()`
   - **不改** `ToolRuntime` / `ToolProvider` / `ToolExecutor` / `ToolRuntimeView` 接口

3. **新建** `packages/core/src/tools/write-skill.ts`
   - 实现 `write_skill` 工具
   - `skillId` 格式校验（`[a-z0-9-]+`）
   - 路径安全校验（所有写入在 `skills/<skillId>/` 内）
   - 写入 `SKILL.md` + 可选脚本文件

4. **新建** `packages/core/src/tools/read-logs.ts`
   - 实现 `read_logs` 工具
   - 读取当天日志文件末尾 N 行，解析 JSON Lines，过滤返回

5. **更新** `packages/core/src/tools/index.ts`
   - 导出 `writeSkillToolDefinition`、`writeSkillToolExecutor`
   - 导出 `readLogsToolDefinition`、`readLogsToolExecutor`

6. **新建** `packages/server/src/logger.ts`
   - `FileLogger` 实现 `Logger` 接口
   - 写入 JSON Lines 到 `$OPENKIN_WORKSPACE_DIR/logs/agent-YYYY-MM-DD.log`
   - 同时输出格式化文本到 `stderr`

7. **修改** `packages/server/src/http-server.ts`
   - 新增 `/_internal/mcp/register`、`/_internal/mcp/unregister`、`/_internal/mcp/list` 路由
   - 只接受来自 `127.0.0.1` 的请求

8. **修改** `packages/server/src/cli.ts`
   - 构造 `FileLogger`
   - 读取 `$OPENKIN_WORKSPACE_DIR/mcp-registry.json`，对每个条目 connect MCP provider
   - 注入 `write_skill`、`read_logs` 工具
   - 将 `FileLogger` 传递给 `run_script`、`McpToolProvider` executor

9. **新建** `workspace/skills/manage-mcp/SKILL.md`
   - frontmatter：`skill-id: manage-mcp`，简短 description
   - 正文：如何查看/添加/卸载 MCP server，`mcp-registry.json` 格式说明
   - 脚本调用方式说明

10. **新建** `workspace/skills/manage-mcp/list-mcp.ts`
    - 读取 `mcp-registry.json`，输出当前注册列表 JSON

11. **新建** `workspace/skills/manage-mcp/add-mcp.ts`
    - 写入新条目到 `mcp-registry.json`
    - 调用 `/_internal/mcp/register` 触发热注册

12. **新建** `workspace/skills/manage-mcp/remove-mcp.ts`
    - 从 `mcp-registry.json` 删除条目
    - 调用 `/_internal/mcp/unregister` 触发热注销

13. **新建** `workspace/mcp-registry.json`（初始内容：`{ "version": 1, "servers": [] }`）

14. **新增** `scripts/test-self-management.mjs`
    - 启动 server 子进程
    - 场景 A：发起 run，prompt 让 Agent 创建一个新 Skill（`write_skill`），断言文件被创建
    - 场景 B：发起 run，prompt 让 Agent 添加一个 MCP server，断言 `mcp-registry.json` 被更新
    - 场景 C：发起 run，prompt 让 Agent 查看最近日志（`read_logs`），断言返回事件列表

15. **更新** 根 `package.json`：`"test:self-management": "node scripts/test-self-management.mjs"` 纳入 `verify`

---

## 本轮不做

- 不实现 Skill 热加载到 System Prompt（新 Skill 写入后需重启，System Prompt 才自动更新）
- 不实现日志的归档压缩和远程上报
- 不实现 `run_script` 的 `inline` 模式（待 017）
- 不实现 MCP server 的断线重连和健康探测
- 不实现多 MCP server 工具名冲突解决（后续计划）
- 不实现 MCP server 的认证（OAuth、token）
- 不把日志系统暴露为公开 Service API（`read_logs` 工具只供 Agent 内部使用）
- 不实现 `write_skill` 的脚本内容静态安全分析

---

## 验收标准

1. `InMemoryToolRuntime` 有 `registerProvider()` / `unregisterProvider()` 方法，`ToolRuntime` 接口未变。
2. `write_skill` 工具可在 `workspace/skills/` 下创建新目录和文件，路径穿越被拒绝。
3. 写入的 Skill 可立即被 `read_skill` + `run_script` 执行（无需重启）。
4. `FileLogger` 在工具调用前后写入结构化日志到 `workspace/logs/`。
5. `read_logs` 工具可返回最近 N 条日志事件。
6. `manage-mcp` Skill 存在（`workspace/skills/manage-mcp/SKILL.md`），描述完整。
7. `add-mcp.ts` 可写入 `mcp-registry.json` 并触发热注册，新 MCP 工具在随后的 run 中可用。
8. `mcp-registry.json` 的条目在 server 重启后被自动加载。
9. `/_internal/mcp/*` 路由拒绝非 loopback 来源请求。
10. `scripts/test-self-management.mjs` 三个场景均通过。
11. `pnpm verify` 通过（含新增 `test:self-management`）。

---

## 必跑命令

1. `pnpm verify`
2. `pnpm test:self-management`

---

## 升级条件

命中以下任一情况时，弱模型必须立即停止并升级到 high-capability mode 或人工：

- 需要修改 `ToolRuntime` / `ToolProvider` / `ToolExecutor` / `ToolRuntimeView` 接口定义
- `/_internal/mcp/*` 路由的 loopback 校验在某些系统环境下无法可靠实现
- `write_skill` 的路径安全校验出现无法用简单字符串检查覆盖的穿越场景
- `FileLogger` 的日志文件滚动或并发写入出现数据损坏
- 连续两轮无法让 `pnpm verify` 与 `test:self-management` 同时通过

---

## 依赖与顺序

- **前置**：[`014`](./014_mcp_tool_provider.md)（MCP provider 基础已验证）
- **前置**：[`015`](./015_skill_framework.md)（Skill 目录、run_script 工具已实现）
- **后续**：
  - `017` — Deno 沙箱（`inline` 启用、文件/网络权限隔离、`write_skill` 脚本安全审计）

---

## 决策记录

| 决策点 | 选择 | 原因 |
|---|---|---|
| MCP 热注册接口位置 | `InMemoryToolRuntime` 实现类新增方法，不改接口 | `ToolRuntime` 接口是跨层 contract，不能随意扩展；热注册是 server 运维能力，不需要暴露给上层 |
| MCP 热注册触发方式 | Skill 脚本调用内部 HTTP API | 复用 015 的 `run_script` 能力，无需给 Skill 脚本特殊权限；内部 API 限 loopback 保证安全 |
| `mcp-registry.json` 位置 | `workspace/mcp-registry.json` | 与 Skill 同在工作区，语义一致；提交到 git 实现持久化 |
| `write_skill` 不自动执行 | 写入后需 Agent 主动测试 | 防止写入有 bug 的脚本被自动运行；Agent 明确决策比框架自动触发更安全 |
| `write_skill` 后 System Prompt 不即时更新 | 下次重启才更新 | 避免在单次 run 中 System Prompt 改变（影响对话连贯性）；新 Skill 可立即通过 read_skill + run_script 使用 |
| 日志接口 | 独立 `Logger` 接口，依赖注入 | 不改 `ToolExecutor` 接口；测试时用 `NoopLogger`；生产用 `FileLogger` |
| `manage-mcp` 实现为 Skill 而非代码 | Skill（`workspace/skills/manage-mcp/`） | 复用底层能力，无需修改框架代码；用户可以阅读和修改 Skill 脚本 |
| 内部 API 安全 | 只绑定 loopback（127.0.0.1） | 防止外部直接操作 MCP 注册；Skill 脚本通过 `OPENKIN_INTERNAL_PORT` 知道端口 |
