# TheWorld CLI Budget-Mode Handoff

本文件是给**低能力模型串行开发**使用的总控入口。

目标：

- 让你不必再手动解释 `059`、`060`、`067`–`072` 的关系
- 让 budget-mode 只需拿到对应工作单就能执行
- 强制每一单都在冻结边界内完成，再进入下一单

---

## 使用方式

严格按以下顺序串行执行，不要并行，不要跳单：

1. `059` 输出轨与 Help Contract
2. `060` Session Identity 与 TTY Attach
3. `067` CLI Shell Home 与 Information Architecture
4. `068` CLI Conversation Runtime Shell
5. `069` CLI Session 与 Thread UX
6. `070` CLI Input 与 Command Affordances
7. `071` CLI Shell Design System 与 Degradation
8. `072` CLI Shell Validation 与 Acceptance Harness

每单都必须满足：

- 先读 `AGENTS.md`
- 先读 `docs/index.md`
- 先读 `docs/governance/MODEL_OPERATING_MODES.md`
- 只在该单允许目录内修改
- 完成后必须跑计划要求的命令，最终要有 `pnpm verify`
- 若命中升级条件，立即停止，不要自己改方向

---

## 建议投喂顺序

### 第 1 单

把下面文件全文交给低能力模型：

- [`059_cli_output_rails_and_help_contract_budget_work_order.md`](./059_cli_output_rails_and_help_contract_budget_work_order.md)

只有在它明确汇报以下都通过后，才进入下一单：

- `pnpm test:project-cli`
- `pnpm verify`

### 第 2 单

把下面文件全文交给低能力模型：

- [`060_cli_session_identity_and_tty_attach_budget_work_order.md`](./060_cli_session_identity_and_tty_attach_budget_work_order.md)

只有在它明确汇报以下都通过后，才进入下一单：

- `pnpm test:project-cli`
- `pnpm verify`

### 第 3 单

把下面文件全文交给低能力模型：

- [`067_cli_shell_home_and_information_architecture_budget_work_order.md`](./067_cli_shell_home_and_information_architecture_budget_work_order.md)

只有在它明确汇报以下都通过后，才进入下一单：

- `pnpm --filter @theworld/cli check`
- `pnpm test:project-cli`
- `pnpm verify`

### 第 4 单

把下面文件全文交给低能力模型：

- [`068_cli_conversation_runtime_shell_budget_work_order.md`](./068_cli_conversation_runtime_shell_budget_work_order.md)

只有在它明确汇报以下都通过后，才进入下一单：

- `pnpm --filter @theworld/cli check`
- `pnpm test:project-cli`
- `pnpm verify`

### 第 5 单

把下面文件全文交给低能力模型：

- [`069_cli_session_and_thread_ux_budget_work_order.md`](./069_cli_session_and_thread_ux_budget_work_order.md)

只有在它明确汇报以下都通过后，才进入下一单：

- `pnpm --filter @theworld/cli check`
- `pnpm test:project-cli`
- `pnpm verify`

### 第 6 单

把下面文件全文交给低能力模型：

- [`070_cli_input_and_command_affordances_budget_work_order.md`](./070_cli_input_and_command_affordances_budget_work_order.md)

只有在它明确汇报以下都通过后，才进入下一单：

- `pnpm --filter @theworld/cli check`
- `pnpm test:project-cli`
- `pnpm verify`

### 第 7 单

把下面文件全文交给低能力模型：

- [`071_cli_shell_design_system_and_degradation_budget_work_order.md`](./071_cli_shell_design_system_and_degradation_budget_work_order.md)

只有在它明确汇报以下都通过后，才进入下一单：

- `pnpm --filter @theworld/cli check`
- `pnpm test:project-cli`
- `pnpm verify`

### 第 8 单

把下面文件全文交给低能力模型：

- [`072_cli_shell_validation_and_acceptance_harness_budget_work_order.md`](./072_cli_shell_validation_and_acceptance_harness_budget_work_order.md)

