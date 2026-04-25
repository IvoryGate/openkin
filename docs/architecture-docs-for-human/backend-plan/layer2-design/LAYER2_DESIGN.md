# Layer 2 Design：Tool & Integration Layer

## 一句话定位

第二层（013–017）在第一层核心运行时基础上，打通三种工具来源接入、Agent 自我管理能力、CLI 对话界面，以及沙箱安全隔离。

---

## 层级关系

```
Layer 2 - Tool & Integration Layer（本文档范围）
  ├── 内置工具（builtin）        → packages/core/src/tools/
  ├── MCP 工具（mcp）            → packages/core/src/tools/mcp-tool-provider.ts
  ├── Skill 框架（skill）        → packages/core/src/tools/run-script.ts + workspace/skills/
  ├── Agent 自我管理             → write_skill / manage-mcp / read_logs
  ├── CLI 对话界面               → packages/server/src/cli-chat.ts
  └── Deno 沙箱（进行中）        → exec-plans/active/017_sandbox.md

Layer 1 - Core Runtime（已完成，012 关闭）
  ├── ReActRunEngine
  ├── SimpleContextManager
  ├── OpenAiCompatibleChatProvider
  ├── Session / History
  └── HTTP Server + SSE 流协议
```

---

## 五个执行计划（013–017）

### 013 · 内置工具层（已完成）

**目标**：让 Agent 能执行真实的文件系统操作和 Shell 命令。

**已落地工具**：

| 工具 | 说明 |
|------|------|
| `get_current_time` | 获取当前时间 |
| `run_command` | 执行任意 Shell 命令，截断 stdout/stderr 至 64KB |
| `read_file` | 读取文件内容 |
| `write_file` | 写文件（自动创建父目录） |
| `list_dir` | 列目录内容 |

**关键设计**：`InMemoryToolRuntime` 支持多个 ToolProvider 组合注册，Agent 在 `getRuntimeView()` 时聚合所有 provider 的工具列表。

**验证**：`pnpm test:tools`（并入 `pnpm verify`）。

---

### 014 · MCP 工具接入（已完成）

**目标**：通过 stdio 子进程接入任意 MCP server，动态发现和调用第三方工具。

**关键设计**：

- `McpToolProvider` 在 `connect()` 时调用 `tools/list` 发现工具，并订阅 `listChanged` 通知。
- 工具变更时异步调用 `refreshTools()`，刷新期间返回旧缓存，不阻塞进行中的 run。
- 刷新失败记录日志，保留旧缓存，不 crash server。
- `registerProvider()` 支持运行时热注册新 MCP provider（不重启 server）。

**`/_internal/mcp/*` 内部接口**：只接受 loopback（127.0.0.1）请求，外部 IP 返回 403。

**验证**：`pnpm test:mcp`（并入 `pnpm verify`）。

---

### 015 · Skill 框架（已完成）

**目标**：让用户在 `workspace/skills/` 放置脚本文件夹，Agent 运行时自动发现并执行，无需改源码。

**Skill 结构**：

```
workspace/skills/
  {skill-id}/
    SKILL.md          ← 唯一强制文件：能力描述、参数说明、调用示例
    {script}.ts       ← 实现脚本（文件名不固定，在 SKILL.md 中声明）
    {script}.py       ← 支持任意语言（Python / TypeScript / Shell）
```

**三件套工具**：

| 工具 | 作用 |
|------|------|
| `list_skills` | 扫描 `workspace/skills/`，返回 skill 列表和简介 |
| `read_skill` | 读取指定 skill 的 `SKILL.md` 完整内容 |
| `run_script` | 执行 skill 目录下的指定脚本，通过 `SKILL_ARGS` 环境变量传参 |

**安全约束**：
- `run_script` 严格限定执行路径在 `workspace/skills/{skillId}/` 内，拒绝路径穿越。
- 子进程环境变量过滤：`OPENAI_API_KEY` 等敏感 key 不透传。
- 输出截断：stdout/stderr 各 64KB 上限。

**热加载设计**：System Prompt 中的 Skill 列表在每次 LLM 调用前动态生成（`AgentDefinition.systemPrompt` 为异步工厂函数），新增 Skill 无需重启 server 即生效。

**验证**：`pnpm test:skills`（并入 `pnpm verify`）。

---

### 016 · Agent 自我管理（已完成）

**目标**：Agent 能自己创建 Skill、管理 MCP 注册、查阅历史日志。

**自我管理工具**：

| 工具 | 作用 |
|------|------|
| `write_skill` | 在 `workspace/skills/` 创建或更新 Skill 文件（含安全校验） |
| `read_logs` | 读取 `workspace/logs/` 下当天的工具调用事件日志 |

