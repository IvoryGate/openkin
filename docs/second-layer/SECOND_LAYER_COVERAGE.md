# 第二层能力覆盖说明

目标：说清楚三个 smoke 脚本各自验什么、验证边界在哪里、哪些场景在 CI 默认覆盖、哪些需要额外条件。

**代码位置**（smoke 脚本在 `scripts/`，Skill 在 `packages/core/src/skills/`）：

- `scripts/test-tools.mjs` — 内置工具 smoke
- `scripts/test-mcp.mjs` — MCP smoke
- `scripts/test-skills.mjs` — Skill smoke

## 三条验证线

| 入口 | 是否调用外网 | 是否并入 `pnpm verify` | 典型用途 |
|------|-------------|----------------------|----------|
| `pnpm test:tools` | 否 | **是** | 确认 builtin 工具注册与 ReAct 调用路径 |
| `pnpm test:mcp` | 否（npx 本地） | **是** | 确认 MCP stdio 接入 + listChanged 动态更新 |
| `pnpm test:skills` | 否 | **是** | 确认 Skill 三件套工具（list/read/run）调用链路 |

## 内置工具覆盖矩阵

| 能力 | `test:tools` | 说明 |
|------|-------------|------|
| `echo` 工具注册与调用 | ✓ | 最简 ReAct 闭环：tool_call → tool_result → answer |
| `get_current_time` 工具注册与调用 | ✓ | 有真实时间戳，可断言格式 |
| `InMemoryToolRuntime` 多 provider 组合 | ✓ | server 启动时静态注入 |
| tool call 完整 steps 记录 | ✓ | 断言 `steps[*].toolCalls` 不为空 |
| `run_completed` SSE 事件 | ✓ | 通过 SSE stream 确认终态 |

## MCP 工具覆盖矩阵

| 能力 | `test:mcp` | 说明 |
|------|-----------|------|
| stdio 子进程启动 | ✓ | 拉起 `@modelcontextprotocol/server-everything` |
| `tools/list` 发现工具 | ✓ | connect() 时首次查询 |
| `tools/call` 执行工具 | ✓ | 触发 MCP echo 工具，断言 toolCalls |
| `listChanged` 通知响应 | ✓ | 触发刷新，验证不 crash |
| 刷新失败保留旧缓存 | 不默认测（难稳定构造） | 由代码逻辑 + 错误处理保证 |
| MCP server 进程异常退出 | ✓（部分） | 验证不 crash server，返回 TOOL_NOT_FOUND |
| 多 provider 组合（builtin + MCP）| ✓ | server 启动时同时注入两个 provider |

## Skill 覆盖矩阵

| 能力 | `test:skills` | 说明 |
|------|--------------|------|
| `list_skills` 扫描 skills 目录 | ✓ | 返回 weather skill |
| `read_skill` 读取 SKILL.md | ✓ | 返回完整 markdown |
| `run_script` 执行 weather.ts | ✓ | 通过 SKILL_ARGS 传入城市名 |
| 路径穿越攻击被拒绝 | ✓ | `run_script` 校验文件路径 |
| 超时（30s）| 不默认测（避免 flaky）| 由实现逻辑保证 |
| inline 代码执行 | 不默认测 | 临时文件模式，留后续计划 |
| Agent 三步调用链路 | ✓ | list → read → run 全部出现在 steps 中 |
| `run_completed` SSE 事件 | ✓ | 通过 SSE stream 确认终态 |

## 真实 LLM 下的第二层验证

Mock LLM 可以精确控制工具调用顺序，但无法验证真实模型是否能正确理解 `SKILL.md` 并决策执行路径。

| 入口 | 是否调用外网 | 用途 |
|------|-------------|------|
| （待建）`test:second-layer-real` | **是**（需 `OPENAI_*`） | 真实模型下验证 Skill 三步路径、MCP 调用 |

该命令在 013/014/015 稳定后另开计划添加，不并入 `pnpm verify`。

## 为何不「全部真实、全部进 verify」

1. **确定性**：Mock LLM 可以精确控制工具调用顺序；真实模型可能因 prompt 理解偏差跳过某步。
2. **费用与配额**：同第一层的理由。
3. **真实验证路径已预留**：配置 `.env` 后运行 `test:second-layer-real`（待建）。

## 推荐用法

- 日常提交：`pnpm verify`（含三个第二层 smoke）。
- 联调/发版前：配置 `OPENAI_*` 后运行 `test:second-layer-real`（待建）。
- 若 Skill smoke 中 Agent 未调用 `list_skills`：检查 server 的 system prompt 是否引导 Agent 先发现 Skill。
