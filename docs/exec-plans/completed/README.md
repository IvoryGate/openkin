# Completed Exec Plans

本目录用于归档已经完成的执行计划。

归档目的：

- 保留决策上下文
- 让后续智能体知道哪些问题已经解决
- 避免重复讨论已经收口的内容

建议每次一个计划完成后：

1. 从 `active/` 移动到本目录
2. 保留验收结果
3. 标记后续遗留项

## 当前已归档

### 基础 harness（001–003）

- [`001_repo_harness_foundation.md`](./001_repo_harness_foundation.md)
- [`002_quality_gates_and_feedback_loops.md`](./002_quality_gates_and_feedback_loops.md)
- [`003_context_block_model_and_budget_policy.md`](./003_context_block_model_and_budget_policy.md)

### 跨层 contract（004–006）

- [`004_service_api_and_streaming_contract.md`](./004_service_api_and_streaming_contract.md) — Service 最小 REST+SSE 骨架
- [`005_client_sdk_v1_minimal.md`](./005_client_sdk_v1_minimal.md) — Client SDK v1
- [`006_channel_adapter_framework_contract.md`](./006_channel_adapter_framework_contract.md) — Channel framework + mock

### 第一层：Core Runtime Layer（007–012）

- [`007_memory_ports_and_history_boundaries.md`](./007_memory_ports_and_history_boundaries.md)
- [`008_openai_compatible_llm_provider.md`](./008_openai_compatible_llm_provider.md)
- [`009_first_layer_config_and_demo_runner.md`](./009_first_layer_config_and_demo_runner.md)
- [`010_first_layer_reliability_guards.md`](./010_first_layer_reliability_guards.md)
- [`011_first_layer_real_provider_feedback_loop.md`](./011_first_layer_real_provider_feedback_loop.md)
- [`012_first_layer_readiness_closure.md`](./012_first_layer_readiness_closure.md)

### 第二层：Tool And Integration Layer（013–017）

- [`013_tool_and_integration_layer_v1.md`](./013_tool_and_integration_layer_v1.md) — 内置工具（get_current_time / run_command / read_file / write_file / list_dir）
- [`014_mcp_tool_provider.md`](./014_mcp_tool_provider.md) — MCP stdio 接入 + listChanged 动态更新
- [`015_skill_framework.md`](./015_skill_framework.md) — Skill 框架（SKILL.md + list/read/run 三件套）
- [`016_agent_self_management.md`](./016_agent_self_management.md) — Agent 自我管理（write_skill / read_logs / manage-mcp）
- [`017_sandbox.md`](./017_sandbox.md) — Deno 沙箱（进程级权限隔离 + inline 模式）

### 第三层：Service And Protocol Layer（018–024）

- [`018_persistence_layer.md`](./018_persistence_layer.md) — SQLite：Session / Message / Trace 持久化，重启可恢复
- [`019_session_message_api.md`](./019_session_message_api.md) — Session 列表与分页、消息历史、删除会话
- [`020_auth_and_health.md`](./020_auth_and_health.md) — API Key 鉴权、`GET /health`、优雅退出、请求体大小限制
- [`021_observability.md`](./021_observability.md) — HTTP 结构化日志、Trace 查询、`GET /metrics`（Prometheus）
- [`022_agent_config_api.md`](./022_agent_config_api.md) — Agent 定义 CRUD（含内置 default Agent 种子）
- [`023_scheduled_tasks.md`](./023_scheduled_tasks.md) — 定时任务（Cron / Once / Interval）、TaskRun 与进程内调度器
- [`024_debug_and_introspection_api.md`](./024_debug_and_introspection_api.md) — 系统状态、日志查询、工具/Skill 清单、MCP 状态自检 API

### 开发控制台与反馈回路（025–027）

- [`025_web_console.md`](./025_web_console.md) — Web 调试控制台（状态、日志、工具、会话、Agent、任务视图）
- [`026_task_notifications.md`](./026_task_notifications.md) — Task 运行完成通知链路（后端 SSE / webhook 已完成，前端 UI 待补）
- [`027_server_log_sse.md`](./027_server_log_sse.md) — 服务端日志 SSE 实时流与 Web 实时日志面板

### CLI shell（028–037）

