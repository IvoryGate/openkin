# Second-Layer Demo（Tool & Integration Layer）

## 目标

在第一层核心运行时稳定的基础上，演示 **Tool And Integration Layer** 的三种工具来源接入：内置工具、MCP、Skill。

**目录约定**：第二层 smoke 脚本在 `scripts/`；Skill 文件夹（文档 + 脚本）在 `packages/core/src/skills/`。

## 工具来源一览

| 来源 | sourceType | 接入方式 | 执行主体 |
|------|------------|----------|----------|
| 内置工具 | `builtin` | 静态注册（启动时） | TypeScript 函数 |
| MCP | `mcp` | stdio 子进程 + 动态 listChanged | MCP server 进程 |
| Skill | `skill` | Agent 运行时读 `SKILL.md` + 执行脚本 | Agent 工具链 |

## 入口一览

| 命令 | 说明 |
|------|------|
| `pnpm test:tools` | **内置工具 smoke**：启动 server，触发 `echo` / `get_current_time`，断言 `toolCalls` |
| `pnpm test:mcp` | **MCP smoke**：启动 server（含 MCP provider），触发 MCP echo 工具，断言 `toolCalls` |
| `pnpm test:skills` | **Skill smoke**：启动 server，Agent 走 `list_skills → read_skill → run_script` 三步，断言 steps |

以上三个命令均并入 `pnpm verify`，全部使用**真实 server 子进程**（不允许 in-process 替代）。

## 各 smoke 的运行方式

### 内置工具 smoke（`test:tools`）

```bash
pnpm test:tools
# 等价于 node scripts/test-tools.mjs
```

- 无需额外环境变量
- server 使用 `MockLLMProvider` + `createBuiltinToolProvider()`
- 断言：`steps` 中至少一个 step 的 `toolCalls` 不为空

### MCP smoke（`test:mcp`）

```bash
pnpm test:mcp
# 等价于 node scripts/test-mcp.mjs
```

- 需要 npx 可用（用于拉起 `@modelcontextprotocol/server-everything`）
- server 组合 builtin + MCP 两个 provider
- MCP provider 监听 `listChanged` 通知，动态刷新工具列表

### Skill smoke（`test:skills`）

```bash
pnpm test:skills
# 等价于 node scripts/test-skills.mjs
```

- 无需额外环境变量
- Agent 在 ReAct 循环中依次调用 `list_skills`、`read_skill`、`run_script`
- `run_script` 执行 `packages/core/src/skills/weather/weather.ts`，通过 `SKILL_ARGS` 传参

## Skill 文件夹结构

```
packages/core/src/skills/
  weather/
    SKILL.md          ← 能力说明、参数、调用方式
    weather.ts        ← SKILL.md 引用的脚本（名称不固定）
```

**重要约定**：
- `SKILL.md` 是每个 Skill 的唯一强制文件
- 脚本文件名不固定（不是 `handler.ts`）
- 脚本可以内嵌在 `SKILL.md` 代码块中，或作为独立文件引用
- `run_script` 首期只允许执行 `packages/core/src/skills/` 内的文件

## MCP 动态更新说明

MCP provider（`McpToolProvider`）在 `connect()` 时注册 `listChanged` 监听：
- MCP server 变更工具列表时主动发通知
- `McpToolProvider` 异步刷新内部工具缓存（`refreshTools()`）
- 刷新期间 `listTools()` 返回旧缓存（不阻塞进行中的 run）
- 刷新失败时记录日志，保留旧缓存，不 crash server

## 覆盖矩阵

各 smoke 分工见 [`SECOND_LAYER_COVERAGE.md`](./SECOND_LAYER_COVERAGE.md)。

## 与其他层的关系

- 第一层的 `pnpm verify` 内容（scenarios、第一层 audit、server/sdk/channels smoke）保持不变
- 第二层三个 smoke 追加到 `pnpm verify`，与第一层并列
- 真实 LLM 下的 Skill 完整路径验证不并入 `verify`（需 `OPENAI_*` 环境变量，与第一层真实审计模式一致）
