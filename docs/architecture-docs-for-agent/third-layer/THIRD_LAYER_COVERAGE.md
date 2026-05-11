# 第三层覆盖矩阵：Service & Protocol Layer 深化

## 层级定位

第三层（018–024、026、027、046）在第一层核心运行时和第二层工具集成层的基础上，将 Service And Protocol Layer 深化为一个可观测、可管理、可鉴权的生产就绪基础设施。

主要面向两类使用者：
- **开发者调试**：在开发和测试阶段通过 HTTP API 直接查询系统内部状态
- **受信任的运维入口**：上层服务端应用、管理工具或 CI 脚本通过 operator surface 管理 Agent

当前第三层的统一定位是：

- **public contract layer**：对外稳定暴露 session / run / task / trace / health 等服务能力
- **event plane**：提供 run stream、task events、log stream 等跨壳层可订阅事件
- **trusted operator plane**：为运维、调试、控制面提供受信任的管理与可观测入口

按当前修正后的层级口径，第三层首先服务的是：

- **L4 Engineering Product Shell**：terminal-first 本地工程产品
- **L5 External Surfaces And Channel Access**：Web / Desktop / SDK / channel 的外部入口

### L3 Run identity & lifecycle（090）

- **权威说明（人类可读）**：[L3_RUN_LIFECYCLE.md](../../architecture-docs-for-human/backend-plan/layer3-design/L3_RUN_LIFECYCLE.md)
- **Run id**：`RunId` 与 `traceId` 同形；事件与运营查询统一以该 id 标识一次 run。
- **声明式字段**（`CreateRunRequest` / 响应体 / `TraceDto` / `TraceSummaryDto`）：`executionMode`（`foreground` | `background`）、`streamAttachment`（`attached` | `detached`）——不改变 core 引擎，仅作 L4+ 与 control plane 的协议提示；默认 `foreground` + `attached`。
- **终态**以持久化表中的 `RunFinalStatus` 为准；**blocked / approval** 不在 090 占坑枚举，由 093 单独冻结。
- **最小操作语义**：流 attach = `GET /v1/runs/:traceId/stream`；interrupt = `POST /v1/runs/:traceId/cancel`；会话内续聊 = 新 `POST /v1/runs`（新 `traceId`）。详见上链文档。

### L3 Unified event plane（091）

- **权威说明**：[L3_EVENT_PLANE.md](../../architecture-docs-for-human/backend-plan/layer3-design/L3_EVENT_PLANE.md)
- **包络**：`EventPlaneEnvelopeV1`（`v: 1`，`domain` + `kind` + `ts` + `subject` + `payload`），SSE 典型写法见 `formatSseEventPlaneV1`（`packages/shared/contracts`）。
- **Run 流**（`GET /v1/runs/:traceId/stream`）仍为**既有** `StreamEvent` 行协议；统一视角用 `streamEventToPlaneEnvelope()` 在消费侧映射，避免破坏现有 `sdk/client` 解析。
- **Task 流**（`GET /v1/tasks/events`）：`data` 行为 plane JSON，`event:` 行 = `task`，`payload` 内为完整 `TaskRunEventDto`（与 webhook  body 同形数据，外包一层包络）；092 起 `TaskRunEventDto.runSource` 必填（见下节）。
- **日志流**（`GET /v1/logs/stream`）：默认仍为每行一 JSON 的 `data:`；`?v=1` 时每行以 `EventPlaneEnvelopeV1` 发出（`domain: log`）。
- **重连 / 回放（最小语义）**：平面事件可带 `seq`（可选）；不保证跨进程全序。详见上链文档。

### L3 Scheduler reliability and heartbeat（092）

- **权威说明**：[L3_SCHEDULER_RELIABILITY.md](../../architecture-docs-for-human/backend-plan/layer3-design/L3_SCHEDULER_RELIABILITY.md)
- **Tick**：`THEWORLD_TASK_TICK_MS`（默认 2000ms，500–60k clamp）；启动后**立即**首 tick，降低 once 等路径的首延迟脆弱性。
- **运行面可观测与 staleness**：`GET /v1/system/status` 返回可选 `taskScheduler`（`active`、`lastTickAt`、`stale` 等）；`stale` 为 3× tick 的启发式无心跳判定，见人类文档。
- **Heartbeat 视图**：`GET /v1/system/status` 返回 `heartbeat.schedulerLastBeatAt` 与 `heartbeat.taskSseLastBeatAt`，分别对应 scheduler tick 与 task SSE keepalive。
- **事件**：`TaskRunEventDto` 与 webhook 均含 `runSource`（`schedule` \| `trigger` \| `retry`），与调度/手动/重试路径对账。