- [`028_project_cli_v1.md`](./028_project_cli_v1.md) — CLI v1 上位方向：shell-first、Server-first、与 Desktop 对标边界
- [`029_basic_cli_foundation.md`](./029_basic_cli_foundation.md) — 基础 CLI：统一入口、`chat` / `sessions list` / `inspect health` / help / smoke
- [`030_cli_delivery_sequence.md`](./030_cli_delivery_sequence.md) — 交付顺序（031–034 工作单编排说明）
- [`031_cli_session_workflows.md`](./031_cli_session_workflows.md) — `chat --session`、`sessions show|messages|delete`
- [`032_cli_operator_client_foundation.md`](./032_cli_operator_client_foundation.md) — 独立 `packages/sdk/operator-client`
- [`033_cli_tasks_and_inspect.md`](./033_cli_tasks_and_inspect.md) — `inspect status|logs|tools|skills`、`tasks` 子命令族
- [`034_cli_real_use_hardening.md`](./034_cli_real_use_hardening.md) — help/文档/配置说明/错误提示与 smoke 扩充
- [`035_cli_slash_commands.md`](./035_cli_slash_commands.md) — `chat` 内 `/help`、`/session`、`/inspect`、`/tasks`、`/exit` 等本地斜杠命令
- [`036_cli_terminal_ux.md`](./036_cli_terminal_ux.md) — 横幅/分隔线/阶段提示、`NO_COLOR` 兼容、工具与回复视觉区分
- [`037_theworld_surface_rename.md`](./037_theworld_surface_rename.md) — 用户可见名 TheWorld；`pnpm theworld`；CLI 表层与参数归一化

### Deep rename program（038–042）

- [`038_deep_rename_program.md`](./038_deep_rename_program.md) — rename 整体规划：策略文档、兼容期定义、分批工作单
- [`039_repo_rename_matrix_and_compat.md`](./039_repo_rename_matrix_and_compat.md) — 命名矩阵与兼容规则落地到文档层
- [`040_package_scope_and_import_migration.md`](./040_package_scope_and_import_migration.md) — `@openkin/*` → `@theworld/*` package scope 迁移
- [`041_env_docs_scripts_rename.md`](./041_env_docs_scripts_rename.md) — `OPENKIN_*` → `THEWORLD_*` 环境变量与文档/脚本切换
- [`042_high_risk_contract_and_path_rename.md`](./042_high_risk_contract_and_path_rename.md) — 高风险 contract/path/db rename 评估与决策（已采用保留中性命名策略）

### Deep rename compat（043–044）

- [`043_ts_symbol_alias_migration.md`](./043_ts_symbol_alias_migration.md) — `TheWorld*` TypeScript symbol 出口与历史符号兼容迁移
- [`044_skill_and_console_compat_cleanup.md`](./044_skill_and_console_compat_cleanup.md) — Skill 环境变量兼容、Web Console branding 与 localStorage 双读双写

### Final hard cut（045）

- [`045_observability_and_persistence_rename_strategy.md`](./045_observability_and_persistence_rename_strategy.md) — observability / persistence 最终 hard cut：`theworld.db`、`theworld_*` metrics、持久化键升级

### CLI 增强（046–048、054）

- [`046_session_runs_api.md`](./046_session_runs_api.md) — `GET /v1/sessions/:id/runs` operator surface，支持 `?status` 过滤与时间游标分页；smoke test 注册进 `verify`
- [`047_world_cli_alias.md`](./047_world_cli_alias.md) — `pnpm world` 短命令别名（`packages/cli/package.json` bin 双注册，根 `package.json` script 同步）
- [`048_cli_chat_enhancements.md`](./048_cli_chat_enhancements.md) — `chat -c/--continue`（继续最近会话）、`--resume <id>`（语义化别名）、初始提示直发、`/skills`/`/clear`/`/compact`/`/rename`/`/rewind` 五个新 slash 命令
- [`054_cli_chat_tty_interactive_ui.md`](./054_cli_chat_tty_interactive_ui.md) — TTY welcome/状态栏/readline 历史、slash Tab 补全、`chat-spinner` 与 `THEWORLD_CHAT_SPINNER`、可验证 resume 别名提示、help 环境变量说明（Phase G 已拆分到 056–058）

### CLI TUI 与 Shell Parity 轨（056–072）

主文书如下；`059` 及以后在目录内另有同名 `*_budget_work_order.md` 预算/承接副本文档。`THEWORLD_CLI_SHELL_PARITY_BUDGET_MODE_HANDOFF` 中标记 **superseded** 的 061–066 仍作为历史设计上下文保留在仓库。

