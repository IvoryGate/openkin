# 项目能力 CLI — 需求草案（迭代中）

> **状态**：草案，与维护者共同迭代。  
> **不替代**：正式执行计划；定稿后可另起 `docs/exec-plans/active/NNN_*.md` 冻结范围与验收。  
> **相关现有能力**：根目录 `package.json` 中大量 `pnpm` 脚本；对话客户端见 [`../architecture-docs-for-agent/second-layer/CLI_CHAT.md`](../architecture-docs-for-agent/second-layer/CLI_CHAT.md)；HTTP 能力矩阵见 [`../architecture-docs-for-agent/third-layer/THIRD_LAYER_COVERAGE.md`](../architecture-docs-for-agent/third-layer/THIRD_LAYER_COVERAGE.md)。
> **下一阶段冻结设计**：见 [`THEWORLD_CLI_SHELL_DESIGN.md`](./THEWORLD_CLI_SHELL_DESIGN.md)、[`THEWORLD_TUI_PRODUCT_DESIGN.md`](./THEWORLD_TUI_PRODUCT_DESIGN.md) 与新的 shell 级 [`THEWORLD_CLI_SHELL_PARITY_DESIGN.md`](./THEWORLD_CLI_SHELL_PARITY_DESIGN.md)；budget-mode 主路径默认应优先执行 `059`、`060`、`067`–`072`，而不是再次从参考项目自行抽象方向。

---

## 0. 基础 CLI（029–034 已落地；035–037 交互与表层命名）

仓库内已提供统一入口 **`pnpm theworld`**（`packages/cli`），并同步提供短别名 **`pnpm world`**；两者都连接**已运行**的 Server。若以 package `bin` 方式分发，`theworld` / `world` 也应指向同一入口。用户可见产品名为 **TheWorld**；monorepo package scope 为 `@theworld/*`；运行时与脚本统一使用 **`THEWORLD_*`** 环境变量。

对话内支持以 **`/`** 开头的本地命令（`/help`、`/inspect health` 等），不发往服务端（exec-plan `035`/`036`）。

验收脚本：`pnpm test:project-cli`（随 `pnpm verify` 运行）。

### 0.1 配置优先级（高 → 低）

| 用途 | 命令行 flag | 环境变量 |
|------|-------------|----------|
| Server 根 URL | `--server-url <url>` | `THEWORLD_SERVER_URL`（默认 `http://127.0.0.1:3333`） |
| HTTP Bearer | `--api-key <key>` | `THEWORLD_API_KEY` |

同一参数若同时提供 flag 与环境变量，**flag 优先**。

### 0.2 子命令一览（当前）

- **`theworld help`**，**`theworld help sessions|inspect|tasks`**
- **`theworld chat`**，**`theworld chat --session <id>`**（继续已有会话）
- **`theworld sessions`**：`list`、`show`、`messages`（支持 `--limit`）、`delete`；多数支持 **`--json`**
- **`theworld inspect`**：`health`（`GET /health`）、`status`、`logs`（可选 `--date`、`--limit`）、`tools`、`skills`；支持 **`--json`**
- **`theworld tasks`**：`list`、`show`、`create --file <json>`、`trigger`、`enable`、`disable`、`runs`；部分支持 **`--json`**

Client surface（会话/消息/Run）经 **`@theworld/client-sdk`**；operator 自检与任务经 **`@theworld/operator-client`**，与 SDK 边界分离。

### 0.3 快速开始（Bash）

```bash
# 终端 1：启动 Server
pnpm dev:server

# 终端 2：对话（新会话）
pnpm theworld chat

# 列出会话，复制 id 后继续同一会话
pnpm theworld sessions list
pnpm theworld chat --session <session-id>

# 健康与系统状态
pnpm theworld inspect health
pnpm theworld inspect status --json
```

### 0.4 快速开始（Windows PowerShell）

```powershell
# 终端 1
pnpm dev:server

# 终端 2
pnpm theworld chat
pnpm theworld sessions list --json
pnpm theworld inspect health
```

