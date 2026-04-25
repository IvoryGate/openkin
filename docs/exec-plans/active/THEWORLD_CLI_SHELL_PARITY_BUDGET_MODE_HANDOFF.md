# TheWorld CLI Shell Parity Budget-Mode Handoff (Wave 2)

> **状态：已并回主 handoff（2026-04-24）。** 当前唯一主入口为 [`THEWORLD_CLI_BUDGET_MODE_HANDOFF.md`](./THEWORLD_CLI_BUDGET_MODE_HANDOFF.md)。本文件仅保留为过渡说明，避免旧引用失效。

本文件曾用于 `067`–`072` 的阶段性总控；当前请统一改用主入口 `THEWORLD_CLI_BUDGET_MODE_HANDOFF.md`。

目标：

- 把 shell parity 第二阶段拆成可串行执行的固定路径
- 让 budget-mode 在冻结边界内推进，不再做方向判断
- 明确跨层影响范围与“本轮明确不做什么”

---

## 影响范围与不做什么（先冻结）

### 影响范围

本轮只允许影响以下层级：

1. **CLI/TUI 表现层（直接影响）**
   - `packages/cli/src/**`
   - `scripts/test-project-cli.mjs`
2. **需求与执行计划文档层（直接影响）**
   - `docs/requirements/PROJECT_CLI.md`
   - `docs/requirements/THEWORLD_CLI_SHELL_DESIGN.md`
   - `docs/requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md`
   - `docs/exec-plans/active/**`（仅对应工单及 handoff）

### 明确不做什么

本轮不允许推进以下方向：

- 不新增或修改跨层 wire contract（`packages/shared/contracts/**`）
- 不改 SDK 对外接口（`packages/sdk/**`）
- 不改 server API/DTO/event（`packages/server/**`）
- 不改 core runtime 架构（`packages/core/**`）
- 不做 web-console 功能迁移（`apps/web-console/**`）
- 不引入完整主题系统、多主题或新终端框架

---

## 使用方式

请改用：

- [`THEWORLD_CLI_BUDGET_MODE_HANDOFF.md`](./THEWORLD_CLI_BUDGET_MODE_HANDOFF.md)

以下内容保留仅作历史过渡参考。

严格按以下顺序串行执行，不要并行，不要跳单：

1. `067` Shell Home 与 Information Architecture
2. `068` Conversation Runtime Shell
3. `069` Session 与 Thread UX
4. `070` Input 与 Command Affordances
5. `071` Shell Design System 与 Degradation
6. `072` Validation 与 Acceptance Harness

每单都必须满足：

- 先读 `AGENTS.md`
- 先读 `docs/index.md`
- 先读 `docs/governance/MODEL_OPERATING_MODES.md`
- 只在对应 work order 允许目录内修改
- 完成后必须跑计划要求命令，且最终有 `pnpm verify`
- 命中升级条件立刻停止，不得自行扩展

---

## 建议投喂顺序

### 第 1 单（067）

投喂：

- [`067_cli_shell_home_and_information_architecture_budget_work_order.md`](./067_cli_shell_home_and_information_architecture_budget_work_order.md)

放行前最小验收：

- `pnpm test:project-cli`
- `pnpm verify`

### 第 2 单（068）

投喂：

- [`068_cli_conversation_runtime_shell_budget_work_order.md`](./068_cli_conversation_runtime_shell_budget_work_order.md)

放行前最小验收：

- `pnpm --filter @theworld/cli check`
- `pnpm test:project-cli`
- `pnpm verify`

### 第 3 单（069）

投喂：

- [`069_cli_session_and_thread_ux_budget_work_order.md`](./069_cli_session_and_thread_ux_budget_work_order.md)

放行前最小验收：

- `pnpm test:project-cli`
- `pnpm verify`

### 第 4 单（070）

投喂：

- [`070_cli_input_and_command_affordances_budget_work_order.md`](./070_cli_input_and_command_affordances_budget_work_order.md)

放行前最小验收：

- `pnpm --filter @theworld/cli check`
- `pnpm test:project-cli`
- `pnpm verify`

### 第 5 单（071）

投喂：

- [`071_cli_shell_design_system_and_degradation_budget_work_order.md`](./071_cli_shell_design_system_and_degradation_budget_work_order.md)

放行前最小验收：

- `pnpm --filter @theworld/cli check`
- `pnpm test:project-cli`
- `pnpm verify`

### 第 6 单（072）

投喂：

- [`072_cli_shell_validation_and_acceptance_harness_budget_work_order.md`](./072_cli_shell_validation_and_acceptance_harness_budget_work_order.md)

放行前最小验收：

- `pnpm test:project-cli`
- `pnpm verify`
- 工单定义的手工 TTY/product review matrix

---

## 必须停止并升级到 high-capability mode 的条件

命中任一即停止：

1. 需要新增/修改 `packages/shared/contracts/**` 才能继续。
2. 需要新增 server endpoint/event/DTO 字段才能完成工单目标。
3. 需要改 SDK public API 或调用语义才能继续。
4. 需要引入多主题系统、新终端框架或重写输入运行时。
5. 任一工单连续两轮 `pnpm verify` 无法通过。
6. 弱模型开始讨论计划外架构迁移或跨层重设计。

---

## 与主 handoff 的关系

- 当前唯一主入口是 [`THEWORLD_CLI_BUDGET_MODE_HANDOFF.md`](./THEWORLD_CLI_BUDGET_MODE_HANDOFF.md)。
- 本文件不再是推荐投喂入口。