**manage-mcp Skill**（内置于 workspace）：

| 脚本 | 作用 |
|------|------|
| `add-mcp.ts` | 写入 `workspace/mcp-registry.json`，调用 `/_internal/mcp/register` 热注册 |
| `remove-mcp.ts` | 从 registry 中移除 MCP server，调用 `/_internal/mcp/unregister` |
| `list-mcp.ts` | 列出当前已注册的 MCP server |

**持久化机制**：`mcp-registry.json` 在 server 启动时自动读取，重启后 MCP 注册状态恢复。

**验证**：`pnpm test:self-management`（并入 `pnpm verify`）。

---

### 017 · Deno 沙箱（进行中）

**目标**：`run_script` 切换到 Deno 运行时，用权限声明（`--allow-read` / `--allow-net` 等）隔离 Skill 执行环境；同时开放 `inline` 模式（直接在请求中传代码）。

**当前状态**：设计阶段，详见 `docs/exec-plans/active/017_sandbox.md`。

---

## CLI 对话界面

> 文件：`packages/server/src/cli-chat.ts`

`pnpm chat` 是纯客户端，通过 `@openkin/client-sdk` 调用 Server REST + SSE API，本身不持有任何 Agent 逻辑。

**架构**：
```
CLI Chat（cli-chat.ts）
  → POST /v1/sessions        创建 Session
  → POST /v1/sessions/:id/run  发送消息（异步）
  → GET  /v1/runs/:traceId/stream  订阅 SSE 流
       ├── tool_call 事件  → 渲染 ⚙ tool_name(args)
       ├── tool_result 事件 → 渲染 ✓/✗ + 输出内容
       ├── text_delta 事件  → 逐 token 打印（真流式）
       └── run_completed 事件 → 显示最终回复，返回提示符
```

**真·流式输出链路**：

```
LLM SSE → openai-chat-provider.ts (onTextDelta)
        → ReActRunEngine → hookRunner.textDelta()
        → sse-hooks.ts → TraceStreamHub.emit('text_delta')
        → HTTP SSE → client-sdk parseSseStream()
        → cli-chat.ts 终端逐字打印
```

---

## 本轮额外修复（2026-04-04）

在本次 Layer 2 演进过程中，发现并修复了三个基础协议 bug：

### Bug 1：工具重复调用（历史缺失）

**现象**：Agent 每轮都重新调用同一个工具（如 `run_script` 连续调用 3 次）。

**根因**：`run-engine.ts` 在工具调用后只追加了 `tool` 消息，没有追加 **assistant 的工具决策消息**。OpenAI 协议要求对话序列为：

```
user → assistant(tool_calls) → tool(result) → assistant(下一步)
```

缺少中间的 `assistant(tool_calls)` 消息，模型每轮都从 user 消息重新决策。

**修复**：在 `executeToolCall` 之前，先将 assistant tool-call 决策消息写入 history（`appendAssistant`）。

### Bug 2：tool_call_id 不匹配

**根因**：各工具内部自己生成 `toolCallId`（如 `run_script-0`），与模型给的 `ToolCall.id`（如 `longcat-tc-xxx`）不一致，违反 OpenAI 协议（`assistant.tool_calls[].id === tool.tool_call_id`）。

**修复**：在 `executeToolCall()` 中强制用 `args.call.id` 覆盖 result 的 `toolCallId`。

### Bug 3：assistant tool-call 消息格式错误

**根因**：`messageToOpenAi` 将 assistant 工具决策消息的 json parts 字符串化写入 `content`，而非转换为标准 `tool_calls` 数组。

**修复**：在 `messageToOpenAi` 中识别 assistant + json parts 的组合，输出 `{role: "assistant", content: null, tool_calls: [...]}` 格式。

---

## 当前覆盖一览

| 计划 | 状态 | verify 入口 |
|------|------|------------|
| 013 内置工具 | ✅ 完成 | `pnpm test:tools` |
| 014 MCP 接入 | ✅ 完成 | `pnpm test:mcp` |
| 015 Skill 框架 | ✅ 完成 | `pnpm test:skills` |
| 016 自我管理 | ✅ 完成 | `pnpm test:self-management` |
| 017 Deno 沙箱 | 🚧 进行中 | `pnpm test:sandbox`（Deno 可用时） |
| CLI 对话界面 | ✅ 完成 | `pnpm chat` |
| 真流式输出 | ✅ 完成 | - |
| 协议 bug 修复 | ✅ 完成（2026-04-04）| - |

**下一步**：017 Deno 沙箱落地后，第二层即可宣告整体完成，进入第三层（通道适配层）或服务协议扩展。
