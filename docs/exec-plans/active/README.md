# 执行中 / 未归档的执行计划

本目录仅保留**仍在推进或作为入口说明**的文档；**已落库验收**的编号线性执行计划已归档到 [`../completed/`](../completed/)。

- **新工单编号**自 **080** 起登记（`073`–`079` Desktop TUI 批已闭环）。当前 **TUI 对齐详细设计** 的收口工单见下「推进队列」。
- **056–066 / 059–072** 历史索引见 [`../completed/README.md`](../completed/README.md) 中 **CLI TUI 与 Shell Parity 轨（056–072）** 一节。  
- **Desktop TUI 设计（073–079）** 全批归档，索引见下节「已归档」。
- **低预算/承接说明（保留在 active，不作为线性工单正文）**：
  - [`THEWORLD_CLI_BUDGET_MODE_HANDOFF.md`](./THEWORLD_CLI_BUDGET_MODE_HANDOFF.md) — THEWORLD/CLI 模式与可交付约束总览
  - [`THEWORLD_CLI_SHELL_PARITY_BUDGET_MODE_HANDOFF.md`](./THEWORLD_CLI_SHELL_PARITY_BUDGET_MODE_HANDOFF.md) — Shell 形态对齐（含 067+ 的承接与 supersession 说明）
- **Desktop 详细设计稿（人类稿）**：[TUI 详细方案](../../requirements/TUI_DESKTOP_DESIGN_SPEC.md)（与 Desktop `docs/TUI_DESIGN.md` 同步）。

## Desktop TUI 批（已归档 073–079）

| 编号 | 链接 |
|------|------|
| 073 | [Desktop 对账与 gap 矩阵](../completed/073_tui_desktop_spec_ingest_and_gap_matrix.md) |
| 077 | [响应式断点 + 侧栏 80/20](../completed/077_tui_responsive_breakpoints_sidebar.md) |
| 078 | [会话列表数据适配器](../completed/078_feature_tui_session_list_data_adapter.md) |
| 079 | [全屏会话列表 + Ctrl+L](../completed/079_tui_session_list_fullscreen_overlay.md) |

（074–076 及更早同系列见 [`../completed/README.md`](../completed/README.md) **Desktop TUI 设计实施** 与 **CLI TUI 与 Shell Parity 轨** 等节。）

## 推进队列（`080+`）

| 编号 | 链接 | 说明 |
|------|------|------|
| 080 | [TUI 对齐 TUI_DESKTOP_DESIGN_SPEC（主题/布局/色块/侧栏/设置占位）](./080_tui_desktop_spec_compliance.md) | 最低层设计约束的 CLI TUI 分阶段实施与验收 |
| 081 | [主界面色块可见性：对照 Desktop OpenCode，Ink 侧分步复刻](./081_tui_opencode_color_blocks_ink_parity.md) | `Text` 铺行保底 + 四带/侧栏对标 OpenCode；先模仿再收敛 |
| 083 | [OpenCode 式「Zen」布局总览（子单 084–087）](./083_opencode_zen_layout_parent.md) | 左下多行输入、通栏侧栏、输入下信息带、类网页滚动等（对照 OpenCode 交互与层次） |
| 084 | [多行输入 · 最高 6 行](./084_tui_opencode_multiline_draft_six_max.md) | **084–086 已代码落地**；087 为鼠标滚轮调研单 |
| 088 | [后半层架构实施总路线图](./088_post_core_later_layers_architecture_roadmap.md) | L4–L6 的父级路线图：control plane、single-agent completeness、channel、plan/team/workflow 分波次推进 |
| 089 | [L3 substrate 父单（子单 090–096）](./089_l3_product_substrate_parent.md) | 第三层到第四层之间的 substrate 实施总控入口，供低能力模型串行推进 |
| 098 | [L4 Engineering Product Shell 父单（子单 099–106）](./098_l4_engineering_product_shell_parent.md) | 第四层本地 terminal-first 工程产品壳实施总控入口 |

**082 已归档**：[`../completed/082_tui_layout_input_cursor_sidebar_contrast.md`](../completed/082_tui_layout_input_cursor_sidebar_contrast.md)。