### 0.5 手工烟测建议

1. 确认 `pnpm dev:server` 已监听（日志含 `listening`）。
2. `pnpm theworld help` 与 `pnpm theworld help tasks` 可读。
3. `pnpm theworld chat` 发一条消息后 `exit`；`pnpm theworld sessions list --json` 可见该会话。
4. （可选）准备符合 `CreateTaskRequest` 的 JSON 文件后执行 `pnpm theworld tasks create --file path.json`。
5. `pnpm world help` 与 `pnpm theworld help` 输出等价。

更完整的终端对话行为说明见 [`../architecture-docs-for-agent/second-layer/CLI_CHAT.md`](../architecture-docs-for-agent/second-layer/CLI_CHAT.md)。

### 0.55 Shell parity 验收（067–072；手工 + 自动化）

- **自动化**：`pnpm test:project-cli`（`pnpm test:cli-shell` 同脚本）覆盖 help 叙事、会话流、line home 提示等；随 `pnpm verify` 运行。
- **手工 product review**（TTY）：宽/窄终端、`NO_COLOR`、failed/completed run、`--pick`/`--resume`、空 home vs 有消息对话、TUI home shell 与 transcript 视口。
- **Benchmark**：以 `THEWORLD_CLI_SHELL_PARITY_DESIGN.md` 与 OpenCode / Claude Code 类体验为对照，记录差距在「仅壳层可修」vs「需 contract 路线」的分流（见 `CLI_SHELL_CONTRACT_GAPS.md`）。

### 0.6 已完成阶段与后续 rename

以下阶段已完成并归档：

- `035_cli_slash_commands.md`
- `036_cli_terminal_ux.md`
- `037_theworld_surface_rename.md`

当前后续重点已切到 deep rename：

- `038_deep_rename_program.md`
- `039_repo_rename_matrix_and_compat.md`
- `040_package_scope_and_import_migration.md`
- `041_env_docs_scripts_rename.md`
- `042_high_risk_contract_and_path_rename.md`

其中：

- `037` 只完成 **TheWorld 表层 rename**
- `038`–`041` 才开始处理 package scope、环境变量前缀、脚本与文档体系
- `042` 是 contract / path / DB 命名这类高风险面的升级入口

---

## 1. 背景与动机

> **新增方向冻结**：CLI 不是未来产品的唯一入口。
> `TheWorld` 后续会同时面向 CLI、GUI、Web、桌面端、本地客户端等多种使用场景，因此 CLI 应定位为**共享客户端接口之上的一个 shell**，而不是产品能力本身的定义位置。
> 任何需要被多个壳层复用的能力，优先先沉淀到 shared contract / shared client interface，再由 CLI 消费。

### 1.1 要解决什么问题（汇总）

- 用**统一 CLI 入口**覆盖「运维 / 开发 / 脚本」常见操作，减少对零散 `pnpm` 脚本名称的记忆成本。
- **对话侧**：支持更贴近实际工作的交互——多模态输入、连续发多条消息（可打断）、可读性更好的输出、主动约束 Skill 等能力来源。
- **会话连续性**：指定工作区；进程退出后再进入能**回到某次对话**；必要时支持**回滚**到较早状态（语义见 §3.6）。
- **跨 Shell**：在 **Bash** 与 **Windows PowerShell** 下行为一致、文档与示例双份或可移植。
- **可解析输出**：CI / 自动化需要 `--json` 等稳定格式（与 §5 对齐）。

### 1.2 与「现有 CLI 碎片」的关系

| 现有入口 | 作用简述 | 是否纳入「统一 CLI」范围（待决） |
|----------|----------|-----------------------------------|
| `pnpm dev:server` | 启动 HTTP Server | ？ |
| `pnpm chat` | 终端对话（SDK 客户端） | 高概率合并为子命令或默认模式 |
| `pnpm demo:first-layer:*` / `test:*` | 第一层 demo 与各类 harness 测试 | 是否包装为 `theworld verify` 等（待决） |
| Web Console（`pnpm dev:web-console`） | 浏览器侧管理/观测 | 与 CLI 互补；功能对齐度待选 |

