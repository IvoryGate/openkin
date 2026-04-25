# 070 Budget-Mode Work Order

本文件不是新的 exec-plan，而是对 [`070_cli_input_and_command_affordances.md`](./070_cli_input_and_command_affordances.md) 的**弱模型执行工作单**。

---

## 可直接使用的提示词

```text
你当前处于 budget mode。

当前任务：
实现 `docs/exec-plans/completed/070_cli_input_and_command_affordances.md`。

允许修改：
- `packages/cli/src/chat-input.ts`
- `packages/cli/src/cmd-chat.ts`
- `packages/cli/src/slash-chat.ts`
- `packages/cli/src/slash-complete.ts`
- `packages/cli/src/help.ts`
- `packages/cli/src/tui/`
- `scripts/test-project-cli.mjs`
- `docs/requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md`
- `docs/exec-plans/completed/070_cli_input_and_command_affordances.md`

禁止修改：
- `packages/shared/contracts/`
- `packages/sdk/`
- `packages/server/`
- `packages/core/`
- `apps/web-console/`

开始前必须先读：
- `AGENTS.md`
- `docs/index.md`
- `docs/governance/MODEL_OPERATING_MODES.md`
- `docs/requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md`
- `docs/exec-plans/completed/070_cli_input_and_command_affordances.md`
- 与任务直接相关的实现文件：
  - `packages/cli/src/chat-input.ts`
  - `packages/cli/src/slash-chat.ts`
  - `packages/cli/src/slash-complete.ts`
  - `packages/cli/src/tui/run-chat-tui.tsx`
  - `scripts/test-project-cli.mjs`

冻结决策：
1. 输入态必须显式区分 idle / busy / blocked。
2. input/footer 必须明确告诉用户现在能否输入、输入会发生什么、有哪些高价值命令入口。
3. slash discoverability 必须成为 shell affordance。
4. 可增强 draft editing 与 keyboard grammar，但不引入新的终端框架。

不做什么：
- 不新增 fake mode
- 不引入完整 command palette contract
- 不引入新的终端框架

验收标准：
- `pnpm --filter @theworld/cli check`
- `pnpm test:project-cli`
- `pnpm verify`

升级条件：
- 需要新的终端框架
- 需要新的 capability/mode contract
- `pnpm verify` 连续两轮不通过
```