### L3 Approval and danger（093）

- **权威说明**：[L3_APPROVAL_DANGER.md](../../architecture-docs-for-human/backend-plan/layer3-design/L3_APPROVAL_DANGER.md)
- **Contract**：`RiskClassDto`、`ApprovalStatusDto`、`ApprovalRecordDto`、`ApprovalEventDto`；与 `RunFinalStatus` 独立。
- **Operator API**：`GET /v1/approvals`（列表，较新在前）、`POST /v1/approvals`、`GET /v1/approvals/:id`、`POST .../approve|deny|cancel`、`GET /v1/approvals/events`（`domain: approval`）；**进程内**实现，不替代 L4+ 在工具链路上的拦截策略。
- **验收**：`pnpm test:approval`

### L3 Context and memory descriptors（094）

- **权威说明**：[L3_CONTEXT_MEMORY_DESCRIPTORS.md](../../architecture-docs-for-human/backend-plan/layer3-design/L3_CONTEXT_MEMORY_DESCRIPTORS.md)
- **Contract**：`ContextBlockDescriptorDto`、`ContextCompactDescriptorDto`、`MemoryContributionDescriptorDto`、`ContextBuildReportDto`；`CreateRunRequest` 可选 `maxPromptTokens`。
- **第一层**：`onPromptAssembled` + `SimpleContextManager.describePromptBuild`（不替换压缩/记忆算法，仅观察）。
- **Operator API**：`GET /v1/runs/:traceId/context`（进程内 `steps`）。
- **验收**：`pnpm test:context-descriptors`

### L3 Multimodal contract（095）

- **人类可读**：[L3_MULTIMODAL.md](../../architecture-docs-for-human/backend-plan/layer3-design/L3_MULTIMODAL.md)
- **Message**：`ImagePart` / `FileRefPart`（`packages/shared/contracts`）；core `RunOptions.userMessage` 承载整段用户 `Message`。
- **Run**：`RunInputDto.text` 可与 `RunInputDto.attachments` 组合；纯附件时 `text` 可为空字符串。
- **持久化**：单段纯文本行保持原样；多段或非纯文本使用 `theworld:msg:v1:` 前缀的 JSON（见上链文档）。
- **LLM（OpenAI 兼容）**：`image` → `image_url`；`file_ref` → 文本行降级。
- **验收**：`pnpm test:multimodal`

### L3 Tooling exposure and introspection（096）

- **人类可读**：[L3_TOOLING_EXPOSURE.md](../../architecture-docs-for-human/backend-plan/layer3-design/L3_TOOLING_EXPOSURE.md)
- **Contract**：`ToolSurfaceCategoryDto`；`ToolEntryDto` 扩展 `riskClass?`（`RiskClassDto`）、`category?`；由 core `ToolDefinition.metadata`（`surfaceCategory`、`riskClass`）经 `GET /v1/tools` 输出；MCP 工具默认 `category: mcp`。
- **验收**：`pnpm test:introspection`（内嵌 096 对 `run_command` / `write_file` 的元数据断言）

---

## 能力分层

### Client Surface（面向普通客户端 / SDK）

| 能力 | 路由 | 计划 | 状态 |
|------|------|------|------|
| 创建 Session | `POST /v1/sessions` | 004 | ✅ |
| 查询单个 Session | `GET /v1/sessions/:id` | 004/018 | ✅ |
| 列出所有 Session | `GET /v1/sessions` | 019 | ✅ |
| 删除 Session | `DELETE /v1/sessions/:id` | 019 | ✅ |
| 查询消息历史 | `GET /v1/sessions/:id/messages` | 019 | ✅ |
| 发起 Run | `POST /v1/runs` | 004/095 | ✅ |
| 订阅 Run 流 | `GET /v1/runs/:traceId/stream` | 004 | ✅ |
| 指定 agentId 发起 Run | `POST /v1/runs`（含 `agentId`） | 022 | ✅ |
| 健康检查 | `GET /health` | 020 | ✅ |
| 定时任务管理 | `POST/GET/PUT/DELETE /v1/tasks` | 023 | ✅ |
| 任务执行历史 | `GET /v1/tasks/:id/runs` | 023 | ✅ |

### Operator Surface（面向受信任的运维侧）

