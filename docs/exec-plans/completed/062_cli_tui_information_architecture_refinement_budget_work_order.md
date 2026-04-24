# 062 Budget-Mode Work Order

> **状态：已被 supersede（2026-04-24）。** 请勿再把本文件作为当前 budget-mode 主入口；新的 shell parity 路线改为 `067`–`072`。

本文件不是新的 exec-plan，而是对 [`062_cli_tui_information_architecture_refinement.md`](./062_cli_tui_information_architecture_refinement.md) 的**弱模型执行工作单**。

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
实现 `docs/exec-plans/completed/062_cli_tui_information_architecture_refinement.md`。

任务范围：
- 允许修改的目录：
  - `packages/cli/src/tui/`
  - `packages/cli/src/chat-stream-sink.ts`（仅当需抽离 TUI 专用 sink 行为）
  - `packages/cli/src/chat-status.ts`
  - `packages/cli/src/help.ts`
  - `scripts/test-project-cli.mjs`
  - `docs/requirements/THEWORLD_CLI_SHELL_DESIGN.md`
  - `docs/exec-plans/completed/062_cli_tui_information_architecture_refinement.md`
- 不允许修改的目录：
  - `packages/shared/contracts/`
  - `packages/sdk/`
  - `packages/server/`
  - `packages/core/`
  - `apps/web-console/`
  - 行模式 `packages/cli/src/cmd-chat.ts` 主流程（除非只为共享纯函数导出所必需）

你开始前必须先读：
- `AGENTS.md`
- `docs/index.md`
- `docs/governance/MODEL_OPERATING_MODES.md`
- `docs/exec-plans/completed/062_cli_tui_information_architecture_refinement.md`
- 与任务直接相关的实现文件：
  - `packages/cli/src/tui/run-chat-tui.tsx`
  - `packages/cli/src/tui/chat-tui-banner.tsx`
  - `packages/cli/src/tui/chat-tui-statusbar.tsx`
  - `packages/cli/src/tui/chat-tui-art.ts`
  - `packages/cli/src/chat-status.ts`
  - `packages/cli/src/chat-stream-sink.ts`
  - `packages/cli/src/help.ts`
  - `scripts/test-project-cli.mjs`

你必须遵守以下冻结决策：
1. TUI 内部不再把 run 生命周期主要表达为 `--- run start ---` / `--- run end ---` 字面分隔线。
2. run 状态、思考中、失败提示、resume 提示等，优先进入：
   - header / banner 下的状态位
   - status bar
   - transcript 中的更紧凑事件块
3. transcript 保持“用户 / agent / tool / note”可区分，但减少纯实现性噪音行。
4. 继续只使用现有数据：
   - `sessionId`
   - `displayName` / alias / `agentId`
   - `getMessages()` 近似上下文统计
   - 既有 `streamRun` 事件
5. 不新增 token 计数、不新增实时成本、不新增服务端模式字段。

建议执行顺序：
1. 先梳理 `run-chat-tui.tsx` 里哪些文本是“实现性噪音”，哪些是真正的用户可见状态。
2. 再把 run 状态、失败提示、resume 提示收敛到 banner/status bar/transcript 的固定位置。
3. 若需要，再从 `chat-stream-sink.ts` 抽最小的 TUI 专用 sink 行为，但不要改 line mode 主 contract。
4. 最后更新 `scripts/test-project-cli.mjs` 与 `help.ts`，确保非 TTY 路径不回退。

不做什么：
- 不新增新的 TUI 模式（plan/build/permission）
- 不做多 pane 调试控制台
- 不做成本/上下文精确 token 统计
- 不改 Server / SDK surface
- 不重做 line mode

验收标准：
- `pnpm --filter @theworld/cli check`
- `pnpm test:project-cli`
- `pnpm verify`
- 手工 TTY 验证：
  - 新会话
  - `--resume`
  - tool call / tool result
  - 失败态
  - `NO_COLOR=1`

升级条件：
- 需要新增服务端状态字段才能完成 TUI 分区
- 需要改变 line mode stdout/stderr contract
- `pnpm verify` 连续两轮不通过
- 无法在既有 stream 事件内表达所需 TUI 分区

你的输出方式：
- 先说明你理解的任务范围
- 再说明你准备修改哪些文件
- 修改后汇报 `pnpm --filter @theworld/cli check`、`pnpm test:project-cli` 与 `pnpm verify` 的结果
- 单独列出已完成的手工 TTY 验证项
- 如果停止，明确说明停止原因和需要升级的点
```

---

## 使用说明

- 若 budget-mode 模型开始讨论新 server 字段、精确 token 计数、模式系统或多 pane 控制台，说明它已经偏离本单，应立即停止。
- 本单默认在 `061` 完成后再做；若 token 基础未收口，不要提前进入 062。
