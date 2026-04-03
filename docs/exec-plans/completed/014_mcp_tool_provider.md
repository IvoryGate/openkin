# 014 MCP Tool Provider

## 目标

把 **MCP（Model Context Protocol）工具接入** 从概念推进到可在真实 ReAct 循环中调用远端 MCP server 工具的首期闭环，并支持 MCP 工具列表**动态更新**（`listChanged` 通知）。

验证方向：
1. `ToolProvider` 抽象是否真正对 MCP 这类"动态、远端、协议驱动"的工具来源开放。
2. MCP 协议的 `notifications/tools/list_changed` 通知能否驱动 `InMemoryToolRuntime` 刷新工具列表，而无需重启 server。

本计划建立在 [`013`](./013_tool_and_integration_layer_v1.md) 已完成的前提上。

---

## 背景

### MCP 工具的三个核心操作

MCP 官方规范（2025-06-18）定义了工具的标准交互模式：

- `tools/list`：发现 MCP server 暴露的工具列表（支持分页）
- `tools/call`：调用具体工具，返回 `content[]` + `isError`
- `notifications/tools/list_changed`：server 主动通知 client 工具列表已变更，client 应重新 `tools/list`

首期只接 `tools`，不接 `resources` 和 `prompts`。

### 为什么必须支持动态更新

静态缓存（只在 `connect()` 时查询一次）违反 MCP 协议语义：
- MCP server 可以在运行时动态注册/注销工具
- server 通过 `listChanged` 通知 client 刷新
- 不响应 `listChanged` 会导致 client 持有过时工具列表，tool call 产生 `TOOL_NOT_FOUND` 错误

首期实现必须监听 `listChanged` 并触发重新查询。

### 传输方式

首期只实现 **stdio 传输**：
- 启动本地子进程，通过标准输入输出通信
- 完全离线可运行，不依赖外部网络
- HTTP + SSE 传输另开执行计划

---

## 已冻结决策

### MCP 客户端依赖

使用 **官方 SDK `@modelcontextprotocol/sdk`**（Node.js）。

原因：官方 SDK 处理协议解析、连接生命周期、通知监听，不手写。

### `McpToolProvider` 的位置

新建 `packages/core/src/tools/mcp-tool-provider.ts`，放在 core 包内。

### 首期冻结接口

```typescript
export interface McpToolProviderOptions {
  /** 唯一标识，用于 ToolProvider.id */
  id: string
  /** MCP server 启动命令，例如 'npx' */
  command: string
  /** 命令参数，例如 ['-y', '@modelcontextprotocol/server-everything'] */
  args?: string[]
  /** 环境变量，透传给子进程 */
  env?: Record<string, string>
}

class McpToolProvider implements ToolProvider {
  readonly id: string
  readonly sourceType = 'mcp' as const

  // connect(): 启动子进程，初始化 MCP 会话，首次 tools/list，注册 listChanged 监听
  // disconnect(): 关闭 MCP 连接，终止子进程
  // refreshTools(): 重新调用 tools/list，更新内部缓存（由 listChanged 触发）
  // listTools(): 返回当前缓存的工具定义列表
  // getExecutor(name): 返回调用 tools/call 的 ToolExecutor
}
```

### 动态更新机制

```
MCP Server
  ──(notifications/tools/list_changed)──▶ McpToolProvider.onListChanged()
                                               └─▶ refreshTools()   // 重新 tools/list
                                                     └─▶ 更新内部 _tools 缓存
```

关键约束：
- `listChanged` 回调是**异步**的，`refreshTools()` 完成前 `listTools()` 仍返回旧缓存（不阻塞已有 run）
- `refreshTools()` 内部应串行执行（不并发），防止竞态覆盖
- `refreshTools()` 失败时记录错误日志，**不 crash server**，保留旧缓存

### 生命周期

- `connect()` 必须在注入 `InMemoryToolRuntime` 之前调用完成
- **server 管理生命周期**：`cli.ts` 负责 `connect()` / `disconnect()`，不由 `ToolProvider` 接口承担
- 进程退出（`SIGINT` / `SIGTERM`）时调用 `disconnect()`

### 错误模型

