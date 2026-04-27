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
| 108 | [L5 客户端原型（先接 Figma MCP）](./108_l5_client_prototype_with_figma_mcp.md) | 先完成 Figma MCP 接入与可观测验证，再进入客户端原型设计 |
| 109 | [L5 设计资产 contract 冻结与 budget 承接](./109_l5_design_contract_freeze_and_budget_handoff.md) | 冻结 L5 当前阶段边界、自动化反馈回路与弱模型单一路径工作单 |
| 110 | [L5 客户端：参考图拆解、组件化设计与开发工单](./110_l5_client_componentized_design_and_dev_workorders.md) | 由原型优先切换为组件优先，按 WO-1~WO-6 串行推进客户端开发 |
| 111 | [WO-2 桌面端 Session Surface 接入](./111_wo2_desktop_session_surface_integration.md) | 左栏会话从 mock 切换到真实 `GET /v1/sessions`，不扩展 contract |
| 112 | [WO-3 桌面端 Messages 与 Composer 接入](./112_wo3_desktop_messages_and_composer_integration.md) | 中区接入真实 messages/run/stream 终态刷新，不扩展 contract |
| 113 | [WO-2 左栏样式与会话溢出交互修复](./113_wo2_left_rail_style_and_overflow_sessions.md) | 修复左栏宽度/头像卡片/更多会话入口，并跳转专门会话界面 |
| 114 | [Desktop 壳层比例严格对齐参考图](./114_desktop_shell_ratio_strict_parity_to_reference.md) | 严格修正左中右比例与左栏会话卡片样式，保持更多会话入口 |
| 115 | [Desktop 双侧栏可拖拽宽度与会话卡片弹性布局](./115_desktop_resizable_sidebars_and_flex_session_cards.md) | 左右侧栏默认 300px 且可拖拽，会话卡片改为 flex 布局 |
| 116 | [Desktop 中下固定输入区与工具栏增强](./116_desktop_composer_toolbar_and_context_panel.md) | 输入区固定中下部，补齐模型/联网/附件/图片/全控/上下文入口并联动右栏 |
| 117 | [Desktop 输入栏视觉对齐与实时上下文环组件](./117_desktop_composer_toolbar_visual_parity_and_live_context_ring.md) | 底栏无边框、模型数学图标、短竖线分隔、Context 圆角矩形+实时环形 |
| 118 | [Desktop 输入栏模型选择组件与工具栏视觉对齐](./118_desktop_composer_model_selector_and_toolbar_theme_alignment.md) | 去除 Context 数字、提升左侧 icon、模型选择改一体组件与主题弹层 |
| 119 | [Desktop 对话区 IM 化（头像 + 气泡）](./119_desktop_chat_avatar_bubble_im_style.md) | 中区消息改为左右分侧的头像气泡样式，贴近微信等 IM 体验 |
| 120 | [Desktop 对话气泡 Markdown 渲染](./120_desktop_chat_markdown_rendering.md) | 气泡支持 Markdown（标题/列表/代码块/链接/强调）并保持安全渲染 |
| 121 | [Desktop 对话公式渲染（KaTeX）](./121_desktop_chat_formula_rendering_with_katex.md) | 在 Markdown 气泡中支持 KaTeX 行内与块级公式渲染 |
| 122 | [Desktop 对话复制增强（代码块与公式）](./122_desktop_chat_copy_for_code_and_formula.md) | 代码块与块级公式支持一键复制并反馈结果 |
| 123 | [Desktop 代码块行号（不影响复制）](./123_desktop_codeblock_line_numbers_non_selectable.md) | 增加行号显示，行号不可选中且复制不包含行号 |
| 124 | [Desktop 会话头紧凑化与输入中状态](./124_desktop_chat_header_compact_and_typing_status.md) | 头部贴上显示 agent 名称与小字状态，输出中显示“对方正在输入中...” |
| 125 | [Desktop 左栏会话按 Agent 身份展示](./125_desktop_session_list_agent_identity_and_start_summary.md) | 左栏会话项显示 agent 名称、对应头像与对话开始摘要 |
| 126 | [Desktop Agent 真实头像与显示名接入](./126_desktop_agent_avatar_url_and_display_name.md) | 左栏优先显示 agent 头像 URL 与显示名，无头像回退字母头像 |
| 127 | [Desktop 侧栏拖拽双击复位与分割线去重](./127_desktop_sidebar_resizer_double_click_and_border_dedup.md) | 分割条双击恢复默认宽度，并去掉左右栏重复边框线 |
| 128 | [Desktop 流式反馈与 Agent 过程可视化](./128_desktop_streaming_feedback_and_agent_trace_surface.md) | 发送后即时反馈，run 期间增量刷新，并区分展示思考/工具/沙箱过程 |
| 129 | [Desktop 过程时间线卡片（可折叠）](./129_desktop_process_timeline_collapsible_cards.md) | tool/system 过程信息改为可折叠时间线卡片，降低阅读干扰 |
| 130 | [Desktop 过程时间线步骤序号与耗时标签](./130_desktop_process_timeline_step_index_and_elapsed.md) | 为 tool/system 卡片增加 Step 序号与相对耗时显示 |
| 131 | [对话气泡间距与流式渲染修复](./131_chat_bubble_spacing_and_streaming_render_fix.md) | 修复大空白气泡与间距异常，并增强回答逐步渲染反馈 |

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
- **`107` 已归档**（L3 cron 与 heartbeat 基础设施收口）：[`../completed/107_l3_cron_and_heartbeat_infra_hardening.md`](../completed/107_l3_cron_and_heartbeat_infra_hardening.md) — `create_task` 内置化、`/v1/system/status.heartbeat`、`pnpm verify`

