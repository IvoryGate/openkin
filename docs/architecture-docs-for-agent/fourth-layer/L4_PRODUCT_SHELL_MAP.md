# L4 Product Shell Map（099 冻结）

## 本文件解决什么

在 **不** 扩展 L3 contract 的前提下，冻结第四层 **terminal-first 工程产品壳** 的：

1. 产品 **surface** 名称与职责（CLI 与 TUI 共用同一名词表，见 `packages/cli/src/l4-product-map.ts`）。
2. **ProductControlPlane** 的本地状态从哪些 L3 数据源聚合（只描述来源类型，不重复 API 表）。
3. 当前 **已有** CLI 子命令与 **chat 内斜杠** 到 surface 的归属。

权威实现漂移防护：`pnpm test:l4-shell-map`（见 `scripts/test-l4-shell-map.ts`）。

## 1. 产品 Surface（7）

| ID（代码） | 人类名 | 职责 |
|------------|--------|------|
| `home_shell` | HomeShell | 无会话 / 新会话前：可发现性、空态、入口提示（TUI 全屏下「壳」的顶层；行模式下的横幅/ home hints）。 |
| `conversation_shell` | ConversationShell | 当前会话的输入、流式输出、工具与回复呈现；与模型对话的主界面。 |
| `session_thread` | SessionThreadSurface | 会话身份、历史消息、删除/切换、列表与别名；**Session = thread** 的叙事。 |
| `inspect` | InspectSurface | 只读/运维向自省：健康、工具清单、Skill 清单、系统与内置能力元数据（`GET /v1/tools` 等）。 |
| `logs` | LogsSurface | 持久化/结构化 **应用日志** 查询面（`GET /v1/logs`）；与「对话」内容区分。 |
| `task` | TaskSurface | 定时/触发任务与 TaskRun 查询、启停。 |
| `product_control_plane` | ProductControlPlane | **跨面聚合态**：在终端里可读的「当前工作区+服务」快照（**本地产品语义，非 L5 remote control plane**）。典型为 `GET /v1/system/status`、TUI/行模式状态条所反映的 tool/task/session 统计。 |

## 2. ProductControlPlane：状态来源（L3 数据类）

本层只列 **来源类别**（与 `L4ControlPlaneStateSource` 对齐），不复制 OpenAPI。

| 来源 | 含义 | 在 CLI/TUI 中的典型落点 |
|------|------|-------------------------|
| `session` | 会话 DTO、列表、message 行 | `sessions *`、`/session *`、session picker |
| `run` | trace、流、终态、attach/cancel 语义 | `streamRun`、`sessions runs`、`/runs`、TUI `run·N active`（**104**） |
| `context` | 上下文/紧凑描述符、记忆贡献（与 **102** 同 GET） | `/compact`、**101** `inspect context` / **102** `inspect memory`、TUI rail |
| `approval` | 审批与危险协议 | **103** `inspect approvals` / `inspect approval`、TUI `appr·N pending`；L3 队列 |
| `tool` | 工具条与 risk/category 元数据 | `inspect tools`、TUI/流里的 tool 行 |
| `task` | 任务与 TaskRun | `tasks *`、`/tasks *`、status 中 task 统计 |
| `log` | 日志行（非用户聊天） | `inspect logs`、事件/日志流（可观测） |

## 3. CLI 顶层动词的 Surface 归属

| 顶层动词 | 主要 Surface | 说明 |
|----------|--------------|------|
| `help` | `home_shell` | 发现性与命令面入口。 |
| `chat` | `conversation_shell`（TUI/空会话时带 `home_shell`） | 主对话与 REPL。 |
| `sessions` | `session_thread` | 列表/show/messages/**runs**/cancel-run/delete 等。 |
| `inspect` | 按子命令分：见下表 | 自省族。 |
| `tasks` | `task` | 任务族。 |
| `plan` | `home_shell` / `conversation_shell` | 本地 `.theworld/plan` 工件、review、execute（**105**） |

### `sessions` 子命令（节选）

| 子命令 | 主要 Surface | 说明 |
|--------|--------------|------|
| `runs` | `session_thread` | 列出会话 run 摘要（L3 046；**104** 人类化 + recover 提示） |
| `cancel-run` | `session_thread` | `POST` cancel（052） |

