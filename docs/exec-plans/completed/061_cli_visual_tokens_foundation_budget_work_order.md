# 061 Budget-Mode Work Order

> **状态：已被 supersede（2026-04-24）。** 请勿再把本文件作为当前 budget-mode 主入口；新的 shell parity 路线改为 `067`–`072`。

本文件不是新的 exec-plan，而是对 [`061_cli_visual_tokens_foundation.md`](./061_cli_visual_tokens_foundation.md) 的**弱模型执行工作单**。

用途：

- 直接复制给 budget-mode / 低能力模型
- 减少其二次做方向判断
- 强制其在冻结边界内推进

---

## 可直接使用的提示词

```text
你当前处于 budget mode。

你的职责不是重新设计系统，而是在现有仓库规则、执行计划和验证脚本约束下，完成小范围、低风险、可验证的实现任务。

当前任务：
实现 `docs/exec-plans/completed/061_cli_visual_tokens_foundation.md`。

任务范围：
- 允许修改的目录：
  - `packages/cli/src/style.ts`
  - `packages/cli/src/chat-banner.ts`
  - `packages/cli/src/chat-status.ts`
  - `packages/cli/src/chat-stream-sink.ts`
  - `packages/cli/src/help.ts`
  - `packages/cli/src/tui/`
  - `scripts/test-project-cli.mjs`
  - `docs/requirements/THEWORLD_CLI_SHELL_DESIGN.md`
  - `docs/exec-plans/completed/061_cli_visual_tokens_foundation.md`
- 不允许修改的目录：
  - `packages/shared/contracts/`
  - `packages/sdk/`
  - `packages/server/`
  - `packages/core/`
  - `apps/web-console/`
  - 不得新增 npm 依赖

你开始前必须先读：
- `AGENTS.md`
- `docs/index.md`
- `docs/governance/MODEL_OPERATING_MODES.md`
- `docs/exec-plans/completed/061_cli_visual_tokens_foundation.md`
- 与任务直接相关的实现文件：
  - `packages/cli/src/style.ts`
  - `packages/cli/src/chat-banner.ts`
  - `packages/cli/src/chat-status.ts`
  - `packages/cli/src/chat-stream-sink.ts`
  - `packages/cli/src/help.ts`
  - `packages/cli/src/tui/run-chat-tui.tsx`
  - `packages/cli/src/tui/chat-tui-banner.tsx`
  - `packages/cli/src/tui/chat-tui-statusbar.tsx`
  - `scripts/test-project-cli.mjs`

你必须遵守以下冻结决策：
1. 只建立一层**小而稳定**的语义 token，不做完整主题系统。
2. token 至少覆盖这些角色：
   - `brand`
   - `accent`
   - `dim`
   - `success`
   - `warning`
   - `danger`
   - `panelBorder`
   - `muted`
3. 行模式与 TUI 都从同一来源消费 token。
4. `NO_COLOR` / `TERM=dumb` 下继续退化为纯文本，不做 fake theme。
5. 不引入 light/dark/auto/daltonized 多主题，不新增 mode 色相体系。

建议执行顺序：
1. 先重构 `style.ts`，把“裸 ANSI 常量表”升级成“语义 token + 兼容导出”的最小实现。
2. 再把 `chat-banner.ts`、`chat-status.ts`、`chat-stream-sink.ts` 改成消费 token，而不是继续散写颜色角色。
3. 再把 `tui/chat-tui-banner.tsx`、`tui/chat-tui-statusbar.tsx`、`tui/run-chat-tui.tsx` 对齐到同一语义色来源。
4. 最后更新 `help.ts` 与 `test-project-cli.mjs`，确保无 TTY 依赖新增、help 不回退。

不做什么：
- 不做完整 ThemeProvider
- 不做 light/dark 切换
- 不做 auto theme
- 不做 fake `plan/build/permission` 模式色
- 不做选区系统或复杂 shimmer 编排
- 不引入新依赖
- 不自行扩展到 062 的信息架构整理

验收标准：
- `pnpm --filter @theworld/cli check`
- `pnpm test:project-cli`
- `pnpm verify`

升级条件：
- 需要新增多主题切换或 auto theme
- 需要改 TUI 以外的产品 contract 才能表达视觉状态
- `pnpm verify` 连续两轮不通过
- 无法在不新增依赖的前提下同时兼顾行模式与 TUI 的 token 共用

你的输出方式：
- 先说明你理解的任务范围
- 再说明你准备修改哪些文件
- 修改后汇报 `pnpm --filter @theworld/cli check`、`pnpm test:project-cli` 与 `pnpm verify` 的结果
- 如果停止，明确说明停止原因和需要升级的点
```

---

## 使用说明

- 若 budget-mode 模型开始讨论大主题系统、ThemeProvider、色盲主题、auto theme 或新的 mode 语义，说明它已经偏离本单，应立即停止。
- 若只是要继续优化 TUI 的信息分区与 transcript 密度，应切换到 `062`，不要在本单继续扩张。
