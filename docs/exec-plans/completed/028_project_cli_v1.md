# 028 Project CLI V1（统一项目能力 CLI）

## 目标

基于 `openkin` 现有第三层 Service API、现有共享 SDK 能力和当前轻量 `cli-chat`，收敛出一个 **Node-first、Server-first** 的 CLI shell。

这里先冻结一个上位前提：

> `openkin` 的目标不是只做 CLI，而是同时服务 CLI、GUI、Web、桌面端、本地客户端等多种壳层。
> 因此 CLI V1 不是产品能力本身，而是**共享客户端接口之上的一个具体 shell**。

它的目标不是复制 `Desktop/src` 那套本地自治编程代理 CLI，也不是让 CLI 成为产品 contract 的定义位置，而是先做一套适合 `openkin` 当前分层的：

- 会话与对话入口
- Agent / Task / 调试查询入口
- Bash / PowerShell 可移植入口
- 人类可读输出与 `--json` 稳定输出

---

## 问题边界

### 对比对象的真实能力面

`Desktop/src` 中的 CLI 不是单纯的“命令行壳”，而是一个完整的终端代理产品，至少包含：

- 命令系统（命令注册、动态加载、技能/插件/MCP 命令并存）
- 交互式 TUI（Ink / JSX）
- 结构化 I/O 协议（stdin/stdout NDJSON、permission request、hook callback）
- 多种远程 transport（WebSocket / SSE / Hybrid）
- 会话恢复、远程桥接、权限确认、插件与工作流扩展

其中相当一部分能力依赖它自己的本地 query loop、权限模型、structured IO 和远程桥接，不是“已有 HTTP API + 一个 CLI 包装”就能等价复刻。

### 本计划要回答的问题

`openkin` 是否已经具备实现“类似 `Desktop/src` 中 CLI”的条件？

**结论：部分具备。**

- **具备**：实现一个连接现有 OpenKin Server 的统一 CLI，并覆盖 chat/session/task/agent/introspection 等命令。
- **不具备**：在当前 contract 下直接实现与 `Desktop/src` 同等级的本地自治编程 CLI、structured IO host、权限桥接和多 transport 运行时。

因此，本计划冻结的方向是：

> 先做 `openkin` 的 **CLI shell v1**，定位为 **共享客户端接口之上的命令行入口**，而不是 Claude Code 式本地代理运行时，也不是未来 GUI / Web 的架构替代品。

---

## 判断依据

### 当前已经具备的条件

1. 第三层 Service API 已经具备较完整的可调用面：
   - Client surface：Session、Message、Run、Health
   - Operator surface：Agent CRUD、Task CRUD、Logs、Tools、Skills、System Status、Task 事件 SSE、日志 SSE
2. 已有 `packages/sdk/client`：
   - 已覆盖 `createSession`、`listSessions`、`getMessages`、`streamRun`
   - 已覆盖 Task 管理 API
   - 已有基础 SSE 流解析
3. 已有 `packages/server/src/cli-chat.ts`：
   - 证明终端交互、流式输出和基本彩色渲染链路已跑通
4. 当前仓库已明确要求：
   - 先冻结 contract，再做多阶段实现
   - 新增计划必须先收口允许修改目录、验收命令和升级条件

### 当前还不具备的条件

1. **没有统一 CLI 命令框架**
   - 现在只有 `pnpm chat` 这种单入口脚本，没有子命令体系、参数规范、帮助系统和统一输出层。
2. **客户端 SDK 边界与 CLI 需求不完全一致**
   - `packages/sdk/client` 文档明确定位为普通客户端 surface，不应继续扩展 Agent CRUD、日志、系统状态等 operator 能力。
   - 但 `PROJECT_CLI` 需求包含 `agents`、`tasks`、`logs`、`tools`、`skills` 等 operator 命令。
3. **高风险交互语义尚未冻结**
   - 多模态输入
   - 连续消息 / 打断 / cancel
   - 回滚
   - 强制限定 Skill 运行范围
4. **缺少 CLI 自身的可验证 harness**
   - 目前没有 `test:project-cli`
   - 也没有 Bash / PowerShell 双壳烟测入口
5. **不具备复刻对标项目那套本地代理运行时**
   - 没有 structured IO host protocol
   - 没有权限桥接与 hook callback runtime
   - 没有 WebSocket/Hybrid CLI transport 体系
   - 没有本地 query loop / plugin command runtime
6. **未来编排接口尚未冻结**
   - 多 Agent orchestration、plan mode、execution 聚合视图还没有独立共享接口
   - heartbeat / event subscription 目前按具体 SSE 能力存在，但还没有统一客户端订阅抽象

---

## 已冻结决策

### 1. 产品定位

`openkin` CLI v1 冻结为：

- **shell-first, not contract-first**：CLI 是 shared interface 上的一个壳层，而不是产品能力 contract 的定义者
- **Server-first**：命令主要调用已运行的 OpenKin Server
- **Node-first**：基于当前 monorepo 和 `tsx/typescript` 体系，不引入 Bun-only 运行时依赖
- **非对标复制**：不追求复制 `Desktop/src` 的本地代理 CLI 架构