---

## 1.3 与 GUI / Web / 本地客户端的关系（新增）

本需求文档只讨论 **CLI 这个 shell**，不等于客户端总体架构。

产品层应默认拆成三段：

1. **shared contracts**
   - 路由、DTO、流式事件、错误模型
2. **shared client interfaces**
   - `client surface` 与 `operator surface` 的可复用调用封装
3. **shells**
   - CLI
   - Web
   - GUI / 桌面端
   - 其他本地客户端

因此本文件的约束是：

- CLI 不新增只服务 CLI 的跨层语义
- CLI 不直接承担 GUI / Web 未来也要复用的产品 contract 设计职责
- 若某能力未来显然会进入多个壳层，应先升级为共享接口问题，而不是继续留在 CLI 文档里单独推进
- 若某能力还会被多 Agent 编排、plan mode、定时任务、heartbeat 订阅共同依赖，也应先升级为共享接口问题

---

## 2. 目标用户与典型场景（待完善）

- **开发者本地**：指定工作区启动对话；多模态调试；强制仅用某些 Skill 复现问题。
- **运维/值班**：健康检查、任务列表与触发、日志/Trace 拉取（与第三层 API 对齐）。
- **CI**：无 TTY 下的非交互子命令 + JSON 输出。

---

## 3. 能力范围（初稿 — 需逐项确认）

下列与仓库当前能力对应，**不代表都要进 v1**；用于勾选「第一期做哪些」。

### 3.1 与服务进程相关

- 启动 / 停止 / 前台运行 Server（与 `dev:server` 关系待决）
- `GET /health` 探活
- （可选）读取 `GET /v1/system/status`

### 3.2 Session / Run（Client Surface）

- 列出/创建/删除 Session；读消息历史；发起 Run；订阅 SSE 流（TTY 呈现方式待细化）

### 3.3 Agent / 定时任务（第三层已落地）

- Agent CRUD、enable/disable（路由与鉴权见第三层文档）
- **定时/周期任务**：通过已有 **Scheduled Task API**（[`023`](../exec-plans/completed/023_scheduled_tasks.md)）管理 CRUD、trigger、runs；CLI 侧可暴露子命令；Task 事件 SSE 是否在 TTY 中消费（待决）

#### 3.3.1 定时周期任务应该是一个 Skill 吗？（结论草案）

| 概念 | 定位 | 说明 |
|------|------|------|
| **Scheduled Task（023）** | 服务内调度器 | 按 cron/once/interval 触发，创建 `kind='task'` 的 Session 并跑指定 Agent；状态在 DB，属于**基础设施**。 |
| **Skill（015）** | 工作区内的文档化能力包 | Agent 通过 `read_skill` 等按文档执行；是**能力扩展单元**，不是系统调度器。 |

**推荐结论**：**不要把「周期调度」本身做成一个 Skill。** 周期触发应继续走 **Task 系统**；Skill 适合封装「被触发时要做的那段业务步骤」（或由 Agent 在 Session 里自主选用）。若将来有「用自然语言创建定时任务」的需求，可以是 Agent + 工具调用 **Task API**，而不是用 Skill 替代调度器。

### 3.4 可观测与调试

- Trace 查询、`/v1/logs`、工具与 Skill 清单、MCP 状态（路由与鉴权见第三层文档）

### 3.4.1 heartbeat / 实时订阅（新增约束）

- CLI 当前消费 SSE 时，不应把 heartbeat、Task 事件、长运行状态变化的订阅模型定义成 CLI 私有协议
- 未来 GUI / Web / Desktop 也可能消费相同实时信号，因此应优先复用或抽象共享的 event subscription interface
- 当前仓库已经存在：
  - Run stream SSE
  - Task 事件 SSE
  - 日志流 SSE
  - 服务端 heartbeat / keepalive 机制

