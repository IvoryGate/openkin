# 067 Budget-Mode Work Order

本文件不是新的 exec-plan，而是对 [`067_cli_shell_home_and_information_architecture.md`](./067_cli_shell_home_and_information_architecture.md) 的**弱模型执行工作单**。

---

## 可直接使用的提示词

```text
你当前处于 budget mode。

当前任务：
实现 `docs/exec-plans/completed/067_cli_shell_home_and_information_architecture.md`。

允许修改：
- `packages/cli/src/cmd-chat.ts`
- `packages/cli/src/help.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/tui/`
- `scripts/test-project-cli.mjs`
- `docs/requirements/PROJECT_CLI.md`
- `docs/requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md`
- `docs/exec-plans/completed/067_cli_shell_home_and_information_architecture.md`

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
- `docs/exec-plans/completed/067_cli_shell_home_and_information_architecture.md`
- 与任务直接相关的实现文件：
  - `packages/cli/src/cmd-chat.ts`
  - `packages/cli/src/help.ts`
  - `packages/cli/src/tui/run-chat-tui.tsx`
  - `scripts/test-project-cli.mjs`

冻结决策：
1. CLI shell 必须有清晰的 home / empty shell，而不是只有 banner + 空 transcript。
2. home shell 负责品牌位、主入口提示、recent/resume affordance 的位置与 command/help discoverability。
3. root help、topic help、shell hint 必须叙事一致。
4. 不新增子命令。
5. 继续遵守 human rail vs machine rail 约束。

不做什么：
- 不新增子命令
- 不做 richer thread metadata
- 不重做 active transcript runtime
- 不做完整 command palette

验收标准：
- `pnpm test:project-cli`
- `pnpm verify`

升级条件：
- 需要新增 server 字段才能表达 home shell 基本入口
- 需要重写 CLI 入口解析体系
- `pnpm verify` 连续两轮不通过
```