### 2. 首期命令范围

首期只允许覆盖以下四组命令：

1. `chat`
   - 连接现有 Server
   - 创建或附着 Session
   - 发送文本消息
   - 消费 Run 流
2. `sessions`
   - `list`
   - `show`
   - `messages`
   - `delete`
3. `tasks`
   - `list`
   - `show`
   - `create`
   - `trigger`
   - `enable`
   - `disable`
   - `runs`
4. `inspect`
   - `health`
   - `status`
   - `logs`
   - `tools`
   - `skills`

### 3. 首期明确不做

- 不做多模态输入
- 不做 Session 硬回滚
- 不做 Run cancel / 打断协议
- 不做多 Agent 编排 contract
- 不做 plan mode contract
- 不做 Claude Code 式 structured IO host
- 不做本地工具权限确认 UI
- 不做插件命令系统
- 不做 WebSocket / Hybrid transport
- 不把 CLI 反向做成新的服务端 contract 设计入口
- 不把 heartbeat / Task 事件订阅模型定义成 CLI 私有协议

### 4. SDK 方向冻结

为避免让 CLI 绑架后续 GUI / Web / Desktop 方向，CLI 相关调用面冻结为双轨：

- **保留** `packages/sdk/client` 继续只负责 client surface
- **新增** 一个单独的 operator 调用层（名称待实现阶段定稿，优先考虑 `packages/sdk/operator-client`）

禁止在本计划中直接把 operator 能力继续塞进 `packages/sdk/client`。

同时增加一条上位约束：

- CLI、GUI、Web、桌面端等壳层后续都应消费这些共享接口
- 不允许在 CLI 实现里私下定义未来 GUI / Web 也需要复用的产品语义

### 5. 输出与壳兼容策略

首期输出冻结为两类：

- 默认人类可读文本输出
- `--json` 稳定机器输出

首期必须保证：

- Bash 下可直接执行
- PowerShell 下参数与路径行为可移植

但首期 **不要求** 做复杂 TUI。

### 6. 与未来编排和实时信号的兼容要求

`028` 在实现时必须保持以下兼容性：

- **多 Agent 编排**
  - CLI 若未来展示 execution / subtask / plan，只能消费共享 orchestration interface，不能直接在 CLI 内发明自己的 execution DTO
- **plan mode**
  - CLI 可作为 plan mode 的一个展示壳，但 plan 结果、执行阶段切换、plan artifact 都不应先在 CLI 中私有建模
- **定时任务**
  - CLI 首期只能消费现有 `cron` / `once` / `interval` 任务能力
  - 若未来任务触发 plan mode 或多 Agent，需由上层编排计划单独冻结
- **heartbeat / 事件订阅**
  - CLI 首期可以消费既有 SSE 和 heartbeat
  - 但未来若抽象统一 event subscription interface，CLI 实现应能迁移到共享层，而不是把解析逻辑锁死在 shell 内

---

## 影响范围

| 层级 | 影响 |
|------|------|
| `packages/server/src/cli-chat.ts` | 可能被拆分、保留或迁移为统一 CLI 的 `chat` 子命令 |
| `packages/sdk/client/src/` | 继续只承接 client surface，不扩大 operator 边界 |
| `packages/sdk/operator-client/src/` | 新增：承接 Agent / introspection / logs 等 operator 调用 |
| 未来 orchestration interface | 本计划不直接实现，但不得与多 Agent / plan mode 未来接口冲突 |
| 未来 event subscription interface | 本计划不直接定稿，但不得把 heartbeat / SSE 解析锁死成 CLI 私有模型 |
| 未来 GUI / Web / Desktop 壳层 | 本计划不直接实现，但本计划产出的共享接口必须可被其消费 |
| `packages/shared/contracts/src/` | 仅当发现已有 operator 路由缺少稳定 DTO 时才允许补充；不得擅自扩张高风险语义 |
| `packages/project-cli/` 或 `packages/cli/` | 新增：统一 CLI 主入口、参数解析、输出格式化、子命令组织 |
| `scripts/` | 新增 CLI smoke / cross-shell smoke |
| `package.json` | 增加 CLI 入口与测试脚本 |
| `docs/requirements/PROJECT_CLI.md` | 后续与本计划保持一致，不再并行发散 |
| `docs/architecture-docs-for-agent/first-layer/SDK.md` | 若新增 operator client，需要补充分层说明 |
| `docs/architecture-docs-for-agent/third-layer/THIRD_LAYER_COVERAGE.md` | 若为 CLI 补齐缺失的 operator DTO/接口，需要同步记录 |

---

## 允许修改的目录

- `packages/server/src/cli-chat.ts`
- `packages/sdk/client/src/`
- `packages/sdk/operator-client/`
- `packages/project-cli/`
- `packages/cli/`
- `packages/shared/contracts/src/`
- `scripts/`
- `docs/requirements/PROJECT_CLI.md`
- `docs/architecture-docs-for-agent/first-layer/SDK.md`
- `docs/architecture-docs-for-agent/third-layer/THIRD_LAYER_COVERAGE.md`
- `docs/exec-plans/active/`
- 根目录 `package.json`（仅脚本与 CLI 入口相关）

