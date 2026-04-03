# 014 MCP Tool Provider

## 目标

把 **MCP（Model Context Protocol）工具接入** 从概念推进到可在真实 ReAct 循环中调用远端 MCP server 工具的首期闭环。

验证方向：`ToolProvider` 抽象是否真正对 MCP 这类"动态、远端、协议驱动"的工具来源开放，而不需要改变第一层任何执行引擎代码。

本计划默认建立在 [`013`](./013_tool_and_integration_layer_v1.md) 已完成的前提上，内置工具的注册路径已可用。

---

## 背景

MCP 是由 Anthropic 主导的开放协议，定义了 LLM 应用与外部工具服务器之间的标准化通信方式。主要有两种传输方式：

- **stdio**：本地进程，通过标准输入输出通信，适合本地开发和单机部署。
- **HTTP + SSE**（Streamable HTTP）：远端服务，适合网络可达的 MCP server。

MCP server 暴露三类能力：`tools`、`resources`、`prompts`。本计划**只接 `tools`**，不接 `resources` 和 `prompts`。

---

## 已冻结决策

### 传输方式

首期只实现 **stdio 传输**，原因：

- stdio 启动一个本地子进程，无需网络，**完全离线可运行**，不依赖外部 server 是否可达。
- 首期目标是验证 `ToolProvider` 接口能接 MCP，而不是验证远端高可用 MCP 部署。
- HTTP + SSE 传输另开执行计划（后续候选）。

### MCP 客户端依赖

使用 **官方 SDK `@modelcontextprotocol/sdk`**（Node.js），不手写 MCP 协议解析。

原因：
- 官方 SDK 稳定，接口与协议版本绑定，不引入自定义协议风险。
- 首期只用 `Client` + `StdioClientTransport`，依赖面极小。

### `McpToolProvider` 的位置

新建 `packages/core/src/tools/mcp-tool-provider.ts`，**放在 core 包内**，不新建独立包。

原因：
- `ToolProvider` 接口在 core，实现放同包，边界最清晰。
- 后续如工具生态变大、需要独立包，可由下一个计划拆出，本计划不预做过度设计。

