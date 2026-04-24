# 063 Budget-Mode Work Order

> **状态：已被 supersede（2026-04-24）。** 请勿再把本文件作为当前 budget-mode 主入口；新的 shell parity 路线改为 `067`–`072`。

本文件不是新的 exec-plan，而是对 [`063_tui_transcript_model_and_stream_reducer.md`](./063_tui_transcript_model_and_stream_reducer.md) 的**弱模型执行工作单**。

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
实现 `docs/exec-plans/completed/063_tui_transcript_model_and_stream_reducer.md`。

任务范围：
- 允许修改的目录：
  - `packages/cli/src/chat-stream-sink.ts`
  - `packages/cli/src/tui/`
  - `packages/cli/src/chat-status.ts`（仅当确有必要对齐状态映射）
  - `scripts/test-project-cli.mjs`
  - `docs/requirements/THEWORLD_TUI_PRODUCT_DESIGN.md`
  - `docs/exec-plans/completed/063_tui_transcript_model_and_stream_reducer.md`
- 不允许修改的目录：
  - `packages/shared/contracts/`
  - `packages/sdk/`
  - `packages/server/`
  - `packages/core/`
  - `apps/web-console/`
  - `packages/cli/src/style.ts` 的共享 token 体系

你开始前必须先读：
- `AGENTS.md`
- `docs/index.md`
- `docs/governance/MODEL_OPERATING_MODES.md`
- `docs/requirements/THEWORLD_TUI_PRODUCT_DESIGN.md`
- `docs/exec-plans/completed/063_tui_transcript_model_and_stream_reducer.md`
- 与任务直接相关的实现文件：
  - `packages/cli/src/chat-stream-sink.ts`
  - `packages/cli/src/tui/run-chat-tui.tsx`
  - `packages/cli/src/chat-status.ts`
  - `scripts/test-project-cli.mjs`

你必须遵守以下冻结决策：
1. TUI transcript 主模型不再以 `string[]` 为核心。
2. block 类型冻结为：
   - `user`
   - `assistant`
   - `tool_call`
   - `tool_result`
   - `note`
   - `error`
   - `system_hint`
3. 只能重组现有 `streamRun` 事件，不能要求新增 server event。
4. 不再把 `--- run start ---` / `--- run end ---` 作为 TUI 主正文的一部分。
5. tool 相关内容默认呈现摘要，而不是直接扩成大段原始日志。

建议执行顺序：
1. 先梳理 `chat-stream-sink.ts` 与 `run-chat-tui.tsx` 的现有字符串路径。
2. 定义 transcript block 类型和 reducer。
3. 把 TUI 渲染改成消费 block，而不是只消费字符串数组。
4. 更新测试或最小回归脚本，确保新的 transcript 组织不会破坏现有 CLI 验证。

不做什么：
- 不新增 server / sdk contract
- 不重做 header / footer 信息架构
- 不做视觉 token 系统
- 不做输入与键盘 polish
- 不自行扩展到 `064` / `065` / `066`

验收标准：
- `pnpm --filter @theworld/cli check`
- `pnpm test:project-cli`
- `pnpm verify`

升级条件：
- 需要新增 server / sdk event 才能表达 transcript 语义
- 需要在本单内重做 shell layout 或视觉系统才能推进
- `pnpm verify` 连续两轮不通过

你的输出方式：
- 先说明你理解的任务范围
- 再说明你准备修改哪些文件
- 修改后汇报 `pnpm --filter @theworld/cli check`、`pnpm test:project-cli` 与 `pnpm verify` 的结果
- 如果停止，明确说明停止原因和需要升级的点
```

---

## 使用说明

- 若 budget-mode 模型开始讨论新的 stream 协议、server event、mode 体系或完整 UI redesign，说明它已经偏离本单，应立即停止。
- 若 transcript model 落地后需要继续推进新的 shell layout、shared tokens 或输入 polish，请切换到 `064`、`065`、`066` 对应工单，不要在本单内继续扩张。