## 本目录其他活动工单

- `088` 是后半层架构父级路线图，不直接替代具体子工单。
- `089` 是 `L3` substrate 父单；`090–096` 必须按顺序串行推进，不并行、不跳单。
- `098` 是 `L4` Engineering Product Shell 父单；`099–106` 必须按顺序串行推进，不并行、不跳单。
- **`090` 已归档**（run identity & lifecycle）：[`../completed/090_l3_run_identity_and_lifecycle.md`](../completed/090_l3_run_identity_and_lifecycle.md)
- **`091` 已归档**（unified event plane）：[`../completed/091_l3_unified_event_plane.md`](../completed/091_l3_unified_event_plane.md)
- **`092` 已归档**（scheduler reliability and heartbeat）：[`../completed/092_l3_scheduler_reliability_and_heartbeat.md`](../completed/092_l3_scheduler_reliability_and_heartbeat.md)
- **`093` 已归档**（approval and danger protocol）：[`../completed/093_l3_approval_and_danger_protocol.md`](../completed/093_l3_approval_and_danger_protocol.md)
- **`094` 已归档**（context memory descriptors）：[`../completed/094_l3_context_memory_descriptors.md`](../completed/094_l3_context_memory_descriptors.md)
- **`095` 已归档**（multimodal contract）：[`../completed/095_l3_multimodal_contract.md`](../completed/095_l3_multimodal_contract.md)
- **`096` 已归档**（tooling exposure and introspection）：[`../completed/096_l3_tooling_exposure_and_introspection.md`](../completed/096_l3_tooling_exposure_and_introspection.md) — `ToolEntryDto.riskClass` / `category`、`GET /v1/tools`、builtin metadata；`test:introspection`
- **`097` 已归档**（`pnpm verify` / 集成烟测卡死 harness）：[`../completed/097_verify_and_integration_hang_handoff.md`](../completed/097_verify_and_integration_hang_handoff.md)
- **`099` 已归档**（product control plane and shell map）：[`../completed/099_l4_product_control_plane_and_shell_map.md`](../completed/099_l4_product_control_plane_and_shell_map.md) — `L4_PRODUCT_SHELL_MAP.md` · `l4-product-map.ts` · `test:l4-shell-map`
- **`100` 已归档**（onboarding setup discoverability）：[`../completed/100_l4_onboarding_setup_discoverability.md`](../completed/100_l4_onboarding_setup_discoverability.md) — `l4-onboarding.ts` · help `First run` · `test:l4-onboarding`
- **`101` 已归档**（context engineering surface）：[`../completed/101_l4_context_engineering_surface.md`](../completed/101_l4_context_engineering_surface.md) — `inspect context` · `/context` · TUI context hint · `test:l4-context`
- **`102` 已归档**（layered memory product surface）：[`../completed/102_l4_layered_memory_product_surface.md`](../completed/102_l4_layered_memory_product_surface.md) — `inspect memory` · `/memory` · rail `ctx·… · mem·…` · `test:l4-memory`
- **`103` 已归档**（permission approval product flow）：[`../completed/103_l4_permission_approval_product_flow.md`](../completed/103_l4_permission_approval_product_flow.md) — `inspect approvals` / `approval` · `/approvals` · tools risk+ · `test:l4-approval`
- **`104` 已归档**（background resume recover）：[`../completed/104_l4_background_resume_recover.md`](../completed/104_l4_background_resume_recover.md) — `l4-background-resume` · `sessions runs` · `inspect resume` · `/runs` · `test:l4-background`
- **`105` 已归档**（single-agent plan review execute）：[`../completed/105_l4_single_agent_plan_review_execute.md`](../completed/105_l4_single_agent_plan_review_execute.md) — `theworld plan` · `.theworld/plan/` · `test:l4-plan`
- **`106` 已归档**（terminal product shell polish）：[`../completed/106_l4_terminal_product_shell_polish.md`](../completed/106_l4_terminal_product_shell_polish.md) — help/onboarding/home hints · `test:l4-polish`

