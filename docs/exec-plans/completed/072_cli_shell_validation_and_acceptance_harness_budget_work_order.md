# 072 Budget-Mode Work Order

本文件不是新的 exec-plan，而是对 [`072_cli_shell_validation_and_acceptance_harness.md`](./072_cli_shell_validation_and_acceptance_harness.md) 的**弱模型执行工作单**。

---

## 可直接使用的提示词

```text
你当前处于 budget mode。

当前任务：
实现 `docs/exec-plans/completed/072_cli_shell_validation_and_acceptance_harness.md`。

允许修改：
- `scripts/test-project-cli.mjs`
- `package.json`
- `packages/cli/src/`（仅当为测试可观测性或小型 harness 接口所必需）
- `docs/requirements/PROJECT_CLI.md`
- `docs/requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md`
- `docs/exec-plans/active/THEWORLD_CLI_BUDGET_MODE_HANDOFF.md`
- `docs/exec-plans/completed/072_cli_shell_validation_and_acceptance_harness.md`

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
- `docs/exec-plans/completed/072_cli_shell_validation_and_acceptance_harness.md`
- 与任务直接相关的实现文件：
  - `scripts/test-project-cli.mjs`
  - `package.json`
  - `packages/cli/src/cmd-chat.ts`
  - `docs/exec-plans/active/THEWORLD_CLI_BUDGET_MODE_HANDOFF.md`

冻结决策：
1. 验收必须分成自动化与手工 TTY/product review 两条线。
2. 自动化至少覆盖 help/discoverability、session-thread flows、degraded-mode、conversation shell 关键 smoke。
3. 手工 review matrix 至少覆盖 wide/narrow terminal、`NO_COLOR`、failed/completed run、session switching/picker、empty shell vs active shell。
4. 验收汇报必须包含 benchmark comparison，不允许只给主观结论。

不做什么：
- 不为测试发明新的 server DTO
- 不把 benchmark comparison 变成“复制参考项目截图”
- 不用自动化替代必要的手工 TTY/product review

验收标准：
- `pnpm test:project-cli`
- `pnpm verify`

升级条件：
- 需要新增跨层 contract 才能完成 acceptance harness
- 需要引入新的外部终端测试框架且超出本轮预算
- `pnpm verify` 连续两轮不通过
```
