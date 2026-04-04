# CLI Chat 使用指南

## 是什么

`pnpm chat` 是一个运行在终端里的对话客户端，让你直接在命令行里和 OpenKin Agent 聊天，不需要前端页面。

---

## 与 Server 的关系

```
┌─────────────────────────────────────────────────────┐
│                   你的终端（两个窗口）                │
│                                                     │
│  窗口 1：pnpm dev:server          窗口 2：pnpm chat │
│  ┌─────────────────────┐          ┌───────────────┐ │
│  │   OpenKin Server    │  HTTP    │  CLI Chat     │ │
│  │  (http-server.ts)   │◄────────►│  (cli-chat.ts)│ │
│  │                     │  :3333   │               │ │
│  │  ┌───────────────┐  │          └───────────────┘ │
│  │  │ OpenKinAgent  │  │                            │
│  │  │   LLM         │  │  CLI Chat 本质上是 SDK     │
│  │  │   Tools       │  │  客户端，它调用 Server     │
│  │  │   Skills      │  │  暴露的 REST API           │
│  │  │   MCP         │  │                            │
│  │  └───────────────┘  │                            │
│  └─────────────────────┘                            │
└─────────────────────────────────────────────────────┘
```

**Server**（`packages/server/src/cli.ts`）是真正的 Agent 运行时：
- 加载 LLM（读取 `.env` 里的 `OPENAI_*` 变量）
- 扫描 `workspace/skills/`，构建 System Prompt
- 加载 `workspace/mcp-registry.json`，启动 MCP 子进程
- 监听 `http://127.0.0.1:3333`，提供 REST + SSE API

**CLI Chat**（`packages/server/src/cli-chat.ts`）是轻量客户端：
- 用 `@openkin/client-sdk` 调用 Server API
- 创建 Session → 发送消息 → 订阅 SSE 流
- 把 SSE 事件渲染成彩色终端输出（工具调用、Agent 回复）
- **它本身不持有任何 Agent 逻辑**，只是界面层

---

## 快速开始

### 前置条件

在根目录创建 `.env` 文件（首次使用时）：

```bash
# .env
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1   # 或你的代理地址
OPENAI_MODEL=gpt-4o-mini                    # 可选，默认 gpt-4o-mini
```

### 启动步骤

**第一步：启动 Server**（保持运行）

```bash
pnpm dev:server
```

看到类似输出表示启动成功：

```
[server] OpenKin server listening on http://127.0.0.1:3333
[server] Skills loaded: weather, manage-mcp
[server] LLM provider: OpenAiCompatibleChatProvider (gpt-4o-mini)
```

**第二步：新开一个终端，启动 Chat**

```bash
pnpm chat
```

---

## 使用方式

```
OpenKin Chat  (server: http://127.0.0.1:3333)
Type your message and press Enter. Ctrl+C or "exit" to quit.

Session: a862f728-...

You: 帮我运行 fibonacci.py
⠋ Thinking…
  💭 我来运行这个 Python 脚本看看结果。
  ⚙  run_command({"command":"python3 workspace/tmp/fibonacci.py 10"})
⠋ Thinking…
  ✓ run_command
     斐波那契数列前10项：
     [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
⠋ Thinking…
Agent: 脚本运行成功！斐波那契数列前 10 项为 [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]。

You: exit

Bye!
```

### 终端显示说明

输出是**实时流式**的——每个工具调用和结果在发生时立即显示，不需要等整轮结束。

| 样式 | 含义 |
|------|------|
| `You: ` 青色粗体 | 你的输入提示符 |
| `⠋ Thinking…` 黄色 spinner | Agent 正在处理中（LLM 推理或等待工具结果） |
| `💭 ...` 紫色斜体 | Agent 的中间推理文本（工具调用前的思考） |
| `⚙  tool_name(...)` 灰色粗体 | Agent 调用了某个工具，括号内是入参（截断显示） |
| `✓ tool_name` 后跟多行输出 | 工具执行成功；若有 stdout 则逐行展示（最多 20 行） |
| `✗ tool_name (exit N)` 红色 | 工具执行失败，显示 exit code 及 stderr |
| `Agent: ` 绿色粗体 | Agent 最终回复 |
| `✗ Run failed [CODE]: ...` 红色 | 整轮运行失败，含错误码 |

