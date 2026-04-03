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

You: 你好
⠋ Thinking…
Agent: 你好！有什么我可以帮助你的吗？

You: 帮我查一下北京天气
  ⚙  run_script({"skillId":"weather","script":"weather.ts","args":{"city":"北京"}})
  ✓ run_script → {"temperature":22,"condition":"晴天"}
Agent: 北京今天天气晴，气温 22°C。

You: exit

Bye!
```

### 终端显示说明

| 样式 | 含义 |
|------|------|
| `You: ` 青色粗体 | 你的输入提示符 |
| `⠋ Thinking…` 黄色 | Agent 正在处理中（spinner） |
| `Agent: ` 绿色粗体 | Agent 最终回复 |
| `⚙  tool_name(...)` 灰色 | Agent 调用了某个工具 |
| `✓ tool_name → ...` 灰色 | 工具执行成功，截断显示结果 |
| `✗ tool_name → ...` 红色 | 工具执行失败 |
| `✗ Run failed: ...` 红色 | 整轮运行失败 |

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

---

## 文件位置

| 文件 | 说明 |
|------|------|
| `packages/server/src/cli.ts` | Server 入口，Agent 运行时 |
| `packages/server/src/cli-chat.ts` | CLI Chat 客户端 |
| `packages/sdk/client/src/index.ts` | `@openkin/client-sdk`，Chat 基于此调用 API |
| `workspace/logs/` | 对话日志（每日一文件） |
| `.env` | LLM 配置（不提交到 git） |