这些能力在 CLI 层可以先做展示，但不应在 CLI 需求中私自扩张新的服务语义

### 3.5 第一层 / 第二层 harness（测试与 demo）

- 是否暴露为子命令（如 `theworld verify` 包装 `pnpm verify`）或**刻意不纳入**以免与 `pnpm` 重复（待决）

### 3.6 对话与交互增强（本轮新增 — 与 API/SDK 依赖需拆分）

| 需求 | 说明 | 与现有实现关系（截至文档编写时） |
|------|------|----------------------------------|
| **多模态输入** | 例如在 CLI 中附加图片/文件作为用户消息的一部分 | 当前服务层 `POST /v1/runs` 以 `input.text` 为主；完整多模态通常涉及 **Message 模型与 API contract 扩展**，属高风险变更，需单独 exec-plan / 高能力模式收口，**不能仅在 CLI 层假装完成**。 |
| **指定工作区** | 与 Server 的 `THEWORLD_WORKSPACE_DIR`（及 skills/MCP 扫描路径）一致 | CLI 可通过环境变量或 flag 传入并**启动子进程**或**提示用户**；与「仅连接已运行 Server」场景需统一故事。 |
| **连续多条消息 / 允许打断** | 同一 Session 内快速连续输入；在 Run 未结束时发送新输入可取消或排队 | 涉及 Run 取消语义、SSE 与 TTY 交互；需对照 core/service 是否已有 cancel 与竞态约定。 |
| **回滚** | 将会话恢复某条消息之前的状态（或标记废弃后续分支） | 当前以追加型消息历史为主；**回滚**若指删除/截断消息或分支，可能需要 **API 与存储语义**；产品上要区分「软回滚（UI 忽略）」与「硬截断（DB）」。 |
| **退出后再进入 / 回到某次对话** | 列出历史 Session，选择并附加上下文继续 | **Session/Message API（019）** 已支持列表与历史；CLI 需提供 **session 选择器**（按 id、时间、标题摘要）。 |
| **优化输出格式** | 工具调用、流式 token、错误分层颜色/缩进/可选紧凑模式 | 主要属 **CLI 表现层**；可与 `--json` 并存。 |
| **主动指定 Skill 等** | 仅加载/仅允许列出的 Skill；或显式 `read_skill` 优先级 | 部分可先做 **CLI 侧过滤展示**；若需 Server 强制「本轮仅这些 Skill 进 Prompt」，可能涉及 **运行配置 contract**（待单独评估）。 |

### 3.6.1 plan mode / 多 Agent 编排（新增约束）

- CLI 可以作为未来 `plan mode` 或多 Agent 编排的一个交互入口，但**不是这些能力的 contract 定义位置**
- 若后续需要：
  - planner → executor 两段式流程
  - supervisor / worker 协作
  - DAG / subtask / execution 聚合视图
  - 编排级 trace 汇总
  必须先上升为 shared interface / orchestration surface 问题，再决定 CLI 如何展示
- 定时任务若未来触发 plan mode 或多 Agent 流程，也应由上层编排层组合，不在 CLI 文档中直接发明新的任务语义

### 3.7 Shell：Bash 与 PowerShell

- 文档中的命令示例、路径（`/`、`\\`）、引号与换行续写需**两套示例**或注明可移植写法。
- 实现上优先 **Node 跨平台**（`path`、`fs`），避免依赖仅 POSIX 的 shell 脚本作为唯一入口。
- **待决**：是否提供 `.ps1` 薄封装以便 `PATH` 安装，或仅保证 `node`/`pnpm` 调用在两种 shell 下等价。

### 3.8 命令谱系（「各种命令」— 占位，随范围收敛改名）

下列为**能力分组**，正式子命令名在 exec-plan 中冻结。

