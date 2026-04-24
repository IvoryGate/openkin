# 071 Budget-Mode Work Order

本文件不是新的 exec-plan，而是对 [`071_cli_shell_design_system_and_degradation.md`](./071_cli_shell_design_system_and_degradation.md) 的**弱模型执行工作单**。

---

## 可直接使用的提示词

```text
你当前处于 budget mode。

当前任务：
实现 `docs/exec-plans/completed/071_cli_shell_design_system_and_degradation.md`。

允许修改：
- `packages/cli/src/style.ts`
- `packages/cli/src/help.ts`
- `packages/cli/src/chat-banner.ts`
- `packages/cli/src/chat-status.ts`
- `packages/cli/src/tui/`
- `scripts/test-project-cli.mjs`
- `docs/requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md`
- `docs/requirements/THEWORLD_CLI_SHELL_DESIGN.md`
- `docs/exec-plans/completed/071_cli_shell_design_system_and_degradation.md`

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
- `docs/exec-plans/completed/071_cli_shell_design_system_and_degradation.md`
- 与任务直接相关的实现文件：
  - `packages/cli/src/style.ts`
  - `packages/cli/src/chat-status.ts`
  - `packages/cli/src/tui/run-chat-tui.tsx`
  - `scripts/test-project-cli.mjs`

冻结决策：
1. line UI 与 TUI 必须从同一 shell token 来源派生。
2. 不允许继续在组件里散写与 token 无关的临时颜色。
3. shell 组件语法必须统一覆盖 brand zone / panel border / status rail / transcript role color / footer focus-busy-blocked grammar。
4. `NO_COLOR` / `TERM=dumb` 下，去掉颜色和不必要动效，但必须保留信息层级、标签与顺序。
5. 窄终端优先保留高优先级信息，次级信息先收缩。

不做什么：
- 不引入完整主题系统
- 不引入 auto theme
- 不把设计系统需求反向变成 server contract

验收标准：
- `pnpm --filter @theworld/cli check`
- `pnpm test:project-cli`
- `pnpm verify`

升级条件：
- 需要完整 ThemeProvider 或多主题矩阵
- 需要新增跨层 contract 才能完成目标
- `pnpm verify` 连续两轮不通过
```
