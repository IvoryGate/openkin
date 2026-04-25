# 054 CLI Chat TTY 交互与视觉渐进增强

> **状态：已完成（Phase A–F，2026-04-09）。** Phase G（全屏 TUI）已拆分为 `056`–`058` 并单独落地；本单只保留行模式 TTY 基线。可选 ASCII 大标题（`THEWORLD_CHAT_ASCII`）仍未实现。

## 编号与队列

- **已完成**工作单编号至 [`048`](../completed/048_cli_chat_enhancements.md)。
- **049–053** 为当时队列中与 Service / Web 相关的 **已落盘** 工作单（API / 语义 / Web），规格见本目录（[`completed/README`](./README.md)）下各 `049_*.md` … `053_*.md`。
- **本单为 054**：在 049–053 之后排队，专注 **CLI TTY 交互与视觉**；与 049–053 **无硬依赖**，可并行实现。

## 目标

在 **不改动** Service API / shared contracts / server 行为的前提下，将 `theworld chat`（含 `pnpm world` 隐式入口）的 **TTY 交互态** 渐进增强为更接近主流 coding CLI 的体验，包括且不限于：

1. 开场：品牌区、可选 ASCII/字符标题、版本与服务器上下文。
2. 会话态：单行「伪状态栏」（cwd / server host / session 缩写 / 本地别名）。
3. 输入：**上/下键历史**、readline 默认行编辑（TTY 下）。
4. 输入：**Tab** 对 `/` slash 前缀补全（候选集与 `/help` 一致）。
5. 等待：`run` 流式前的加载动画可配置、可关闭（兼容 `NO_COLOR`）。
6. 收尾（可选轻量）：退出时打印可复制的 `--resume` 提示（不依赖服务端新统计 API）。

分 **Phase A–F** 交付，每阶段可独立合并；**Phase G** 为可选门禁项（全屏 TUI）。

---

## 背景

- [`036_cli_terminal_ux`](../completed/036_cli_terminal_ux.md) 已交付平铺 banner、分隔、事件视觉与无色可读性；当时 **明确不做** 历史、补全、复杂光标重绘。
- [`048_cli_chat_enhancements`](../completed/048_cli_chat_enhancements.md) 已交付 slash、`--continue`、`/rename` 等；别名持久化若已实现，本计划 **只消费** `getSessionAlias` / `resolveSessionRef` 等现有 API，不扩展其语义。
- 当前实现要点：[`packages/cli/src/cmd-chat.ts`](../../packages/cli/src/cmd-chat.ts) 使用 `readline.createInterface({ terminal: false })` 自定义 async 迭代，便于 **管道与非 TTY**（[`scripts/test-project-cli.mjs`](../../scripts/test-project-cli.mjs)）；`runChatTurn` 内已有 `\r` 单行 spinner。

本计划在 **新工作单边界** 内重启 036 当时排除的「历史 / 补全」，但 **Phase G 前** 仍遵守 036 的「不引入全屏 TUI 框架」。

---

## 总边界（冻结）

### 允许修改

| 区域 | 说明 |
|------|------|
| `packages/cli/src/**` | 新增模块（如 `chat-banner.ts`、`chat-status.ts`、`chat-input.ts`、`chat-spinner.ts`）与修改 `cmd-chat.ts`、`slash-chat.ts`、`help.ts`、`style.ts`、`branding.ts` |
| `packages/cli/package.json` | 仅当 Phase G 获批引入新依赖时修改；Phase A–F **不得**添加 TUI 相关依赖 |
| `scripts/test-project-cli.mjs` | 调整断言锚点；**不得**削弱非 TTY 覆盖 |
| `docs/exec-plans/active/`、`docs/exec-plans/completed/` | 本计划状态迁移 |
| `docs/architecture-docs-for-agent/ARCHITECTURE.md` | 仅当新增跨进程约定（如环境变量）需对外说明时最小增补 |

### 禁止修改（除非触发「升级条件」并另开工作单）

| 区域 | 说明 |
|------|------|
| `packages/shared/contracts/` | 不改 contract |
| `packages/server/` | 不改 HTTP 行为与路由 |
| `packages/sdk/client/`、`packages/sdk/operator-client/` | 不改公开 API 形状；本计划不新增调用 |
| `packages/core/`、`packages/channel-core/` | 非 CLI 展示需求不动 |
| `apps/web-console/` | 不在范围 |
| DB schema | 不在范围 |

