# Active Exec Plans

本目录用于存放当前进行中的执行计划。

## 当前队列

### 第三层：Service And Protocol Layer 深化（018–023）

> 第二层（013–017）已全部收口，见 [`../completed/README.md`](../completed/README.md)。
> 第三层在 004（最小 REST+SSE 骨架）基础上，补全持久化、鉴权、可观测性、Agent 配置管理、定时任务等工程能力。

| 编号 | 计划 | 状态 | 前置 |
|---|---|---|---|
| [`018`](./018_persistence_layer.md) | Persistence Layer（SQLite + Session/Message/Trace 存储） | ⏳ 待开始 | `017` |
| [`019`](./019_session_message_api.md) | Session & Message API（列表、消息历史、删除） | ⏳ 待开始 | `018` |
| [`020`](./020_auth_and_health.md) | Auth & Health Check（API Key 鉴权、健康检查、优雅退出） | ⏳ 待开始 | `017`（可与 018 并行） |
| [`021`](./021_observability.md) | Observability（HTTP 系统日志、Trace 查询 API、Metrics 端点） | ⏳ 待开始 | `018` |
| [`022`](./022_agent_config_api.md) | Agent Config API（Agent 定义 CRUD） | ⏳ 待开始 | `018` + `020` |
| [`023`](./023_scheduled_tasks.md) | Scheduled Task System（定时任务，高阶可选） | ⏳ 待开始 | `019` + `022` |

**推荐执行顺序：** 018 → 020（可并行）→ 019 → 021 → 022 → 023

**并行允许说明（high-capability 决策）：**
- `018`（持久化）和 `020`（鉴权/健康检查）可并行，因为两者改动范围不重叠（018 改 `db/`，020 改 server 中间件层）
- `019`、`021`、`022` 均依赖 `018`，不可与 `018` 并行
- `023` 是高阶能力，可在 019+022 稳定后独立推进，弱模型不应自行启动

新增计划时，将新文件放在本目录并在此 README 中登记队列与依赖。

### 历史：第一层完成路径（已收口）

已完成：[`007`](../completed/007_memory_ports_and_history_boundaries.md)–[`012`](../completed/012_first_layer_readiness_closure.md)（含 provider、demo、可靠性 guard、真实 provider 验收与本收口计划）。

### 历史：跨层 contract 路径（已收口）

跨层计划 **004–006** 已收口（见 [`../completed/README.md`](../completed/README.md)）。

已完成：[`004`](../completed/004_service_api_and_streaming_contract.md)（Service 最小骨架）、[`005`](../completed/005_client_sdk_v1_minimal.md)（Client SDK）、[`006`](../completed/006_channel_adapter_framework_contract.md)（Channel framework + mock）。

### 历史：第二层完成路径（已收口）

已完成：[`013`](../completed/013_tool_and_integration_layer_v1.md)（内置工具）、[`014`](../completed/014_mcp_tool_provider.md)（MCP）、[`015`](../completed/015_skill_framework.md)（Skill）、[`016`](../completed/016_agent_self_management.md)（自我管理）、[`017`](../completed/017_sandbox.md)（Deno 沙箱）。

如果要打破默认顺序，必须先由 high-capability mode 明确说明为什么可以并行，以及额外的冲突控制方式。

已完成计划见 [`../completed/README.md`](../completed/README.md)。

---

每份计划建议只解决一个清晰增量，例如：

- monorepo 骨架
- shared contracts
- core runtime 最小闭环
- service streaming contract
- client SDK v1
- channel framework

每份计划建议包含：

1. 目标
2. 修改范围（含跨层影响与不做什么）
3. 验收标准
4. 决策记录
5. 允许修改目录 / 禁止修改目录
6. 必跑命令
7. 升级条件
