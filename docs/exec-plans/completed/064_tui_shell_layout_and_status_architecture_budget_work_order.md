# 064 Budget-Mode Work Order

> **状态：已被 supersede（2026-04-24）。** 请勿再把本文件作为当前 budget-mode 主入口；新的 shell parity 路线改为 `067`–`072`。

本文件不是新的 exec-plan，而是对 [`064_tui_shell_layout_and_status_architecture.md`](./064_tui_shell_layout_and_status_architecture.md) 的**弱模型执行工作单**。

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
实现 `docs/exec-plans/completed/064_tui_shell_layout_and_status_architecture.md`。

任务范围：
- 允许修改的目录：
  - `packages/cli/src/tui/`
  - `packages/cli/src/chat-status.ts`
  - `packages/cli/src/chat-session-resolve.ts`（仅当需要复用 session identity 规则）
  - `scripts/test-project-cli.mjs`
  - `docs/requirements/THEWORLD_TUI_PRODUCT_DESIGN.md`
  - `docs/exec-plans/completed/064_tui_shell_layout_and_status_architecture.md`
- 不允许修改的目录：
  - `packages/shared/contracts/`
  - `packages/sdk/`
  - `packages/server/`
  - `packages/core/`
  - `apps/web-console/`
  - `packages/cli/src/style.ts` 的 token 体系

你开始前必须先读：
- `AGENTS.md`
- `docs/index.md`
- `docs/governance/MODEL_OPERATING_MODES.md`
- `docs/requirements/THEWORLD_TUI_PRODUCT_DESIGN.md`
- `docs/exec-plans/completed/060_cli_session_identity_and_tty_attach.md`
- `docs/exec-plans/completed/064_tui_shell_layout_and_status_architecture.md`
- 与任务直接相关的实现文件：
  - `packages/cli/src/tui/run-chat-tui.tsx`
  - `packages/cli/src/tui/chat-tui-statusbar.tsx`
  - `packages/cli/src/tui/chat-tui-banner.tsx`
  - `packages/cli/src/chat-status.ts`
  - `packages/cli/src/chat-session-resolve.ts`
  - `scripts/test-project-cli.mjs`

你必须遵守以下冻结决策：
1. TUI shell 固定为 `Header / Transcript / FooterAndInput` 三层。
2. Header 承载品牌位、session identity、当前 run phase。
3. Transcript 只负责正文语义块，不承担 phase 文案。
4. Footer/status rail 承载 host、short session reference、model / agent / context 近似信息和短键位提示。
5. session identity 统一为 `displayName -> alias -> shortId`。
6. run phase 统一为 `idle / thinking / streaming / failed / completed`。

建议执行顺序：
1. 先梳理 `run-chat-tui.tsx` 中现有 header / body / footer 职责。
2. 再明确 session identity 和 phase 的归属位置。
3. 拆分或整理状态栏与 banner 的职责，让正文区只消费 transcript block。
4. 更新测试或最小回归脚本，确保结构收口后 CLI 校验仍通过。

不做什么：
- 不新增后端字段或 DTO
- 不做完整视觉 token 重构
- 不做 keyboard / input polish
- 不引入多 pane 调试视图
- 不自行扩展到 `065` / `066`

验收标准：
- `pnpm --filter @theworld/cli check`
- `pnpm test:project-cli`
- `pnpm verify`

升级条件：
- 需要新增后端字段才能完成 session identity 或 status 设计
- 需要引入完整主题系统或新模式语义
- `pnpm verify` 连续两轮不通过

你的输出方式：
- 先说明你理解的任务范围
- 再说明你准备修改哪些文件
- 修改后汇报 `pnpm --filter @theworld/cli check`、`pnpm test:project-cli` 与 `pnpm verify` 的结果
- 如果停止，明确说明停止原因和需要升级的点
```

---

## 使用说明

- 若 budget-mode 模型开始主动讨论新的 server 字段、mode 切换、theme system 或多 pane shell，说明它已经偏离本单，应立即停止。
- 若 layout 完成后需要继续推进视觉 token 或输入 polish，请切换到 `065` 或 `066`，不要在本单中顺手扩展。