| 分组 | 候选子命令方向 | 备注 |
|------|----------------|------|
| **进程** | `server start|stop|status` | 与 `dev:server` 整合方式待决 |
| **对话** | `chat`、`session attach`、`session list` | 与多模态、打断、输出格式强相关 |
| **会话与历史** | `session delete`、`messages export`、`session rollback`（若 API 支持） | 回滚依赖 §3.6 |
| **Agent** | `agents list|create|...` | 对齐 022 |
| **任务** | `tasks list|create|trigger|runs` | 对齐 023 |
| **调试** | `trace get`、`logs query`、`tools list`、`skills list` | 对齐 024 等 |
| **仓库 harness** | `verify` 或文档链到 `pnpm verify` | 是否纳入 CLI 待决 |

---

## 4. 非目标（建议显式写出，防止范围膨胀）

- 不在本文档阶段**新增或改写**跨层 DTO/endpoint 语义（多模态、硬回滚等若要做，另立计划）。
- CLI 不替代 **SDK 的编程式集成**（双轨并存）。
- CLI 不定义多 Agent 编排、plan mode、heartbeat 订阅的共享协议。
- （可继续补充）…

---

## 5. 交互与输出（待决）

- **命令形态**：单二进制 `theworld` / `pnpm exec` 调用 `packages/*` / `pnpm theworld <sub>` 为壳？
- **配置**：Server URL、API Key、工作区目录、超时 — 环境变量与 flag 优先级
- **输出**：人类可读（主题/紧凑/调试级详细）vs `--json`；错误码与 stderr 约定
- **鉴权**：与 `THEWORLD_API_KEY` 一致时的 header 行为

---

## 6. 技术约束（仓库规则摘要）

- 新增能力需在既有 **Service API / SDK contract** 内实现，不自行发明未冻结的 endpoint 语义（见 `AGENTS.md` 与第三层覆盖文档）。
- 实现落地前应有一份 **exec-plan** 写明允许修改目录与 `pnpm verify` 等验收命令。

---

## 7. 里程碑建议（占位）

| 阶段 | 内容 | 验收（草案） |
|------|------|----------------|
| M0 | 本文档定稿 + exec-plan | 评审通过 |
| M1 | 仅「连接现有 Server + Session 列表/附着 + JSON」 | `pnpm verify` + 手工 Bash/PowerShell 烟测 |
| M2 | 输出格式、Skill 指定（能力范围内） | … |
| M3 | 多模态 / 回滚 / 打断（依赖 contract 就绪后） | 单独计划验收 |

---

## 8. 开放问题

1. **CLI 的首要场景** 是「替代/聚合 pnpm 脚本」还是「面向运行中 Server 的运维客户端」还是两者都要？
2. **`pnpm chat` 与统一 CLI** 是合并为子命令（如 `theworld chat`）还是保持独立、仅文档互链？
3. **第一期必须覆盖** 的 3～5 条命令或用户故事是哪些？
4. **多模态 v1** 优先支持哪些类型（本地图片路径、URL、PDF）？是否可接受第一期仅文本、多模态跟随后续 API 计划？
5. **回滚** 的产品定义：仅 CLI 本地「从某条消息重新发起新 Run」即可，还是必须服务端删除/截断消息？
6. **打断**：新输入是「取消当前 Run + 新 Run」还是「排队」？是否需要与 Web Console 行为一致？
7. **发布形态**：仅 monorepo 内使用，还是未来 `npm publish` 独立包？

---

## 9. 修订记录

| 日期 | 修订摘要 |
|------|----------|
| 2026-04-08 | 初稿：目录结构、与现有文档关系、能力清单占位、开放问题 |
| 2026-04-08 | 纳入：多模态、工作区、连续消息与打断、回滚、会话恢复、输出格式、指定 Skill、Bash/PowerShell、命令分组；**定时任务 vs Skill** 结论草案；实现依赖与开放问题更新 |
| 2026-04-09 | 新增 §0：029–034 已落地的 `pnpm theworld` 用法、配置优先级、子命令表、Bash/PowerShell 示例与手工烟测要点 |
| 2026-04-09 | §0 补充：`pnpm theworld`、TheWorld 展示名与 chat 内 slash 命令说明（035–037） |
