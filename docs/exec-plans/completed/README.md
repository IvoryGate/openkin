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

### 第三层：Service And Protocol Layer（018–023）

- [`018_persistence_layer.md`](./018_persistence_layer.md) — SQLite：Session / Message / Trace 持久化，重启可恢复
- [`019_session_message_api.md`](./019_session_message_api.md) — Session 列表与分页、消息历史、删除会话
- [`020_auth_and_health.md`](./020_auth_and_health.md) — API Key 鉴权、`GET /health`、优雅退出、请求体大小限制
- [`021_observability.md`](./021_observability.md) — HTTP 结构化日志、Trace 查询、`GET /metrics`（Prometheus）
- [`022_agent_config_api.md`](./022_agent_config_api.md) — Agent 定义 CRUD（含内置 default Agent 种子）
- [`023_scheduled_tasks.md`](./023_scheduled_tasks.md) — 定时任务（Cron / Once / Interval）、TaskRun 与进程内调度器
