# Second-Layer Demo（Tool & Integration Layer）

## 目标

在第一层核心运行时稳定的基础上，演示 **Tool And Integration Layer** 的三种工具来源接入：内置工具、MCP、Skill。

**目录约定**：第二层 smoke 脚本在 `scripts/`；Skill 文件夹（文档 + 脚本）在 `workspace/skills/`（运行时工作区，不在 `packages/` 源码内）。

## 工具来源一览

| 来源 | sourceType | 接入方式 | 执行主体 |
|------|------------|----------|----------|
| 内置工具 | `builtin` | 静态注册（启动时） | TypeScript 函数 |
| MCP | `mcp` | stdio 子进程 + 动态 listChanged | MCP server 进程 |
| Skill | `skill` | Agent 运行时读 `SKILL.md` + 执行脚本 | Agent 工具链 |

## 入口一览

| 命令 | 说明 |
|------|------|
| `pnpm test:tools` | **内置工具 smoke**：启动 server，触发 `get_current_time` / `run_command` / `read_file` 等，断言 `toolCalls` |
| `pnpm test:mcp` | **MCP smoke**：启动 server（含 MCP provider），触发 MCP echo 工具，断言 `toolCalls` |
| `pnpm test:skills` | **Skill smoke**：启动 server，Agent 走 `list_skills → read_skill → run_script` 三步，断言 steps |
| `pnpm test:self-management` | **自我管理 smoke**：验证 `write_skill` / `read_logs` / `manage-mcp` 热注册链路 |
| `pnpm test:sandbox` | **沙箱 smoke**：验证 Deno 权限隔离五场景；Deno 未安装时自动 SKIP |

以上五个命令均并入 `pnpm verify`，全部使用**真实 server 子进程**（不允许 in-process 替代）。`test:sandbox` 在 Deno 不可用时以 exit 0 退出，不阻断 verify。

## 各 smoke 的运行方式

### 内置工具 smoke（`test:tools`）

```bash
pnpm test:tools
# 等价于 node scripts/test-tools.mjs
```

- 无需额外环境变量
- server 使用 `MockLLMProvider` + `createBuiltinToolProvider()`
- 断言：`steps` 中至少一个 step 的 `toolCalls` 不为空
- 注：`echo` 已从 builtin 移除，测试改用 `get_current_time`

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
workspace/skills/
  weather/
    SKILL.md          ← 能力说明、参数、调用方式
    weather.ts        ← SKILL.md 引用的脚本（名称不固定）
  manage-mcp/
    SKILL.md
    add-mcp.ts
    remove-mcp.ts
    list-mcp.ts
```

**重要约定**：
- `SKILL.md` 是每个 Skill 的唯一强制文件
- 脚本文件名不固定（不是 `handler.ts`）
- Skill 在运行时工作区 `workspace/skills/`，不在源码 `packages/` 内
- `run_script` 只允许执行 `workspace/skills/` 目录内的文件（路径安全检测）

## MCP 动态更新说明

MCP provider（`McpToolProvider`）在 `connect()` 时注册 `listChanged` 监听：
- MCP server 变更工具列表时主动发通知
- `McpToolProvider` 异步刷新内部工具缓存（`refreshTools()`）
- 刷新期间 `listTools()` 返回旧缓存（不阻塞进行中的 run）
- 刷新失败时记录日志，保留旧缓存，不 crash server

## 覆盖矩阵

各 smoke 分工见 [`SECOND_LAYER_COVERAGE.md`](./SECOND_LAYER_COVERAGE.md)。

## Deno 沙箱（017）

从 017 起，`run_script` 在 Deno 可用时自动切换到沙箱模式执行 TypeScript 脚本；Deno 不可用时自动降级到原有 `tsx` 模式，已有 Skill 无需任何改动。

### 安装 Deno

```bash
curl -fsSL https://deno.land/install.sh | sh
# 安装后将 ~/.deno/bin 加入 PATH，或通过绝对路径调用
export PATH="$HOME/.deno/bin:$PATH"
```

### SKILL.md 权限声明

每个 Skill 目录下的 `SKILL.md` 支持 frontmatter `permissions` 块，控制沙箱权限：

```yaml
---
skill-id: my-skill
description: |
  Skill 说明
permissions:
  read: ["."]                          # 允许读取的路径，"." = 本 Skill 目录（默认）
  net: []                              # 允许的网络目标，格式 "host:port"，默认空
  write: []                            # 允许写入的路径，默认空
  env: ["SKILL_ARGS", "SKILL_ID"]      # 允许读取的环境变量（这两个始终允许）
---
```

**路径关键字**：
- `"."` → 本 Skill 目录的绝对路径
- `"workspace"` → `workspace/` 工作区根目录
- 其他绝对路径 → 直接使用（必须在 workspace 内）

**默认值**（不写 `permissions` 块时）：`read: ["."]`，其余全空。

**禁止值**：`net: ["*"]` 会被框架在执行前拒绝，返回配置错误。

### 典型 permissions 配置

| 场景 | read | net | write |
|------|------|-----|-------|
| 只读自身目录（默认） | `["."]` | `[]` | `[]` |
| 需要写 workspace | `[".", "workspace"]` | `[]` | `["workspace"]` |
| 需要调本地 API | `["."]` | `["127.0.0.1"]` | `[]` |
| 需要读写 workspace + 调内部 API | `[".", "workspace"]` | `["127.0.0.1"]` | `["workspace"]` |

### inline 模式

Deno 可用时，`run_script` 支持直接传入 TypeScript 代码（最严格沙箱：无 read/net/write）：

```json
{
  "skillId": "my-skill",
  "inline": "const x = 1 + 1; console.log(JSON.stringify({ result: x }));",
  "args": {}
}
```

- 代码写入系统临时目录，执行完毕后立即删除（成功或失败均删除）
- 若 Deno 未安装，返回明确错误，不会降级执行

### 沙箱 smoke（`test:sandbox`）

```bash
pnpm test:sandbox
# 等价于 node scripts/test-sandbox.mjs
```

- 前置：需要 Deno 已安装，不可用时自动 **SKIP**（退出 0，不导致 verify 失败）
- 场景 A：正常 Skill 在 Deno 沙箱中执行结果正确
- 场景 B：脚本读取 skills 目录外文件 → Deno 拒绝（exitCode 非 0）
- 场景 C：脚本发起未声明的网络连接 → Deno 拒绝
- 场景 D：inline 纯计算代码正常执行
- 场景 E：inline 代码尝试读文件 → Deno 拒绝

---

## 与其他层的关系

- 第一层的 `pnpm verify` 内容（scenarios、第一层 audit、server/sdk/channels smoke）保持不变
- 第二层五个 smoke（013–017）均追加到 `pnpm verify`，`test:sandbox` 在 Deno 不可用时自动 skip
- 真实 LLM 下的 Skill 完整路径验证不并入 `verify`（需 `OPENAI_*` 环境变量，与第一层真实审计模式一致）
