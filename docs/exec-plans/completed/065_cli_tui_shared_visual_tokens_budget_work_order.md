# 065 Budget-Mode Work Order

> **状态：已被 supersede（2026-04-24）。** 请勿再把本文件作为当前 budget-mode 主入口；新的 shell parity 路线改为 `067`–`072`。

本文件不是新的 exec-plan，而是对 [`065_cli_tui_shared_visual_tokens.md`](./065_cli_tui_shared_visual_tokens.md) 的**弱模型执行工作单**。

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
实现 `docs/exec-plans/completed/065_cli_tui_shared_visual_tokens.md`。

任务范围：
- 允许修改的目录：
  - `packages/cli/src/style.ts`
  - `packages/cli/src/chat-banner.ts`
  - `packages/cli/src/chat-status.ts`
  - `packages/cli/src/help.ts`
  - `packages/cli/src/tui/`
  - `scripts/test-project-cli.mjs`
  - `docs/requirements/THEWORLD_CLI_SHELL_DESIGN.md`
  - `docs/requirements/THEWORLD_TUI_PRODUCT_DESIGN.md`
  - `docs/exec-plans/completed/065_cli_tui_shared_visual_tokens.md`
- 不允许修改的目录：
  - `packages/shared/contracts/`
  - `packages/sdk/`
  - `packages/server/`
  - `packages/core/`
  - `apps/web-console/`

你开始前必须先读：
- `AGENTS.md`
- `docs/index.md`
- `docs/governance/MODEL_OPERATING_MODES.md`
- `docs/requirements/THEWORLD_CLI_SHELL_DESIGN.md`
- `docs/requirements/THEWORLD_TUI_PRODUCT_DESIGN.md`
- `docs/exec-plans/completed/065_cli_tui_shared_visual_tokens.md`
- 与任务直接相关的实现文件：
  - `packages/cli/src/style.ts`
  - `packages/cli/src/chat-banner.ts`
  - `packages/cli/src/chat-status.ts`
  - `packages/cli/src/help.ts`
  - `packages/cli/src/tui/chat-tui-banner.tsx`
  - `packages/cli/src/tui/chat-tui-statusbar.tsx`
  - `scripts/test-project-cli.mjs`

你必须遵守以下冻结决策：
1. 最小 token 角色集冻结为：
   - `brand`
   - `accent`
   - `muted`
   - `dim`
   - `panelBorder`
   - `user`
   - `assistant`
   - `tool`
   - `success`
   - `warning`
   - `danger`
   - `focus`
2. line UI 与 TUI 必须从同一 token 来源派生。
3. 不允许继续在组件内部散写与 token 无关的临时颜色。
4. `NO_COLOR` / `TERM=dumb` 下必须优雅退化为无色但保留结构层级。
5. 不引入完整 ThemeProvider、多主题或自动主题切换。

建议执行顺序：
1. 先梳理 `style.ts` 的现有样式出口。
2. 定义最小 token 层和兼容的辅助函数。
3. 再接入 line UI 与 TUI 的关键组件。
4. 检查 `NO_COLOR` / `TERM=dumb` 退化路径，避免 token 设计反而破坏简化终端体验。

不做什么：
- 不引入大型主题系统
- 不新增 server / sdk surface
- 不重做 transcript reducer 或 shell layout
- 不自行扩展到 `066`

验收标准：
- `pnpm --filter @theworld/cli check`
- `pnpm test:project-cli`
- `pnpm verify`

升级条件：
- 需要引入完整主题系统、多主题矩阵或外部 UI 依赖
- 需要为 token 设计新增 server / sdk surface
- `pnpm verify` 连续两轮不通过

你的输出方式：
- 先说明你理解的任务范围
- 再说明你准备修改哪些文件
- 修改后汇报 `pnpm --filter @theworld/cli check`、`pnpm test:project-cli` 与 `pnpm verify` 的结果
- 如果停止，明确说明停止原因和需要升级的点
```

---

## 使用说明

- 若 budget-mode 模型开始讨论完整主题系统、参考项目源码迁移或新的运行模式，说明它已经偏离本单，应立即停止。
- 若共享 token 落地后需要继续推进输入区和窄终端 polish，请切换到 `066`，不要在本单中继续扩张。