| 场景 | 处理方式 |
|---|---|
| `connect()` 失败 | 抛出 `Error`，不映射为 `RunError`（启动阶段错误） |
| `tools/call` 执行失败 | 映射为 `ToolResult.isError = true`，`output` 为 `RunError`（`TOOL_EXECUTION_FAILED`） |
| `refreshTools()` 失败 | 记录错误，保留旧缓存，不 crash server |
| MCP server 进程意外退出 | `listTools()` 返回空列表，`getExecutor` 调用返回 `undefined`，不 crash server |

### 对现有 contract 的影响

| 文件 | 是否修改 | 说明 |
|---|---|---|
| `packages/core/src/tool-runtime.ts` | **否** | `ToolProvider` 接口不变，`McpToolProvider` 是新实现 |
| `packages/core/src/run-engine.ts` | **否** | ReAct 引擎不感知工具来源 |
| `packages/shared/contracts/` | **否** | 不新增跨层 DTO |
| `packages/server/src/http-server.ts` | **否** | 路由和 DTO 不变 |

---

## 影响范围

| 层级 | 影响 |
|---|---|
| `packages/core/src/tools/` | 新增 `mcp-tool-provider.ts`，更新 `index.ts` 导出 |
| `packages/core/package.json` | 新增 `@modelcontextprotocol/sdk` 依赖 |
| `packages/server/src/cli.ts` | 增加 MCP provider 的 connect / disconnect 生命周期管理；组合 builtin + MCP 两个 provider |
| `package.json`（根） | 新增 `test:mcp` 脚本，纳入 `verify` |
| `scripts/` | 新增 `test-mcp.mjs` smoke 脚本 |
| `docs/architecture/ARCHITECTURE.md` | 更新 Tool Layer MCP 状态说明 |

---

## 允许修改的目录

- `packages/core/src/tools/`
- `packages/core/src/index.ts`
- `packages/core/package.json`（新增 `@modelcontextprotocol/sdk` 依赖）
- `packages/server/src/cli.ts`
- `scripts/`
- `docs/architecture/ARCHITECTURE.md`
- `docs/exec-plans/active/`
- `package.json`（根，仅 `scripts` 字段）

## 禁止修改的目录

- `packages/core/src/tool-runtime.ts`（接口不变）
- `packages/core/src/run-engine.ts`
- `packages/core/src/types.ts`
- `packages/shared/contracts/`
- `packages/server/src/http-server.ts`
- `packages/sdk/client/`
- `packages/channel-core/`
- `apps/dev-console/`

---

## 本轮范围

1. **新建** `packages/core/src/tools/mcp-tool-provider.ts`
   - 实现 `McpToolProvider`，依赖 `@modelcontextprotocol/sdk` 的 `Client` + `StdioClientTransport`
   - `connect()`：启动子进程，初始化 MCP 会话，首次 `tools/list`，注册 `listChanged` 回调
   - `listTools()`：返回内部 `_tools` 缓存（`refreshTools()` 完成后同步更新）
   - `getExecutor(name)`：返回一个 `ToolExecutor`，执行时调用 `tools/call`
   - `refreshTools()`：重新 `tools/list`，更新缓存（串行执行，失败保留旧缓存）
   - `disconnect()`：关闭 MCP 连接，终止子进程，清理 `listChanged` 监听

2. **更新** `packages/core/src/tools/index.ts`
   - 导出 `McpToolProvider`、`McpToolProviderOptions`

3. **更新** `packages/server/src/cli.ts`
   - 创建 `McpToolProvider` 实例
   - await `connect()`
   - 把 `mcpProvider` 和 `builtinProvider` 一起注入 `InMemoryToolRuntime`
   - 注册 `SIGINT` / `SIGTERM`：调用 `disconnect()`

4. **新增** `scripts/test-mcp.mjs`
   - 启动本地 server 子进程（已含 MCP provider）
   - 创建 session → 发起 run（prompt 触发 MCP server 的 `echo` 工具）
   - SSE 确认 `run_completed`，断言 `steps` 中有 MCP 工具调用
   - 额外验证：触发 `listChanged`（通过发第二次 run），确认工具刷新不导致 server crash

