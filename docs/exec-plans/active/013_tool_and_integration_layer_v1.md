# 013 Tool And Integration Layer v1

## 目标

把 **Tool And Integration Layer** 从"抽象接口占位"推进到"可在真实 ReAct 循环中调用并回写结果"的首期可验收闭环。

当前状态：`packages/core` 的 `ToolRuntime` / `ToolProvider` / `ToolExecutor` 接口已冻结，`demo-shared.ts` 中已有一个内嵌的 `get_weather` mock executor。但这些 executor 全部内嵌在 `apps/dev-console`，**没有任何工具实现存放在 `packages/` 层**，也没有通过 service 层的集成验证。

本计划只做以下三件事：

1. 在 `packages/` 中落第一批**内置工具实现**（`builtin` sourceType）。
2. 验证这些工具可以被 server 层管理的 `InMemoryToolRuntime` 消费，并在真实 ReAct 循环中触发完整的 `thought → tool_call → tool_result → answer` 路径。
3. 为 Tool Layer 引入独立的 `test:tools` smoke 命令，纳入 `pnpm verify`。

---

## 已冻结决策

### 首期工具范围

本轮只允许交付以下两个内置工具：

| 工具名 | 功能 | sourceType |
|---|---|---|
| `echo` | 原样回显输入文本，用于最简闭环验证 | `builtin` |
| `get_current_time` | 返回当前 UTC 时间戳字符串 | `builtin` |

不允许在首期新增 `get_weather`（已在 `demo-shared.ts` 中作为 harness tool 存在，不移动，不迁移）。

**原因：**
- `echo` 可以让 ReAct 引擎在不依赖外部状态的前提下完整走一遍 `tool_call → tool_result` 循环，是最小可验证单元。
- `get_current_time` 有真实意义，便于 smoke test 断言结果格式。
- 首期故意不做复杂工具，目的是验证**接入框架的扩展性**，而不是验证工具本身的功能。

### 工具存放位置

内置工具实现统一放在 `packages/core/src/tools/` 子目录下，不新建独立 `packages/lib` 包。

**原因：** 首期工具量少，且工具实现不跨包依赖。如果后续工具量大或 MCP 接入进来，可由下一个计划再拆包。

### 集成主链路

首期只验证以下链路：

```
createSession → POST /v1/runs (with echo/get_current_time tool)
  → ReActRunEngine (tool_call + tool_result)
  → run_completed StreamEvent
```

- 验证由 `scripts/test-tools.mjs` smoke 脚本完成。
- smoke 脚本必须启动真实 server 子进程，不允许 in-process 替代。
- smoke 断言：run 最终状态为 `completed`，且 `steps` 中至少有一个 `toolCalls` 不为空。

### ToolProvider 注册方式

首期只允许使用 `StaticToolProvider`（已存在），由 server 构建时静态注入。

不允许：
- 动态插件热加载
- MCP ToolProvider（后续计划）
- 基于配置的 provider 工厂

### server 层集成方式

`CreateOpenKinHttpServerOptions` 的 `toolRuntime` 字段已存在，server 已经支持外部注入。本计划只需要让 `packages/server/src/cli.ts` 在启动时注入包含上述两个内置工具的 `InMemoryToolRuntime`，不改 server 路由和 DTO。

---

## 影响范围

| 层级 | 影响 |
|---|---|
| `packages/core/src/tools/` | 新建目录，增加 `echo.ts`、`get-current-time.ts`、`index.ts` |
| `packages/core/src/index.ts` | 导出新增 tool 定义和 executor（保持向后兼容） |
| `packages/server/src/cli.ts` | 在 server 启动时注入包含两个内置工具的 `InMemoryToolRuntime` |
| `scripts/` | 新增 `test-tools.mjs`（smoke 脚本）|
| `package.json`（根） | 新增 `test:tools` 脚本，纳入 `verify` 链 |
| `docs/architecture/ARCHITECTURE.md` | 更新 Tool Layer 首期状态说明 |
| `docs/second-layer/` | 新建第二层文档目录（013 与 `docs/second-layer/` 同步交付） |

---

## 允许修改的目录

- `packages/core/src/tools/`（新建）
- `packages/core/src/index.ts`
- `packages/server/src/cli.ts`
- `scripts/`
- `docs/architecture/ARCHITECTURE.md`
- `docs/second-layer/`（新建）
- `docs/exec-plans/active/`
- `package.json`（根，仅 `scripts` 字段）
- `scripts/lint-docs.mjs`（新增 second-layer 路径检查）

## 禁止修改的目录

- `packages/core/src/tool-runtime.ts`（已冻结接口，不得修改）
- `packages/core/src/run-engine.ts`（不得修改 ReAct 循环逻辑）
- `packages/core/src/types.ts`（不得修改 RunState / AgentResult 语义）
- `packages/shared/contracts/`（不需要新增跨层 DTO）
- `packages/sdk/client/`
- `packages/channel-core/`
- `apps/dev-console/src/demo-shared.ts`（保留原有 `get_weather` harness tool，不移动）
- `apps/dev-console/tests/`（不修改现有 scenario）

---

## 本轮范围

1. **新建** `packages/core/src/tools/echo.ts`
   - `ToolDefinition`：`name: 'echo'`，`inputSchema` 包含 `{ text: string }`
   - `ToolExecutor`：把 `input.text` 原样写入 `output`