#### run_command / run_script 输出格式

工具结果里如果包含 `stdout` 字段，会逐行展示而不是压缩成 JSON，方便直接阅读脚本输出：

```
  ✓ run_command
     斐波那契数列前5项：
     [0, 1, 1, 2, 3]
```

失败时同时显示 stderr：

```
  ✗ run_command (exit 1)
     请输入有效的整数
```

### 退出方式

任意一种都可以：
- 输入 `exit` 或 `quit`
- 按 `Ctrl+C`
- 按 `Ctrl+D`（EOF）

---

## 自定义 Server 地址

默认连接 `http://127.0.0.1:3333`，如果 Server 跑在别处：

```bash
OPENKIN_SERVER_URL=http://10.0.0.5:3333 pnpm chat
```

---

## 常见问题

**Q: `✗ Cannot connect to server` 报错**

Server 没有启动，先运行 `pnpm dev:server`。

**Q: Agent 一直在 `Thinking…` 不回复**

可能是 LLM API 超时或网络问题，检查 `.env` 里的 `OPENAI_*` 配置是否正确。

**Q: 工具调用显示了但没有最终回复**

SSE 流里缺少 `run_completed` 事件，查看 Server 终端日志排查。

**Q: 每次 `pnpm chat` 都是新 Session，历史记录没了**

设计如此。当前 Session 在内存中，重启 Server 或 Chat 后开新 Session。
对话日志会写入 `workspace/logs/agent-YYYY-MM-DD.log`，可用 `read_logs` 工具查阅。

**Q: Agent 回复里出现了 `<longcat_tool_call>` 原始标签**

使用的 LLM 采用 longcat XML 格式的工具调用（非标准 OpenAI `tool_calls` 字段）。
`openai-chat-provider.ts` 已内置 `parseLongcatToolCalls` 解析器自动处理。
如果仍出现此问题，检查 LLM 是否切换到了不兼容的模型。

**Q: Agent 运行脚本时一直报参数错误**

先用 `read_file` 让 Agent 读取脚本内容，了解正确的参数格式，再执行 `run_command`。
不同脚本参数风格不同（有的是 `-n 5`，有的是直接传数字），Agent 需要先看文档再调用。

---

## 流式输出实现

SSE 流式输出通过以下链路实现：

```
ReActRunEngine（每步）
  → sse-hooks.ts (onAfterLLMCall / onAfterToolCall)
  → TraceStreamHub.emit()
  → HTTP SSE 响应 (text/event-stream)
  → SDK parseSseStream()  ← 真正流式，chunk 到来即解析
  → CLI Chat listener     ← 事件到来即渲染
```

关键点：`parseSseStream` 使用 `for await (chunk of body)` 边收字节边解析 SSE 行，不等整个响应体完成。
每个 `tool_call`、`tool_result`、`message` 事件在服务端发出后，客户端毫秒级可见。

## 文件位置

| 文件 | 说明 |
|------|------|
| `packages/server/src/cli.ts` | Server 入口，Agent 运行时 |
| `packages/server/src/cli-chat.ts` | CLI Chat 客户端（含终端渲染逻辑） |
| `packages/server/src/sse-hooks.ts` | SSE 事件发射钩子，含 `message` 中间思考事件 |
| `packages/sdk/client/src/index.ts` | `@openkin/client-sdk`，含流式 `parseSseStream` |
| `packages/core/src/tools/run-command.ts` | `run_command` 内置工具 |
| `packages/core/src/tools/fs-tools.ts` | `read_file` / `write_file` / `list_dir` |
| `packages/core/src/openai-chat-provider.ts` | LLM 提供者，含 longcat XML 格式解析 |
| `workspace/logs/` | 对话日志（每日一文件） |
| `.env` | LLM 配置（不提交到 git） |
