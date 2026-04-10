# 第三层覆盖矩阵：Service & Protocol Layer 深化

## 层级定位

第三层（018–023+）在第一层核心运行时和第二层工具集成层的基础上，将 Service And Protocol Layer 深化为一个可观测、可管理、可鉴权的生产就绪基础设施。

主要面向两类使用者：
- **开发者调试**：在开发和测试阶段通过 HTTP API 直接查询系统内部状态
- **受信任的运维入口**：上层服务端应用、管理工具或 CI 脚本通过 operator surface 管理 Agent

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
| 发起 Run | `POST /v1/runs` | 004 | ✅ |
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
| 活跃 Run 列表 | `GET /v1/runs?status=running` | 待定 | ⬜ 待规划 |

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

- `GET /v1/sessions`：列表（limit/offset）
- `DELETE /v1/sessions/:id`：CASCADE 删除关联消息和轨迹
- `GET /v1/sessions/:id/messages`：消息历史（limit/before 时间游标）
- SDK 同步新增 `listSessions`、`getMessages`、`deleteSession`
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
- 进程内 TaskScheduler（10s tick，最大并发 `THEWORLD_TASK_MAX_CONCURRENT`，失败最多重试 `THEWORLD_TASK_MAX_RETRIES` 次）
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

### 1. 活跃 Run 列表

**场景**：Server 卡住时，想知道当前有没有 Run 卡在 `running` 状态。

**当前缺口**：尚无 `GET /v1/runs?status=running` 或按 session 过滤的 run 列表接口。

**建议方向**：

```text
GET /v1/sessions/:id/runs?status=running|completed|failed
```

优先通过 session 维度暴露，避免过早扩大全局查询面。

### 2. 更细粒度的调试/运维分层

024、026、027 已补齐开发期自检与事件回路，但后续如果继续扩展 operator surface，仍应保持：

- 调试接口优先服务开发期可观测性
- 不把 internal surface 直接上抬成默认公开能力
- Web Console 的上层体验改动，不反向放宽第三层 contract