| 能力 | 路由 | 计划 | 状态 |
|------|------|------|------|
| Trace 完整查询 | `GET /v1/runs/:traceId` | 021 | ✅ |
| Session 轨迹列表 | `GET /v1/sessions/:id/traces` | 021 | ✅ |
| Prometheus Metrics | `GET /metrics` | 021 | ✅ |
| Agent CRUD | `GET/POST/PUT/DELETE /v1/agents` | 022 | ✅ |
| Agent 启用/禁用 | `POST /v1/agents/:id/enable|disable` | 022 | ✅ |
| 系统状态快照 | `GET /v1/system/status` | [024](../../exec-plans/completed/024_debug_and_introspection_api.md) | ✅ |
| 日志查询 API | `GET /v1/logs` | [024](../../exec-plans/completed/024_debug_and_introspection_api.md) | ✅ |
| 工具/Skill 清单 | `GET /v1/tools`、`GET /v1/skills` | [024](../../exec-plans/completed/024_debug_and_introspection_api.md) | ✅ |
| 服务端日志实时流 | `GET /v1/logs/stream` | [027](../../exec-plans/completed/027_server_log_sse.md) | ✅ |
| Task 事件 SSE | `GET /v1/tasks/events` | [026](../../exec-plans/completed/026_task_notifications.md) | ✅ |
| Session Run 列表 | `GET /v1/sessions/:id/runs` | [046](../../exec-plans/completed/046_session_runs_api.md) | ✅ |
| 审批与危险操作（协议 + 事件） | `POST/GET /v1/approvals`、`…/approve|deny|cancel`、`GET /v1/approvals/events` | [093](../../exec-plans/completed/093_l3_approval_and_danger_protocol.md) | ✅ |
| 上下文/记忆描述符 | `GET /v1/runs/:traceId/context` | [094](../../exec-plans/completed/094_l3_context_memory_descriptors.md) | ✅ |
| 多模态 run 输入与消息持久化 | `POST /v1/runs`（`RunInputDto.attachments`）、`theworld:msg:v1:` 行 | [095](../../exec-plans/completed/095_l3_multimodal_contract.md) | ✅ |
| 工具能力暴露与风险/类别元数据 | `GET /v1/tools`（`ToolEntryDto.riskClass` / `category`） | [096](../../exec-plans/completed/096_l3_tooling_exposure_and_introspection.md) | ✅ |

### Internal Surface（仅限 loopback / 进程内）

| 能力 | 路由 | 计划 | 状态 |
|------|------|------|------|
| MCP 注册 | `POST /_internal/mcp/register` | 014 | ✅ |
| MCP 注销 | `POST /_internal/mcp/unregister` | 014 | ✅ |
| MCP Provider 状态 | `GET /_internal/mcp/status` | [024](../../exec-plans/completed/024_debug_and_introspection_api.md) | ✅ |

---

## 已落地计划（018–024）

### 018 · SQLite 持久化（已完成）

- DB 路径：`$THEWORLD_WORKSPACE_DIR/theworld.db`
- 三张核心表：`sessions`、`messages`、`agent_run_traces`
- 手写迁移脚本（`packages/server/src/db/migrations/`）
- `PersistenceHook` 在 `onRunEnd` / `onRunError` 写入 Trace
- 验收：`pnpm test:persistence`

### 019 · Session & Message API（已完成）

- `GET /v1/sessions`：列表（`limit`/`offset`/`kind`/`agentId`/`before` 游标）；非法 `before` → 400
- `PATCH /v1/sessions/:id`：`displayName`（≤256，持久化 `sessions.display_name`；DTO / SDK / Web 统一用 `displayName`）
- `POST /v1/sessions/:id/messages`：追加 `user`/`assistant`/`system` 消息（051）；`/compact` 的结构化路径冻结为先写 `system` 消息，再发起普通 run
- `POST /v1/runs/:traceId/cancel`：中止进行中的 Run（052，`AbortSignal`）；命中已终态 run 返回 `{ cancelled: false, reason: 'already_finished' }`
- `DELETE /v1/sessions/:id`：CASCADE 删除关联消息和轨迹
- `GET /v1/sessions/:id/messages`：消息历史（limit/before 时间游标）
- SDK 同步新增 `listSessions`、`patchSession`、`createSessionMessage`、`cancelRun`、`getMessages`、`deleteSession`
- 验收：`pnpm test:session-message`

### 020 · Auth & Health（已完成）