- [`056_cli_chat_fullscreen_tui.md`](./056_cli_chat_fullscreen_tui.md) — CLI Chat 全屏 TUI（Ink）与 `streamRun` 对接
- [`057_cli_chat_tui_visual_identity.md`](./057_cli_chat_tui_visual_identity.md) — TUI 视觉身份与动效
- [`058_cli_chat_tui_lazyvim_dashboard.md`](./058_cli_chat_tui_lazyvim_dashboard.md) — LazyVim 风全屏仪表与状态栏
- [`059_cli_output_rails_and_help_contract.md`](./059_cli_output_rails_and_help_contract.md) — CLI 输出轨与 Help contract
- [`060_cli_session_identity_and_tty_attach.md`](./060_cli_session_identity_and_tty_attach.md) — Session identity 与 TTY attach
- [`061_cli_visual_tokens_foundation.md`](./061_cli_visual_tokens_foundation.md) — 语义 token 与视觉基础层
- [`062_cli_tui_information_architecture_refinement.md`](./062_cli_tui_information_architecture_refinement.md) — TUI 信息架构与展示密度
- [`063_tui_transcript_model_and_stream_reducer.md`](./063_tui_transcript_model_and_stream_reducer.md) — Transcript 模型与 stream reducer
- [`064_tui_shell_layout_and_status_architecture.md`](./064_tui_shell_layout_and_status_architecture.md) — Shell layout 与 session/status
- [`065_cli_tui_shared_visual_tokens.md`](./065_cli_tui_shared_visual_tokens.md) — Shared visual tokens 与 components
- [`066_tui_input_keyboard_polish_and_tty_matrix.md`](./066_tui_input_keyboard_polish_and_tty_matrix.md) — Input/keyboard 与窄终端 / TTY 矩阵
- [`067_cli_shell_home_and_information_architecture.md`](./067_cli_shell_home_and_information_architecture.md) — Shell home 与 information architecture
- [`068_cli_conversation_runtime_shell.md`](./068_cli_conversation_runtime_shell.md) — Conversation runtime shell
- [`069_cli_session_and_thread_ux.md`](./069_cli_session_and_thread_ux.md) — Session 与 thread UX
- [`070_cli_input_and_command_affordances.md`](./070_cli_input_and_command_affordances.md) — Input 与 command affordances
- [`071_cli_shell_design_system_and_degradation.md`](./071_cli_shell_design_system_and_degradation.md) — Design system 与 degradation
- [`072_cli_shell_validation_and_acceptance_harness.md`](./072_cli_shell_validation_and_acceptance_harness.md) — Shell validation 与 acceptance harness

### Desktop TUI 设计实施（073+）

- [`073_tui_desktop_spec_ingest_and_gap_matrix.md`](./073_tui_desktop_spec_ingest_and_gap_matrix.md) — 设计稿入仓与对账；gap 表（073 不承载代码）
- [`074_tui_splash_line_reveal_animation.md`](./074_tui_splash_line_reveal_animation.md) — Splash Phase 1：logo 逐行显现（`THEWORLD_TUI_SPLASH=0` 可跳过整段开屏）
- [`075_tui_splash_cta_breathe_and_exit.md`](./075_tui_splash_cta_breathe_and_exit.md) — Splash Phase 2/3：logo 呼吸、CTA 闪烁、任意键 / 3s 进入主 TUI
- [`076_feature_tui_yaml_minimal_loader.md`](./076_feature_tui_yaml_minimal_loader.md) — 项目根 `.theworld/tui.yaml`：`tui.theme`、`tui.display.show_sidebar`（`loadTuiFileConfig`）
- [`077_tui_responsive_breakpoints_sidebar.md`](./077_tui_responsive_breakpoints_sidebar.md) — ≥80 列侧栏、20 列宽、衔接 `tui.yaml` `show_sidebar`
- [`078_feature_tui_session_list_data_adapter.md`](./078_feature_tui_session_list_data_adapter.md) — `fetchTuiSessionList` + `TuiSessionRow`（无 UI）
- [`079_tui_session_list_fullscreen_overlay.md`](./079_tui_session_list_fullscreen_overlay.md) — 全屏列表、`Ctrl+L`、j/k/Enter、Esc/q/再 Ctrl+L

### Service / Web / 会话（049–053、055）

- [`049_sessions_list_query_enhancement.md`](./049_sessions_list_query_enhancement.md) — Sessions 列表 `agentId` / `before` 等查询增强
- [`050_session_display_name_api.md`](./050_session_display_name_api.md) — Session 展示名与 `PATCH` 等 API
- [`051_compact_system_message_semantics.md`](./051_compact_system_message_semantics.md) — `/compact` 与 System 消息语义、`POST …/messages`、`importSessionHistory`
- [`052_run_cancel_api.md`](./052_run_cancel_api.md) — `POST /v1/runs/:traceId/cancel`
- [`053_web_console_session_runs_ui.md`](./053_web_console_session_runs_ui.md) — Web Console 会话 Runs / 展示名等 UI
- [`055_session_rehydrate_on_run.md`](./055_session_rehydrate_on_run.md) — 重启后续跑：`POST /v1/runs` 在 DB 有会话时向 agent 再挂载
