# 第二层能力覆盖说明

目标：说清楚各 smoke 脚本验什么、验证边界在哪里、哪些场景在 CI 默认覆盖、哪些需要额外条件。

**代码位置**：

- smoke 脚本在 `scripts/`
- Skill 在 `workspace/skills/`（运行时工作区，不在 `packages/` 源码内）
- 工具实现在 `packages/core/src/tools/`

## 五条验证线（013–017）

| 入口 | 是否调用外网 | 是否并入 `pnpm verify` | 前置条件 | 典型用途 |
|------|-------------|----------------------|----------|----------|
| `pnpm test:tools` | 否 | **是** | 无 | 确认 builtin 工具注册与 ReAct 调用路径 |
| `pnpm test:mcp` | 否（npx 本地） | **是** | 无 | 确认 MCP stdio 接入 + listChanged 动态更新 |
| `pnpm test:skills` | 否 | **是** | 无 | 确认 Skill 三件套工具（read/run/list）调用链路 |
| `pnpm test:self-management` | 否 | **是** | 无 | 确认 write_skill / manage-mcp / read_logs |
| `pnpm test:sandbox` | 否 | **是**（Deno 不可用时 skip） | 需安装 Deno | 确认 Deno 沙箱权限隔离 |

---

## 内置工具覆盖矩阵（013，`test:tools`）

> **变更说明（2026-04-04）**：`echo` 工具已从 builtin provider 移除（它被模型误用为"思考输出"工具而非真实操作）。
> 新增 `run_command`、`read_file`、`write_file`、`list_dir` 四个文件系统 / Shell 工具。

| 能力 | `test:tools` | 说明 |
|------|-------------|------|
| `get_current_time` 工具注册与调用 | ✓ | 有真实时间戳，可断言格式 |
| `run_command` 注册与调用 | ✓ | 执行 shell 命令，断言 stdout/exitCode |
| `read_file` 注册与调用 | ✓ | 读文件内容，断言 content 字段存在 |
| `write_file` + `list_dir` 组合 | ✓ | 写文件后列目录，断言文件出现 |
| `InMemoryToolRuntime` 多 provider 组合 | ✓ | server 启动时静态注入 |
| tool call 完整 steps 记录 | ✓ | 断言 `steps[*].toolCalls` 不为空 |
| `run_completed` SSE 事件 | ✓ | 通过 SSE stream 确认终态 |
| `echo` 工具（已移除，不再验） | — | 移至测试辅助，不注册到 Agent |

---

## MCP 工具覆盖矩阵（014，`test:mcp`）

| 能力 | `test:mcp` | 说明 |
|------|-----------|------|
| stdio 子进程启动 | ✓ | 拉起 `@modelcontextprotocol/server-everything` |
| `tools/list` 发现工具 | ✓ | connect() 时首次查询 |
| `tools/call` 执行工具 | ✓ | 触发 MCP echo 工具，断言 toolCalls |
| `listChanged` 通知响应 | ✓ | 触发刷新，验证不 crash |
| 刷新失败保留旧缓存 | 不默认测（难稳定构造） | 由代码逻辑 + 错误处理保证 |
| MCP server 进程异常退出 | ✓（部分） | 验证不 crash server，返回 TOOL_NOT_FOUND |
| 多 provider 组合（builtin + MCP）| ✓ | server 启动时同时注入两个 provider |
| `registerProvider()` 热注册 | ✓（016 后补充）| 运行时热注册新 provider，不重启 server |

---

## Skill 覆盖矩阵（015，`test:skills`）

| 能力 | `test:skills` | 说明 |
|------|--------------|------|
| `workspace/skills/` 目录扫描 | ✓ | 确认 weather skill 被发现 |
| System Prompt 注入 Skill 描述 | ✓ | 断言 server System Prompt 包含 weather 描述 |
| `read_skill` 读取 SKILL.md | ✓ | 返回完整 markdown |
| `run_script` 执行 weather.ts | ✓ | 通过 SKILL_ARGS 传入城市名 |
| 路径穿越攻击被拒绝 | ✓ | `run_script` 校验文件路径 |
| 敏感环境变量不透传子进程 | ✓ | 验证 OPENAI_API_KEY 不出现在子进程环境中 |
| stdout/stderr 大小截断（64KB） | 不默认测（避免慢） | 由实现逻辑保证 |
| 超时（30s）| 不默认测（避免 flaky）| 由实现逻辑保证 |
| `inline` 模式 | ✓（017 已启用） | Deno 可用时可传入代码字符串执行；Deno 不可用返回明确错误 |
| Agent 两步调用链路 | ✓ | read → run 全部出现在 steps 中 |
| `list_skills` 兜底工具 | ✓ | 调用后返回 weather skill 列表 |
| `run_completed` SSE 事件 | ✓ | 通过 SSE stream 确认终态 |

