# 058 CLI Chat TUI LazyVim 风全屏仪表与状态栏

> **状态：已完成（2026-04-16）。** 本文仍位于 `active/` 仅因归档迁移尚未执行；`active/README.md` 已不再将其视为进行中工单。

## 背景

056/057 已提供 Ink 全屏入口、框线横幅、入场动效、思考 spinner 与流式尾部光标。本单将布局升级为 **终端满屏**、**LazyVim 风大块 ASCII 标识**、**输入区插入光标**，以及 **底部 Powerline 风状态栏**（模型显示名、固定 agent 模式、消息级上下文代理指标、host/session 摘要）。

## 目标

1. **满屏布局**：按 `stdout.rows` / `stdout.columns` 计算转录区可视行数，转录区 `flexGrow:1`，去掉固定矮框高度。
2. **视觉**：多行 hand-authored ASCII logo（宽屏完整、中宽缩短、极窄回退 057 框线）；标语一行。
3. **输入**：空闲可输入时 `draft` 尾部 **闪烁块光标**；流式输出时仅用流式尾部光标，互不重叠。
4. **状态栏**：分段样式（有色可用时反色段 +分隔符）；`THEWORLD_CHAT_TUI_MODEL`（可选）+ `session.agentId` 短显；**mode 固定 `AGENT`**；`getMessages(limit:500)` 计算 `msgs` 与内容长度近似 `~chars`（非 token）；host / session 短 id。

## 允许修改

| 区域 | 说明 |
|------|------|
| `packages/cli/src/tui/**` | 布局、横幅、状态栏、纯函数 |
| `packages/cli/src/chat-status.ts` | 仅新增可复用的纯函数导出（不改变 `printChatStatusLine` 行为） |
| `packages/cli/src/help.ts` | 增加 `THEWORLD_CHAT_TUI_MODEL` 一行说明 |
| `docs/exec-plans/active/`、`completed/`、各 README | 状态与索引 |
| `docs/architecture-docs-for-agent/ARCHITECTURE.md` | 仅一句 CLI 环境变量约定 |

## 禁止

- 不改 `packages/shared/contracts`、`packages/server`、`packages/sdk/*` 对外形状、`packages/core`、`apps/web-console`。
- **禁止** TUI 动效或内容通过 `process.stdout.write` 绕过 Ink（056 stdout 契约）。
- **禁止** `test:project-cli` 依赖 TTY / Ink。
- 不新增 SDK Agent API 依赖；模型展示以 env + `agentId` 为主。

## 验收

```bash
pnpm --filter @theworld/cli check
pnpm test:project-cli
pnpm verify
```

手工（TTY + `--tui` 或 `THEWORLD_CHAT_TUI=1`）：满屏无崩溃；窄列与 `NO_COLOR=1` 可辨。

## 升级条件

- 需服务端 token / 精确 context 才能满足展示需求 →停，另开单。
- `pnpm verify` 连续两轮非 flake 失败 → 停。

## 决策记录

| 日期 | 决策 |
|------|------|
| 2026-04-16 | 创建 058；状态栏 mode 固定 AGENT；上下文用消息条数 + 内容长度近似，不宣称 token。 |

## 依赖

- [056](./056_cli_chat_fullscreen_tui.md)
- [057](./057_cli_chat_tui_visual_identity.md)

## 本单已落地（代码索引）

- LazyVim 风 figlet 标 + 窄列回退：[`chat-tui-art.ts`](../../packages/cli/src/tui/chat-tui-art.ts)、[`chat-tui-banner.tsx`](../../packages/cli/src/tui/chat-tui-banner.tsx)
- 满屏 flex、转录区 `flexGrow`、输入/流式光标：[`run-chat-tui.tsx`](../../packages/cli/src/tui/run-chat-tui.tsx)
- Powerline 风状态栏：[`chat-tui-statusbar.tsx`](../../packages/cli/src/tui/chat-tui-statusbar.tsx)
- host / session 短标签复用：[`chat-status.ts`](../../packages/cli/src/chat-status.ts)

## 决策记录（增补）

| 日期 | 决策 |
|------|------|
| 2026-04-16 | 058 落地：满屏布局；状态栏 mode 固定 `AGENT`；上下文为消息条数与内容长度近似。 |