- API Key 鉴权：`THEWORLD_API_KEY` 环境变量；`GET /health` 豁免
- `GET /health`：返回 `{ ok, version, db, uptime, ts }`
- 优雅退出：SIGTERM → 等待 30s → 关闭 DB → exit
- 请求体大小限制：默认 1MB（`THEWORLD_MAX_BODY_BYTES`）
- 验收：`pnpm test:auth-health`

### 021 · Observability（已完成）

- HTTP 系统日志：每请求写 stderr（method/path/status/duration/traceId）
- `POST /v1/runs` 响应头注入 `X-Trace-Id`
- `GET /v1/runs/:traceId`：完整推理轨迹（含 steps）
- `GET /v1/sessions/:id/traces`：轨迹列表摘要（无完整 steps）
- `GET /metrics`：Prometheus text format，手写计数器（LLM 请求/延迟、工具调用、Run 状态）
- 慢推理告警：`durationMs > THEWORLD_SLOW_RUN_THRESHOLD_MS`（默认 30s）
- 验收：`pnpm test:observability`

### 022 · Agent Config API（已完成）

- `agents` 表（SQLite）：持久化 Agent 定义（name/systemPrompt/model/enabled/isBuiltin）
- 7 条路由：CRUD + enable/disable
- `POST /v1/runs` 支持可选 `agentId`（不传默认走 `"default"` 内置 Agent）
- 内置 Agent（`isBuiltin=true`）不可删除（403）
- 验收：`pnpm test:agent-config`

### 023 · Scheduled Tasks（已完成）

- 两张表：`scheduled_tasks`、`task_runs`
- 三种触发类型：`cron`（UTC）、`once`（Unix ms）、`interval`（秒）
- 进程内 TaskScheduler（tick 周期 `THEWORLD_TASK_TICK_MS`，默认 2s；最大并发 `THEWORLD_TASK_MAX_CONCURRENT`，失败最多重试 `THEWORLD_TASK_MAX_RETRIES` 次）；092 起 tick/stale/`runSource` 语义以 [L3_SCHEDULER_RELIABILITY.md](../../architecture-docs-for-human/backend-plan/layer3-design/L3_SCHEDULER_RELIABILITY.md) 为准
- 10 条路由：CRUD + enable/disable/trigger + runs 列表/详情
- SDK 同步增加 Task 管理方法
- 验收：`pnpm test:scheduler`

---

### 024 · Debug & Introspection API（已完成）

- `GET /v1/system/status`：系统状态快照
- `GET /v1/logs`：历史日志查询
- `GET /v1/tools` + `GET /v1/skills`：工具与 Skill 清单
- `GET /_internal/mcp/status`：MCP provider 状态
- 验收：`pnpm test:introspection`

---

## 调试反馈补强（026–027）

### 026 · Task Run Notifications（后端链路已完成）

- `GET /v1/tasks/events`：Task 运行完成事件 SSE
- `WebhookNotifier` / `CompositeTaskNotifier`：通知扇出
- 当前说明：服务端通知 contract 已落地，Web Console 的 Toast / SSE 订阅展示仍可作为上层 UI 增量继续演进

### 027 · Server Log SSE（已完成）

- `GET /v1/logs/stream`：服务端日志实时 SSE
- `apps/web-console` 新增实时日志面板，直接消费 SSE

---

## 当前剩余缺口

第三层当前不再以“补齐 debug API”为主任务。它的主要未完项已经转移为后半层的上游依赖保留与少量 operator 增量。

### 1. 全局 Run 列表（跨 session）

**场景**：想看所有 `running` 状态的 Run（不限 session）。

**当前缺口**：046 已实现 session 维度的 run 列表；全局视角（`GET /v1/runs?status=running`）仍未落地。

**建议方向**：待真正有调试需求时再规划；当前 `GET /v1/sessions/:id/runs?status=running` 已能覆盖大部分诊断场景。

### 2. 更细粒度的调试/运维分层

024、026、027 已补齐开发期自检与事件回路，但后续如果继续扩展 operator surface，仍应保持：

- 调试接口优先服务开发期可观测性
- 不把 internal surface 直接上抬成默认公开能力
- Web Console 的上层体验改动，不反向放宽第三层 contract

### 3. 为第四到第六层保留上游边界

后续新增能力如果属于以下范围，应优先进入 L4/L5/L6 设计，而不是继续堆回第三层：

- terminal-first 单 agent 产品闭环
- channel account / pairing / presence / delivery control plane
- multi-surface continuity / remote control plane
- team / workflow / business app 产品流程