**勘误（范围）：** 若在实现 054 的周期内混入「进程重启后 DB 仍有会话但 agent 内存为空」类修补，**不得**放在本单下修改 `packages/server/`。该类修正已单独落在 [`055_session_rehydrate_on_run.md`](./055_session_rehydrate_on_run.md)（已归档）；054 后续变更 **仅限** 上表「允许修改」区域。

### 依赖策略（冻结）

- **Phase A–F**：仅 Node 内置模块 + 现有 `@theworld/*` CLI 已用依赖；**禁止** Ink / Blessed / neo-blessed / `@clack/prompts` 等。
- **Phase G**：若产品要求全屏底栏与分栏，**单独** 在本文件追加「G 批准记录」与 ADR 片段后，才允许增加依赖并放宽上表。

### 交互路径规格（冻结）

- 定义 `isInteractive = process.stdin.isTTY === true && process.stdout.isTTY === true`。
- **`!isInteractive`（含管道、CI、`test-project-cli`）**：行为必须与当前实现等价：仍用 `terminal: false` 路径（或等价的无补全、无 readline 历史的 async 行迭代），**不得**要求 tty 或 raw mode。
- **`isInteractive`**：使用 `readline.createInterface({ terminal: true, ... })` 单例贯穿 REPL；历史、补全仅在此路径启用。

### 历史内容规格（冻结）

- readline 历史 **包含** 用户提交过的非空行，**包括** 以 `/` 开头的 slash 行（便于重复 `/inspect` 等）。
- **不包含** 仅由程序回显的 Agent 文本或自动发送的 `initialText` 行（除非用户显式出现在 readline 输入中）。

### 补全规格（冻结）

- 仅当当前行 **第一个非空白字符为 `/`** 时启用 Tab 补全；补全候选为 **slash 命令前缀** 集合，与 [`printSlashHelp`](../../packages/cli/src/slash-chat.ts) 语义一致，抽成单一数据源（如 `SLASH_COMPLETION_PREFIXES` 或从同构列表生成），**禁止**与 `/help` 文案漂移双维护。
- 不对普通自然语言做补全；不对 `@file` 路径做补全（非目标）。

### 状态栏与流式输出（冻结）

- **不做** 与 `text_delta` 并发的「真·固定底栏」重绘（避免与流式 stdout 打架）；**允许** 在 **等待用户输入前** 打印一行 `dim` 状态（伪状态栏），或等价地在 `prompt` 上一行刷新。
- 若未来 Phase G 引入全屏 TUI，须单独定义「流式与布局」契约，**不在** Phase A–F 隐含承诺。

---

## 分阶段范围与验收（冻结）

### Phase A — 开场与字符标题

**做：**

- 抽出 `printChatWelcome(...)`（新文件或 `chat-banner.ts`），替换 `runChatCommand` 内零散 `hrule`+标题块。
- 展示：`CLI_PRODUCT` / Chat 标题、服务器 URL（可截断 host）、`NO_COLOR` / `TERM=dumb` 时无 ANSI。
- 可选 3–5 行 ASCII/Unicode 标题：**必须** 提供无宽字符 fallback（dumb 终端或 `THEWORLD_CHAT_ASCII=0` 时跳过 art）。

**不做：**

- 不改会话创建/恢复逻辑；不新增 API 调用。

**验收：**

- `pnpm test:project-cli` 通过（允许更新子串断言）。
- 手动：TTY 下启动 chat，可见 welcome 块且无乱码。

---

### Phase B — 伪状态栏

**做：**

- 单行状态：`cwd` 短路径、`baseUrl` host、`sessionId` 前 8 位 + `…`、若有 alias 则括号显示。
- 环境变量 `THEWORLD_CHAT_STATUS=0` **关闭** 该行（默认开启）。

**不做：**

- 不读服务端 model 名（无 API 则不做假数据）。

**验收：**

- 管道模式：行为与关闭开关一致或可预测（无 ANSI 时仍可接受纯文本一行）。
- `pnpm test:project-cli` 通过。

---

### Phase C — TTY readline + 上下历史

**做：**

- 抽象 `createChatLineReader()`：`!isInteractive` → 保留现有 async 迭代；`isInteractive` → `terminal: true` 单例 + `setPrompt` / `prompt()` 与主循环对齐。
- 移除「双 prompt」（禁止 `writePrompt()` 与 readline 自带 prompt 叠加回显混乱）。

**不做：**

- 不实现 Ctrl+R 搜索、不实现多行粘贴特殊模式。

**验收：**

- 手动：TTY 上/下切换历史可用。
- `pnpm test:project-cli` 通过（仍为非 TTY）。

---

### Phase D — Tab 补全

**做：**