### 首期冻结接口：`McpToolProvider`

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
  readonly sourceType = 'mcp' as const
  // listTools(): 向 MCP server 查询 tools/list
  // getExecutor(name): 返回调用 tools/call 的 ToolExecutor
  // connect(): 启动子进程 + 初始化 MCP 会话
  // disconnect(): 关闭子进程
}
```

- `connect()` 必须在注入 `InMemoryToolRuntime` 之前调用完成。
- 每次 `getExecutor` 调用时不重新建连，只在 `connect()` 时建一次连接，复用。
- **生命周期由 server 管理**（`cli.ts` 负责 connect / disconnect），不由 `ToolProvider` 接口本身承担。

### 测试用 MCP server

首期使用 **官方 `@modelcontextprotocol/server-everything`**（通过 `npx -y` 拉起），它包含 `echo` 等多个演示工具，无需自己写服务器。

不允许：
- 自己写一个 fake MCP server 用于 smoke
- 依赖任何网络可达的外部 MCP server

### 错误模型

- `connect()` 失败 → 抛出 `Error`，不映射为 `RunError`（启动阶段错误，不进入 run 生命周期）
- `tools/call` 执行失败 → 映射为 `ToolResult.isError = true`，`output` 为 `RunError`（`TOOL_EXECUTION_FAILED`），与现有 `executeToolCall` 错误路径对齐
- MCP server 进程意外退出 → `listTools` / `getExecutor` 调用返回空或抛 `TOOL_EXECUTION_FAILED`，不 crash server 进程

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
| `packages/server/src/cli.ts` | 增加 MCP provider 的 connect / disconnect 生命周期管理；在 server 启动时组合 builtin + MCP 两个 provider |
| `package.json`（根） | 新增 `test:mcp` 脚本，纳入 `verify`；新增 `@modelcontextprotocol/sdk` 依赖（`packages/core`） |
| `scripts/` | 新增 `test-mcp.mjs` smoke 脚本 |
| 文档 | 更新 `docs/architecture/ARCHITECTURE.md`（Tool Layer MCP 状态说明） |

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
   - `connect()`：启动子进程，初始化 MCP 会话，缓存 `listTools` 结果
   - `listTools()`：返回缓存的工具定义列表（已在 `connect()` 时查询）
   - `getExecutor(name)`：返回一个 `ToolExecutor`，执行时调用 `tools/call`
   - `disconnect()`：关闭 MCP 连接，终止子进程

2. **更新** `packages/core/src/tools/index.ts`
   - 导出 `McpToolProvider`、`McpToolProviderOptions`

3. **更新** `packages/server/src/cli.ts`
   - 在 server 启动时：
     1. 创建 `McpToolProvider` 实例
     2. 调用 `connect()`（await）
     3. 把 `mcpProvider` 和 `builtinProvider` 一起注入 `InMemoryToolRuntime`
   - 在进程退出时（`SIGINT` / `SIGTERM`）调用 `disconnect()`

4. **新增** `scripts/test-mcp.mjs`
   - 启动本地 server 子进程（已含 MCP provider）
   - 创建 session → 发起 run（prompt 触发 MCP server 的 `echo` 工具）
   - SSE 确认 `run_completed`，断言 `steps` 中有 MCP 工具调用

5. **更新** 根 `package.json`：`"test:mcp": "node scripts/test-mcp.mjs"` 纳入 `verify`

---

## 本轮不做

- 不实现 HTTP + SSE（Streamable HTTP）传输方式的 MCP 客户端
- 不实现 MCP `resources` 和 `prompts` 接入
- 不实现 MCP server 的热重连、断线重启
- 不实现 MCP provider 健康探测与可用性降级
- 不实现多 MCP server 的工具名冲突解决策略
- 不修改 `ToolProvider` / `ToolRuntime` 接口（接口已冻结）
- 不新增 shared contract 中的 DTO
- 不实现 MCP server 的认证（OAuth、token 等）
- 不把 MCP 配置做成 server API（工具注册/卸载 endpoint）

---

## 验收标准

1. `packages/core` 导出 `McpToolProvider`，接受 `McpToolProviderOptions`，实现 `ToolProvider` 接口。
2. `McpToolProvider` 可以连接到 `@modelcontextprotocol/server-everything`（stdio），列出其工具，并通过 `ToolExecutor` 执行工具调用。
3. `packages/server/src/cli.ts` 启动时正确 connect MCP provider，在 ReAct 循环中可触发 MCP 工具调用，run 结果为 `completed`。
4. `scripts/test-mcp.mjs` smoke 通过：session 创建、run 提交、SSE 收到 `run_completed`，且 `steps` 中有 MCP 工具的 `toolCalls`。
5. MCP server 进程异常退出时，smoke 不导致 server crash（错误映射为 `ToolResult.isError = true`）。
6. `pnpm verify` 通过（含新增 `test:mcp`）。
7. `docs/architecture/ARCHITECTURE.md` Tool Layer MCP 状态说明已更新。

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
- 需要把 MCP provider 拆到独立包
- MCP server 进程管理的错误无法用现有 `ToolResult.isError` 路径覆盖
- 连续两轮无法让 `pnpm verify` 与 `pnpm test:mcp` 同时通过

---

## 依赖与顺序

- **前置**：[`013`](./013_tool_and_integration_layer_v1.md)（builtin tool 注册路径已验证）
- **后续候选**：
  - MCP HTTP + SSE 传输（另开计划）
  - MCP `resources` 接入（另开计划）
  - `015` Skill ToolProvider（与本计划并行设计，执行时建议先完成本计划）

---

## 决策记录

| 决策点 | 选择 | 原因 |
|---|---|---|
| 传输方式 | 只做 stdio | 离线可运行，首期只验证接口兼容性，不验证远端部署 |
| MCP 客户端 | 官方 `@modelcontextprotocol/sdk` | 与协议版本绑定，不手写协议解析 |
| 测试 MCP server | `@modelcontextprotocol/server-everything` via npx | 官方演示 server，包含 echo 等工具，无需自写 |
| `listTools` 缓存时机 | `connect()` 时一次性查询并缓存 | 避免每次 `getRuntimeView` 都发起 MCP 请求，减少延迟 |
| 生命周期管理位置 | `cli.ts` 负责 connect / disconnect | `ToolProvider` 接口不承担生命周期，保持接口纯粹 |
| 错误映射 | 执行失败 → `ToolResult.isError = true` | 与现有错误路径一致，不引入新 envelope |
| 位置 | `packages/core/src/tools/` | 与 builtin tool 同目录，接口在 core，实现在 core |
