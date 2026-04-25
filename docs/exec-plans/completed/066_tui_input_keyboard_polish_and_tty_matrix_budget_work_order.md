# 066 Budget-Mode Work Order

> **状态：已被 supersede（2026-04-24）。** 请勿再把本文件作为当前 budget-mode 主入口；新的 shell parity 路线改为 `067`–`072`。

本文件不是新的 exec-plan，而是对 [`066_tui_input_keyboard_polish_and_tty_matrix.md`](./066_tui_input_keyboard_polish_and_tty_matrix.md) 的**弱模型执行工作单**。

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
实现 `docs/exec-plans/completed/066_tui_input_keyboard_polish_and_tty_matrix.md`。

任务范围：
- 允许修改的目录：
  - `packages/cli/src/tui/`
  - `packages/cli/src/chat-input.ts`
  - `packages/cli/src/chat-args.ts`
  - `packages/cli/src/chat-status.ts`
  - `scripts/test-project-cli.mjs`
  - `docs/requirements/THEWORLD_TUI_PRODUCT_DESIGN.md`
  - `docs/requirements/PROJECT_CLI.md`
  - `docs/exec-plans/completed/066_tui_input_keyboard_polish_and_tty_matrix.md`
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
- `docs/requirements/THEWORLD_TUI_PRODUCT_DESIGN.md`
- `docs/exec-plans/completed/066_tui_input_keyboard_polish_and_tty_matrix.md`
- 与任务直接相关的实现文件：
  - `packages/cli/src/tui/run-chat-tui.tsx`
  - `packages/cli/src/chat-input.ts`
  - `packages/cli/src/chat-args.ts`
  - `packages/cli/src/chat-status.ts`
  - `scripts/test-project-cli.mjs`

你必须遵守以下冻结决策：
1. 输入区必须显式区分 `idle / busy / blocked`。
2. 窄终端下优先保留 transcript 宽度与高优先级状态，允许 banner / status rail 收缩。
3. `NO_COLOR` / `TERM=dumb` 下去掉颜色与不必要动效，但保留层级与标签。
4. 非 TTY 继续走 line UI contract，不为 TUI 兼容性污染非 TTY 路径。
5. 本单必须给出手工 TTY 验证矩阵，至少覆盖常规宽终端、窄终端、`NO_COLOR`、失败态、结束态。

建议执行顺序：
1. 先梳理现有输入区和 busy 态逻辑。
2. 再补 idle / busy / blocked 的稳定呈现。
3. 处理窄终端与 `NO_COLOR` 收缩策略。
4. 更新自动化校验与手工 TTY 验证矩阵。

不做什么：
- 不新增 fake `plan/build/permission` 模式
- 不引入多主题系统
- 不为 TUI 反向设计新的后端能力
- 不引入新的终端框架

验收标准：
- `pnpm --filter @theworld/cli check`
- `pnpm test:project-cli`
- `pnpm verify`
- 汇报手工 TTY 验证矩阵

升级条件：
- 需要新 server contract 才能表达输入或状态需求
- 需要引入新的终端框架才能解决输入问题
- `pnpm verify` 连续两轮不通过

你的输出方式：
- 先说明你理解的任务范围
- 再说明你准备修改哪些文件
- 修改后汇报 `pnpm --filter @theworld/cli check`、`pnpm test:project-cli`、`pnpm verify` 与手工 TTY 验证矩阵结果
- 如果停止，明确说明停止原因和需要升级的点
```

---

## 使用说明

- 若 budget-mode 模型开始讨论新的后端字段、mode 体系、多 pane 调试 UI 或终端框架迁移，说明它已经偏离本单，应立即停止。
- `066` 是本轮 TUI 重设计的收口单；若它不能在冻结边界内完成，应回到 high-capability mode，而不是继续拆散方向。