### `inspect` 子命令

| 子命令 | 主要 Surface | L3 数据来源（摘要） |
|--------|--------------|--------------------|
| `health` | `inspect` | 存活探测（`GET /health`）。 |
| `status` | `product_control_plane` | `GET /v1/system/status`（含 tools/skills 计数等快照）。 |
| `logs` | `logs` | `GET /v1/logs`。 |
| `tools` | `inspect` | `GET /v1/tools`（含 096 起 risk/category）。 |
| `skills` | `inspect` | `GET /v1/skills`。 |
| `context` | `inspect` | `GET /v1/runs/.../context` 全文（**101**，`l4-context-view`） |
| `memory` | `inspect` | 同上 GET 的 memory 向视图 + 无参时静态 taxonomy（**102**，`l4-layered-memory`） |
| `approvals` | `inspect` | 列表 + resolve（**103**，`l4-approval-surface`） |
| `approval` | `inspect` | 单条 `id` 与 `approve\|deny\|cancel`（**103**） |
| `resume` | `inspect` | 仅产品词表输出（**104**，无 I/O） |

## 4. Chat 内斜杠（本地处理，不单独命名 surface）

| 斜杠 | 主要 Surface | 说明 |
|------|--------------|------|
| `/help` `/exit` | `conversation_shell` | 会话内元命令。 |
| `/session` | `session_thread` | 对当前或列举会话信息。 |
| `/inspect` | 同 CLI `inspect` 子集 | 仅 health/status 等已实现子命令。 |
| `/tasks` | `task` | 与 `theworld tasks` 同语义子集。 |
| `/skills` | `inspect` | Skill 发现。 |
| `/compact` | `conversation_shell` + `context` 源 | 触发压缩请求。 |
| `/context` | `inspect` | 本会话最近 run 的 L3 上下文报告（**101**）。 |
| `/memory` | `inspect` | 同一次 run 的记忆向摘要（**102**）。 |
| `/approvals` | `inspect` | 本会话行过滤后的审批表（**103**）。 |
| `/runs` | `session_thread` | 本会话 `listSessionRuns` 人类化列表（**104**）。 |
| `/rename` | `session_thread` | 仅本地 alias 文件，不改服务端 DTO 时仍属会话身份叙事。 |
| `/rewind` | `session_thread` | 未实现，占位。 |

TUI 专有：`Ctrl+L` 会话列表、Ink 全屏等仍映射到 `session_thread` + `home_shell`（叠层时）。

## 5. 与 `ENGINEERING_PRODUCT_CAPABILITIES.md` 的关系

- **B1 Terminal-First Product Shell** 的壳名与本文 **一一对应**；B2–B8 由 **100–106** 在本文 vocabulary 上展开；**B2** 首启/空态/发现性细节见 [L4_ONBOARDING.md](./L4_ONBOARDING.md)（`pnpm test:l4-onboarding`）。**102** 分层记忆词表见 [L4_LAYERED_MEMORY.md](./L4_LAYERED_MEMORY.md)（`pnpm test:l4-memory`）。**103** 审批流见 [L4_APPROVAL_PRODUCT_FLOW.md](./L4_APPROVAL_PRODUCT_FLOW.md)（`pnpm test:l4-approval`）。**104** 背景/恢复见 [L4_BACKGROUND_RESUME.md](./L4_BACKGROUND_RESUME.md)（`pnpm test:l4-background`）。**105** 计划工作流见 [L4_PLAN_REVIEW_EXECUTE.md](./L4_PLAN_REVIEW_EXECUTE.md)（`pnpm test:l4-plan`）。**106** 终端壳体验收口见 [L4_TERMINAL_POLISH.md](./L4_TERMINAL_POLISH.md)（`pnpm test:l4-polish`）。
- **L3** 仅作数据源；**L5/L6** 不扩展本文边界。

## 6. 变更流程

- 新增 CLI 子命令、斜杠或 TUI 路由时，先更新 `l4-product-map.ts` 与本文，并保证 `test:l4-shell-map` 通过。
- 新增首次使用、空态或错误恢复文案时，先更新 [L4_ONBOARDING.md](./L4_ONBOARDING.md) 与 `l4-onboarding.ts`，并保证 `test:l4-onboarding` 通过。