2. **新建** `packages/core/src/tools/get-current-time.ts`
   - `ToolDefinition`：`name: 'get_current_time'`，无必须参数
   - `ToolExecutor`：返回 `{ utc: new Date().toISOString() }`

3. **新建** `packages/core/src/tools/index.ts`
   - 导出 `echoToolDefinition`、`echoToolExecutor`
   - 导出 `getCurrentTimeToolDefinition`、`getCurrentTimeToolExecutor`
   - 导出 `createBuiltinToolProvider()`：返回预装以上两个工具的 `StaticToolProvider`

4. **更新** `packages/core/src/index.ts`：re-export `packages/core/src/tools/index.ts`

5. **更新** `packages/server/src/cli.ts`：在 server 启动时用 `createBuiltinToolProvider()` 构造 `InMemoryToolRuntime` 并注入

6. **新增** `scripts/test-tools.mjs`（参照 `scripts/test-server.mjs` 模式）：
   - 启动本地 server 子进程
   - 创建 session → 发起 run（prompt 设计为会触发 `echo` 或 `get_current_time`）
   - 通过 SSE stream 确认 `run_completed`
   - 断言响应中有 tool call 步骤

7. **更新** 根 `package.json`：`"test:tools": "node scripts/test-tools.mjs"` 并纳入 `verify`

8. **新建** `docs/second-layer/DEMO_SECOND_LAYER.md` 和 `docs/second-layer/SECOND_LAYER_COVERAGE.md`（第二层文档目录，与 013 同步交付）

9. **更新** `scripts/lint-docs.mjs`：将 `docs/second-layer/DEMO_SECOND_LAYER.md` 和 `docs/second-layer/SECOND_LAYER_COVERAGE.md` 加入 `requiredPaths`

---

## 本轮不做

- 不实现 MCP ToolProvider（另开执行计划 014）
- 不实现 Skill（另开执行计划 015）
- 不迁移 `demo-shared.ts` 的 `get_weather`
- 不新增 Tool Layer 的服务级 API
- 不实现工具调用的 token 计费与 trace 聚合
- 不修改 `ToolRuntime` / `ToolProvider` / `ToolExecutor` 接口定义
- 不新增 shared contract 中的 DTO
- 不修改 ReAct 引擎的工具调用逻辑

---

## 验收标准

1. `packages/core` 导出 `createBuiltinToolProvider()`，包含 `echo` 与 `get_current_time` 两个工具。
2. `packages/server/src/cli.ts` 启动时注入这两个内置工具，ReAct 引擎在真实 run 中可触发 tool call。
3. `scripts/test-tools.mjs` smoke 通过：session 创建、run 提交、SSE 收到 `run_completed`，且 step 中有 `toolCalls`。
4. `pnpm verify` 通过（含新增 `test:tools`）。
5. `docs/architecture/ARCHITECTURE.md` Tool Layer 状态说明已更新。
6. `docs/second-layer/` 目录已建立，含 `DEMO_SECOND_LAYER.md` 与 `SECOND_LAYER_COVERAGE.md`。

---

## 必跑命令

实现本计划时，默认必须运行：

1. `pnpm verify`
2. `pnpm test:tools`

在 `test:tools` 尚未落地前，不允许宣称本计划完成。

---

## 升级条件

命中以下任一情况时，弱模型必须立即停止并升级到 high-capability mode 或人工：

- 需要修改 `ToolRuntime` / `ToolProvider` / `ToolExecutor` 接口定义
- 需要在 `packages/shared/contracts` 中新增 Tool 相关的跨层 DTO
- 需要把工具实现从 `packages/core/src/tools/` 拆出到独立包
- 发现 ReAct 引擎的 `executeToolCall` 路径存在需要改接口的 bug
- 需要在 `packages/server` 中新增工具注册相关的路由或 DTO
- 连续两轮无法让 `pnpm verify` 与 `pnpm test:tools` 同时通过

---

## 依赖与顺序

- **前置**：[`012`](../completed/012_first_layer_readiness_closure.md)（第一层首期已收口）
- **不依赖** 004/005/006
- **后续候选**：
  - `014` — MCP ToolProvider 接入（动态工具发现 + listChanged 支持）
  - `015` — Skill 框架（文件夹约定 + SKILL.md + 脚本调度能力）

---

## 决策记录

| 决策点 | 选择 | 原因 |
|---|---|---|
| 工具放在 `packages/core/src/tools/` 而非独立包 | 放 core 子目录 | 首期工具量少，避免过早分包；接口在 core 里，实现也在 core 里，边界最清晰 |
| 首期工具选 `echo` + `get_current_time` | 只选两个最简工具 | 目标是验证接入框架，不是验证工具功能；`echo` 无外部依赖，是最小闭环 |
| 不迁移 `demo-shared.ts` 的 `get_weather` | 保留原位 | `get_weather` 是 demo harness，用于展示多轮 ReAct；迁移会改变现有 demo 结构，超出本计划范围 |
| server cli.ts 注入方式 | 静态注入 `createBuiltinToolProvider()` | `CreateOpenKinHttpServerOptions.toolRuntime` 已存在；静态注入是最小改动 |
| smoke 断言必须通过真实 server 子进程 | 必须 | 与 004/005/006 保持一致的验证模式，避免 in-process 掩盖集成问题 |
| `docs/second-layer/` 与 013 同步交付 | 同步 | 先建文档目录，再落代码，符合 harness 原则 |