- `readline` `completer`：过滤 slash 前缀；与 `/help` 同源列表。

**不做：**

- 不做 fish 式灰色 ghost 补全（可列为后续编号工作单可选）；本 Phase 以 Tab 列表/循环为准。

**验收：**

- 手动：输入 `/` + Tab 能列出或补全已知命令。
- `pnpm test:project-cli` 通过。

---

### Phase E — Spinner 与退出摘要

**做：**

- 将 `runChatTurn` 内 spinner 抽为 `chat-spinner.ts`：`THEWORLD_CHAT_SPINNER=ascii|dots|braille`（`braille` 仅在 TTY 且非 dumb 且未 `NO_COLOR` 时启用）。
- 退出路径（`/exit`、`exit`、`quit`）：打印一行 **可复制** 的 `theworld chat --resume <id>`（优先已解析的真实 id；若存在 alias 可额外打印 `--resume <alias>` **仅当** `resolveSessionRef(alias)===id` 可验证时，避免误导）。

**不做：**

- 不要求服务端返回 tool 次数、wall time（无 API 不做假统计）；不复制 Gemini 全量退出报表。

**验收：**

- `pnpm verify` 通过。
- 手动：退出时见 resume 提示。

---

### Phase F — 文档与治理收尾

**做：**

- `packages/cli/src/help.ts` 增加与环境变量相关的最短说明（`THEWORLD_CHAT_*`）。
- 本文件迁移至 `docs/exec-plans/completed/`，`active/README.md` 队列更新。

**验收：**

- `pnpm lint:docs`（若触及 docs 规则）与 `pnpm verify` 通过。

---

### Phase G —（可选，门禁）全屏 TUI / 固定底栏

**前置（全部满足才可开工）：**

1. 产品书面确认（或 issue 链接）；
2. 本文件追加「Phase G 批准」小节（日期、决策人、依赖列表）；
3. 单独说明与 `streamRun` 的并发输出策略（alternate screen 或分 pane）。

**否则：** 永久不做或移交新编号工作单。

---

## 升级条件（停止当前实现并上报）

命中 **任一** 即停止编码，升级评审 / 拆工作单：

- 需要修改 `packages/shared/contracts/` 或 server 才能达成 UI 目标；
- Phase A–F 中任一阶段要求引入 **禁止依赖列表** 中的库；
- `pnpm verify` **连续两轮**失败且非 flakes；
- 发现 `test-project-cli` 必须改为 TTY 才能测（**禁止**：应保持管道可测）。

---

## 必跑命令

```bash
pnpm check
pnpm test:project-cli
pnpm verify
```

Phase D 完成后，在 PR 描述中注明已做 **TTY 手动** 验证项（历史、Tab）。

---

## 不做什么（全局排除）

- 不改 HTTP / WebSocket contract；不新增 `GET/POST` 客户端 surface。
- 不做多模态附件、不做 `@path` 文件引用补全。
- 不做 Run 取消快捷键（依赖 [`052`](./052_run_cancel_api.md) 类 API 的另一工作单）。
- Phase G 未批准前：**不做** Ink/Blessed/全屏 alternate screen 主路径。

---

## 与历史计划的冲突处理（决策记录）

| 来源 | 原约束 | 本计划处理方式 |
|------|----------|----------------|
| 036 | 不做历史、补全、复杂光标 | 在本编号下 **重新纳入** Phase C/D；仍不强制复杂光标重绘 |
| 036 | 不引入 TUI | Phase A–F 遵守；Phase G 单独门禁 |
| 048 | `/rename` 等 shell 语义 | 只读使用，不扩展 server 持久化 |

---

## 依赖的其他工作单

- **无硬依赖**：可与 [`049`](./049_sessions_list_query_enhancement.md)–[`053`](./053_web_console_session_runs_ui.md) 并行（均已归档）。
- **软依赖**：若 [`050`](./050_session_display_name_api.md) 提供服务端展示名，Phase B 可扩展显示该字段，**但非本 Phase 验收条件**。

---

## 归档记录

| 日期 | 说明 |
|------|------|
| 2026-04-09 | Phase E：`packages/cli/src/chat-spinner.ts`、`THEWORLD_CHAT_SPINNER`；工具轮次间 `begin`/`end` 修复原 interval 只停一次后不再转的问题；resume 行仅当 `resolveSessionRef(alias)===sessionId` 时附加 `--resume <alias>`。Phase F：`help` 增加 `THEWORLD_CHAT_SPINNER`；`test-project-cli` 断言；本文件迁入 `completed/`。 |
