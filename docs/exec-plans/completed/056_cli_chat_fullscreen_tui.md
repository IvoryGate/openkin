# 056 CLI Chat 全屏 TUI（Ink）与 `streamRun` 对接

> **状态：已完成（2026-04-15）。** 本文仍位于 `active/` 仅因归档迁移尚未执行；`active/README.md` 已不再将其视为进行中工单。

## Phase G 批准记录（承接 054）

| 字段 | 内容 |
|------|------|
| 日期 | 2026-04-15 |
| 决策 | 在 **不改** Service API / shared contracts / server HTTP 的前提下，为 `theworld chat` 增加可选全屏 TUI；非 TTY 与 `pnpm test:project-cli` 保持行模式。 |
| 依赖（计划引入） | `react`、`ink`（npm 上游）；版本与 Node 22 兼容，锁在 `pnpm-lock.yaml`。 |
| 外部参考 | 用户本机 `Desktop/src` 等目录（**只读启发**）；**禁止** submodule、禁止复制其私有 Ink fork / Bun 特有运行时。 |
| 流式契约 | TUI 模式下 **禁止**对 raw `stdout` 写 `text_delta`；事件经 **本仓** reducer → React 状态 → Ink 重绘（详见下文「stdout 契约」）。 |

---

## 目标

1. **可选全屏**：`THEWORLD_CHAT_TUI=1` 或 `theworld chat --tui`（仅 TTY）为 TUI 入口；TTY 下挂载 Ink 全屏壳并与 `streamRun` 对接；非 TTY 与默认无标志时仍为行模式。
2. **对接现有能力**：会话解析、`--continue`/`--resume`、`streamRun` 事件语义、slash（[`slash-chat.ts`](../../packages/cli/src/slash-chat.ts) / [`slash-complete.ts`](../../packages/cli/src/slash-complete.ts)）与 [`session-alias`](../../packages/cli/src/session-alias.ts) 不变更语义。
3. **验收**：`pnpm check`、`pnpm test:project-cli`、`pnpm verify`；手工 TTY 矩阵见文末。

---

## 本单范围内已落地的最小增量（代码）

- `THEWORLD_CHAT_TUI` / `theworld chat --tui`：非 TTY 报错；TTY 下进入 **Ink** 全屏会话（[`tui/run-chat-tui.tsx`](../../packages/cli/src/tui/run-chat-tui.tsx)），流式经 [`chat-stream-sink.ts`](../../packages/cli/src/chat-stream-sink.ts) 写入 React 状态，**不**对裸 `stdout` 写 `text_delta`。标志与 argv 剥离见 [`tui/chat-tui-flags.ts`](../../packages/cli/src/tui/chat-tui-flags.ts)；行模式入口见 [`cmd-chat.ts`](../../packages/cli/src/cmd-chat.ts)。

**说明**：不在本文件内再拆「056-0 / 056-1」等子编号。若下一增量需要**单独验收或独立冻结边界**（例如「仅加依赖」「仅 Ink 壳」），应 **另开 `057_*.md`、`058_*.md` …** 工作单，并更新 [`README.md`](./README.md) 队列。

---

## 允许修改

| 区域 | 说明 |
|------|------|
| `packages/cli/src/**` | 含新建 `tui/`、`chat-*` 拆分；`cmd-chat.ts` 分流 |
| `packages/cli/package.json` | 引入 `react` / `ink` 等时修改（版本与 Node 22 兼容） |
| `scripts/test-project-cli.mjs` | 断言锚点；**不得**要求 TTY / Ink |
| `docs/exec-plans/active/`、`completed/`、本 README | 状态与归档 |
| `docs/architecture-docs-for-agent/ARCHITECTURE.md` | 仅新增跨进程约定（如 `THEWORLD_CHAT_TUI`）时最小增补 |

## 禁止修改

| 区域 | 说明 |
|------|------|
| `packages/shared/contracts/` | 不改 contract |
| `packages/server/` | 不改 HTTP（055 类修补单独立跟踪） |
| `packages/sdk/client/`、`packages/sdk/operator-client/` | 不改公开 API 形状 |
| `packages/core/`、`apps/web-console/` | 非本单范围 |

---

## stdout 契约（冻结）

- **行模式**（默认、`test-project-cli`、管道）：保持现有 `process.stdout.write` / `println` 行为（含 [`chat-spinner.ts`](../../packages/cli/src/chat-spinner.ts)）。
- **TUI 模式**（Ink 已挂载）：仅 Ink 通过 stdout 绘制；`text_delta` 等进入 **内存缓冲** 再驱动组件，**不得**与行模式混写同一 tty。

---

## 升级条件

- 需改 contract 或 server 才能完成 TUI → **停**，另开工作单。
- `pnpm verify` 连续两轮非 flake 失败 → 停。
- `test-project-cli` 被迫依赖 TTY → **禁止**，回滚设计。

---

## 必跑命令

```bash
pnpm check
pnpm test:project-cli
pnpm verify
```

---

## 手工矩阵（TUI 完整落地后补测）

- TTY + 无 TUI：与 054 一致。
- TTY + `--tui`：验证转录区、流式助手区、草稿行与 `/clear`（TUI 内清状态，不走行模式 `stdout` 清屏）。
- `NO_COLOR` / `TERM=dumb`：与 `style.ts` 一致。
- 窄终端：不断言具体列宽，不崩溃。

---

## 决策记录

| 日期 | 决策 |
|------|------|
| 2026-04-15 | 创建 056；TUI 请求在 TTY 下暂提示并回退行模式，直至 Ink 挂载（避免 `cmd-chat`↔`tui` 循环依赖）。 |
| 2026-04-15 | 文档：不再使用 `056-1` 等子编号；进行中队列仅保留本单；大增量拆新编号工单。 |
| 2026-04-09 | TTY + TUI 标志：`dynamic import` 挂载 Ink；`runChatStreamWithSink` + 专用 sink；`/clear` 在 TUI 内拦截；`pnpm verify` 通过。 |

---

## 依赖的其他工作单

- [054（已完成）](../completed/054_cli_chat_tty_interactive_ui.md) Phase A–F：行模式基线。
- [055](../completed/055_session_rehydrate_on_run.md)：服务端续跑（与 TUI 正交）。
- [057](./057_cli_chat_tui_visual_identity.md)（可选后续）：横幅、入场动效、思考 spinner、流式光标等 **纯呈现**，与 056 接线正交。