5. **更新** 根 `package.json`：`"test:mcp": "node scripts/test-mcp.mjs"` 纳入 `verify`

---

## 本轮不做

- 不实现 HTTP + SSE（Streamable HTTP）传输方式的 MCP 客户端
- 不实现 MCP `resources` 和 `prompts` 接入
- 不实现 MCP server 的热重连、断线重启
- 不实现 MCP provider 健康探测与可用性降级
- 不实现多 MCP server 的工具名冲突解决策略
- 不修改 `ToolProvider` / `ToolRuntime` 接口
- 不新增 shared contract 中的 DTO
- 不实现 MCP server 的认证（OAuth、token 等）
- 不把 MCP 配置做成 server API

---

## 验收标准

1. `packages/core` 导出 `McpToolProvider`，实现 `ToolProvider` 接口。
2. `McpToolProvider` 可以连接到 `@modelcontextprotocol/server-everything`（stdio），列出工具，并通过 `ToolExecutor` 执行调用。
3. `McpToolProvider` 监听 `listChanged` 通知，并异步刷新工具缓存，刷新失败时保留旧缓存且不 crash。
4. `packages/server/src/cli.ts` 启动时正确 connect MCP provider，在 ReAct 循环中可触发 MCP 工具调用，run 结果为 `completed`。
5. `scripts/test-mcp.mjs` smoke 通过：session 创建、run 提交、SSE 收到 `run_completed`，且 `steps` 中有 MCP 工具的 `toolCalls`。
6. MCP server 进程异常退出时，smoke 不导致 server crash（错误映射为 `ToolResult.isError = true`）。
7. `pnpm verify` 通过（含新增 `test:mcp`）。
8. `docs/architecture/ARCHITECTURE.md` Tool Layer MCP 状态说明已更新。

---

## 必跑命令

1. `pnpm verify`
2. `pnpm test:mcp`

在 `test:mcp` 尚未落地前，不允许宣称本计划完成。

---

## 升级条件

命中以下任一情况时，弱模型必须立即停止并升级到 high-capability mode 或人工：

- 需要修改 `ToolProvider` / `ToolRuntime` / `ToolExecutor` 接口定义
- 需要在 `packages/shared/contracts` 中新增 MCP 相关跨层 DTO
- 需要实现 HTTP + SSE 传输（超出本计划范围）
- `@modelcontextprotocol/sdk` 的 API 变化导致必须重新设计接入方式
- `listChanged` 回调与 `getRuntimeView()` 之间出现无法用缓存隔离解决的竞态问题
- 连续两轮无法让 `pnpm verify` 与 `pnpm test:mcp` 同时通过

---

## 依赖与顺序

- **前置**：[`013`](./013_tool_and_integration_layer_v1.md)（builtin tool 注册路径已验证）
- **后续候选**：
  - MCP HTTP + SSE 传输（另开计划）
  - MCP `resources` 接入（另开计划）
  - `015` Skill 框架（文件夹约定 + SKILL.md 驱动）

---

## 决策记录

| 决策点 | 选择 | 原因 |
|---|---|---|
| 传输方式 | 只做 stdio | 离线可运行，首期只验证接口兼容性 |
| MCP 客户端 | 官方 `@modelcontextprotocol/sdk` | 与协议版本绑定，不手写协议解析 |
| 测试 MCP server | `@modelcontextprotocol/server-everything` via npx | 官方演示 server，包含 echo 等工具 |
| 动态更新 | 监听 `listChanged`，异步刷新缓存 | MCP 协议标准语义；静态缓存违反协议；刷新失败保留旧缓存避免 crash |
| `listChanged` 刷新串行化 | `refreshTools()` 内部串行 | 防止并发刷新产生竞态，覆盖更新结果 |
| 刷新期间 `listTools()` 行为 | 返回旧缓存 | 不阻塞进行中的 run；旧工具比空列表更安全 |
| 生命周期管理位置 | `cli.ts` 负责 connect / disconnect | `ToolProvider` 接口不承担生命周期，保持接口纯粹 |
| 错误映射 | 执行失败 → `ToolResult.isError = true` | 与现有错误路径一致 |