## 禁止修改的目录

- `packages/core/src/`
- `packages/channel-core/`
- `apps/dev-console/`
- `apps/web-console/`（除非后续单独计划要求对齐文档）
- `workspace/skills/`（本计划不通过 Skill 变相实现统一 CLI）

---

## 分阶段执行

### M0 · 计划冻结

目标：

- 冻结 CLI 作为 shell 的定位
- 冻结 shared interface 优先于 shell 的原则
- 冻结命令分组
- 冻结 SDK 双轨边界

验收：

- 本计划评审通过
- `docs/requirements/PROJECT_CLI.md` 与本计划不再冲突

### M1 · CLI Foundation

目标：

- 建立共享接口之上的统一 CLI 入口
- 将现有 `pnpm chat` 收敛为 `chat` 子命令
- 引入统一参数解析和输出层

范围：

- `chat`
- `sessions list/show/messages/delete`
- `inspect health`
- `--json`

验收：

- 能通过统一入口执行 `chat` 与 `sessions` 命令
- 至少 1 个非交互命令支持 `--json`
- 新增 `test:project-cli`

### M2 · Operator Surface 接入

目标：

- 新增 operator client
- 接入 `tasks` 与 `inspect status/logs/tools/skills`

验收：

- Task 管理命令可通过 CLI 调用
- 调试命令默认文本输出、可选 `--json`
- 不扩大 `packages/sdk/client` 边界

### M3 · Agent 管理与交互增强

目标：

- 接入 `agents` 命令
- 支持 Session 附着/恢复故事

前提：

- 先确认附着策略是“按 sessionId 明确附着”，而不是自动恢复最近会话

### M4 · 需要单独高能力计划的增强项

以下能力不得直接并入本计划，必须另开计划：

- 多模态输入
- 多 Agent 编排
- plan mode
- Run cancel / 打断
- Session 回滚
- 强制 Skill 白名单注入
- TUI 大改
- WebSocket / Hybrid transport
- heartbeat / event subscription 共享抽象

### M5 · 其他壳层计划（不在本计划内）

以下方向不在 `028` 内直接落地，但必须共享其接口前提：

- GUI shell
- Web shell
- 桌面端 / 本地客户端 shell

---

## 本轮不做

- 不实现类似 `Desktop/src` 的 structured IO 协议
- 不实现 permission prompt / hook callback 桥接
- 不实现插件系统、工作流系统、动态命令加载
- 不引入 Bun 作为唯一运行时
- 不为了 CLI 去新增计划外 API
- 不让 CLI 的命令命名、输出形态反向定义共享产品接口
- 不在 CLI 计划中私下冻结多 Agent、plan mode、heartbeat 的共享语义

---

## 验收标准

本计划实施阶段至少应满足：

1. `pnpm verify` 通过
2. 新增 CLI smoke 覆盖：
   - `chat`
   - `sessions list`
   - `tasks list`
   - `inspect health`
3. 至少 1 条 Bash 烟测通过
4. 至少 1 条 PowerShell 烟测通过
5. `packages/sdk/client` 未被扩张为 operator SDK

---

## 必跑命令

实施阶段每次修改后至少运行：

1. `pnpm verify`
2. `pnpm test:project-cli`

如涉及文档-only 变更，至少运行：

1. `pnpm lint:docs`

---

## 升级条件

命中以下任一情况时，弱模型必须停止并升级：

- 需要修改 `packages/sdk/client` 的冻结边界，把 operator 能力直接并入 client SDK
- 需要新增或改写多模态、回滚、cancel 等跨层 contract
- 需要为多 Agent 编排或 plan mode 新增 execution / subtask / plan artifact contract
- 需要把 heartbeat / 事件订阅抽象提升为共享接口
- 需要在 Bash / PowerShell 兼容性之间做架构级取舍
- 现有 operator API 缺少 CLI 首期所需的关键 DTO，且补充方式不明确
- 连续两轮无法同时通过 `pnpm verify` 与 `pnpm test:project-cli`

---

## 决策记录

| 决策点 | 选择 | 原因 |
|--------|------|------|
| 客户端总体方向 | 先统一共享接口，再落 CLI / GUI / Web 壳层 | 产品面向多场景，不应让单一壳层绑架 contract |
| 对标策略 | 做“统一项目能力 CLI”，不做对标复制 | `Desktop/src` 依赖本地代理运行时；`openkin` 当前是 Server-first 架构 |
| 运行时 | Node-first | 与现有 monorepo 和验证体系一致 |
| SDK 边界 | client / operator 双轨 | 避免破坏 `packages/sdk/client` 已冻结定位 |
| 编排与实时信号 | 单独冻结共享接口，不在 CLI 内私下定义 | 多 Agent、plan mode、heartbeat 都会被多个壳层复用 |
| 首期范围 | chat + sessions + tasks + inspect | 能覆盖最高价值用户故事，且与现有 API 重合度高 |
| 高风险能力 | 单独计划 | 多模态、回滚、打断不应由 CLI 层假装完成 |