---

## Agent 自我管理覆盖矩阵（016，`test:self-management`）

| 能力 | `test:self-management` | 说明 |
|------|----------------------|------|
| `write_skill` 创建新 Skill 目录 | ✓ | 断言目录和文件被写入 `workspace/skills/` |
| `write_skill` 路径安全校验 | ✓ | 非法 skillId 或路径穿越被拒绝 |
| 新 Skill 可立即 `read_skill` + `run_script` | ✓ | 无需重启 |
| `FileLogger` 写入日志文件 | ✓ | 断言 `workspace/logs/` 有当天日志文件 |
| `read_logs` 返回工具调用事件 | ✓ | 断言返回事件列表不为空 |
| `manage-mcp` Skill 存在 | ✓ | 断言 `workspace/skills/manage-mcp/SKILL.md` 存在 |
| `add-mcp.ts` 写入 `mcp-registry.json` | ✓ | 断言文件内容更新 |
| 热注册后新 MCP 工具可用 | ✓ | 调用 `/_internal/mcp/register` 后工具在 run 中可用 |
| `mcp-registry.json` 重启后自动加载 | ✓ | 重启子进程，验证 MCP 工具仍可用 |
| `/_internal/mcp/*` 拒绝非 loopback 请求 | ✓ | 模拟外部 IP 请求被 403 |
| `InMemoryToolRuntime.registerProvider()` | ✓ | 接口单元测试 |

---

## 沙箱覆盖矩阵（017，`test:sandbox`，需要 Deno）

> **017 已完成**。Deno 安装后自动启用；未安装时 `test:sandbox` 输出 `SKIP` 并以 exit 0 退出，不影响 `pnpm verify`。

| 能力 | `test:sandbox` | 说明 |
|------|---------------|------|
| 正常 Skill 在 Deno 沙箱下正常执行（场景 A） | ✓ | `weather.ts` 输出与无沙箱一致 |
| 读取 skills/ 外文件被拒绝（场景 B） | ✓ | `Deno.readTextFileSync("/etc/hosts")` → exitCode 非 0 |
| 未声明网络连接被拒绝（场景 C） | ✓ | `Deno.connect` 无 `--allow-net` → exitCode 非 0 |
| `inline` 合法代码执行（场景 D） | ✓ | 纯计算逻辑，无 I/O，结果正确 |
| `inline` 读文件被拒绝（场景 E） | ✓ | `--deny-read` → exitCode 非 0 |
| `inline` 临时文件执行后删除 | ✓（实现保证） | try/finally 确保清理，不在测试中断言（避免竞态）|
| `permissions` 缺失使用默认权限 | ✓（实现保证） | 不填 permissions 默认 `read: ["."]`，运行不受影响 |
| `net: ["*"]` 被框架拒绝 | ✓（实现保证） | 校验在执行前，返回 `TOOL_PERMISSION_DENIED` |
| Deno 不可用时降级到 tsx | skip（Deno 可用时不测降级路径） | 降级由实现逻辑保证，`.ts` Skill 正常执行 |

---

## 真实 LLM 下的第二层验证

Mock LLM 可以精确控制工具调用顺序，但无法验证真实模型是否能正确理解 `SKILL.md` 并决策执行路径。

| 入口 | 是否调用外网 | 用途 |
|------|-------------|------|
| （待建）`test:second-layer-real` | **是**（需 `OPENAI_*`） | 真实模型下验证 Skill 两步路径、MCP 调用、自我管理 |

该命令在 013–017 稳定后另开计划添加，不并入 `pnpm verify`。

---

## 为何不「全部真实、全部进 verify」

1. **确定性**：Mock LLM 可以精确控制工具调用顺序；真实模型可能因 prompt 理解偏差跳过某步。
2. **费用与配额**：同第一层的理由。
3. **真实验证路径已预留**：配置 `.env` 后运行 `test:second-layer-real`（待建）。

---

## 推荐用法

- 日常提交：`pnpm verify`（含五个第二层 smoke，sandbox 在无 Deno 时自动 skip）。
- 安装 Deno 后：`pnpm test:sandbox` 验证沙箱隔离。
- 联调/发版前：配置 `OPENAI_*` 后运行 `test:second-layer-real`（待建）。
- 若 Skill smoke 中 Agent 未正确调用 `read_skill`：检查 server System Prompt 是否包含 Skill 描述列表。
- 若 `test:self-management` 中热注册失败：检查 `/_internal/mcp/register` 是否只接受 loopback。