只有在它明确汇报以下都通过后，才视为本轮 CLI shell parity 计划闭环：

- `pnpm test:project-cli`
- `pnpm verify`
- 计划要求的手工 TTY / product review matrix
- benchmark comparison 结论

---

## 被 supersede 的旧路线

以下旧路线**不再**作为 budget-mode 主路径：

- `061_cli_visual_tokens_foundation.md`
- `062_cli_tui_information_architecture_refinement.md`
- `063_tui_transcript_model_and_stream_reducer.md`
- `064_tui_shell_layout_and_status_architecture.md`
- `065_cli_tui_shared_visual_tokens.md`
- `066_tui_input_keyboard_polish_and_tty_matrix.md`

原因：

- 它们仍以 TUI-local 视角拆分问题，默认接受旧的 shell framing
- 新的 `THEWORLD_CLI_SHELL_PARITY_DESIGN.md` 已把问题升级为 shell 级产品面：home、conversation、thread、input、design system、acceptance 全部重排

因此，除非为了理解历史实现，否则不要再把 `061`–`066` 作为当前实施入口投喂给弱模型

---

## 什么时候必须停止，不再继续交给弱模型

只要命中任一情况，就应停止 budget-mode，回到 high-capability mode：

1. 需要新增或修改 Service / SDK contract。
2. 需要为 CLI/TUI 新增 server 字段、endpoint、event 或 DTO。
3. 需要引入完整主题系统、多主题、auto theme、mode 体系。
4. 需要新增或修改 shell parity 设计中尚未冻结的 contract，超出 `THEWORLD_CLI_SHELL_PARITY_DESIGN.md` 与 `CLI_SHELL_CONTRACT_GAPS.md` 已定义边界。
5. 任一工单连续两轮 `pnpm verify` 无法通过。
6. 低能力模型开始主动讨论参考项目的架构迁移、主题系统复制、plan/build 模式等计划外方向。

---

## 每单交付后的人工检查清单

在接受 budget-mode 输出前，建议只核对这几件事：

1. 是否只修改了该单允许目录。
2. 是否明确汇报了计划里的验收命令。
3. 是否没有顺手扩张到下一单内容。
4. 是否没有新造 contract。
5. 若是 `072`，是否真的给出了手工 TTY / product review matrix 与 benchmark comparison，而不只是说“应该没问题”。

---

## 关联文档

- [`docs/requirements/THEWORLD_CLI_SHELL_DESIGN.md`](../../requirements/THEWORLD_CLI_SHELL_DESIGN.md)
- [`docs/requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md`](../../requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md)
- [`docs/requirements/THEWORLD_TUI_PRODUCT_DESIGN.md`](../../requirements/THEWORLD_TUI_PRODUCT_DESIGN.md)
- [`docs/requirements/PROJECT_CLI.md`](../../requirements/PROJECT_CLI.md)
- [`docs/architecture-docs-for-agent/second-layer/CLI_SHELL_CONTRACT_GAPS.md`](../../architecture-docs-for-agent/second-layer/CLI_SHELL_CONTRACT_GAPS.md)
- [`059_cli_output_rails_and_help_contract.md`](./059_cli_output_rails_and_help_contract.md)
- [`060_cli_session_identity_and_tty_attach.md`](./060_cli_session_identity_and_tty_attach.md)
- [`067_cli_shell_home_and_information_architecture.md`](./067_cli_shell_home_and_information_architecture.md)
- [`068_cli_conversation_runtime_shell.md`](./068_cli_conversation_runtime_shell.md)
- [`069_cli_session_and_thread_ux.md`](./069_cli_session_and_thread_ux.md)
- [`070_cli_input_and_command_affordances.md`](./070_cli_input_and_command_affordances.md)
- [`071_cli_shell_design_system_and_degradation.md`](./071_cli_shell_design_system_and_degradation.md)
- [`072_cli_shell_validation_and_acceptance_harness.md`](./072_cli_shell_validation_and_acceptance_harness.md)
