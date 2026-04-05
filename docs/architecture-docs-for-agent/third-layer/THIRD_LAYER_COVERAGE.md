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
| 系统状态快照 | `GET /v1/system/status` | 024 | ⬜ 待规划 |
| 日志查询 API | `GET /v1/logs` | 024 | ⬜ 待规划 |
| 工具/Skill 清单 | `GET /v1/tools`、`GET /v1/skills` | 024 | ⬜ 待规划 |
| MCP Provider 状态 | `GET /_internal/mcp/status` | 024 | ⬜ 待规划 |
| 活跃 Run 列表 | `GET /v1/runs?status=running` | 024 | ⬜ 待规划 |

### Internal Surface（仅限 loopback / 进程内）

| 能力 | 路由 | 计划 | 状态 |
|------|------|------|------|
| MCP 注册 | `POST /_internal/mcp/register` | 014 | ✅ |
| MCP 注销 | `POST /_internal/mcp/unregister` | 014 | ✅ |
| MCP Provider 状态 | `GET /_internal/mcp/status` | 024 | ⬜ 待规划 |

---

## 已落地计划（018–023）

### 018 · SQLite 持久化（已完成）

- DB 路径：`$OPENKIN_WORKSPACE_DIR/openkin.db`
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

- API Key 鉴权：`OPENKIN_API_KEY` 环境变量；`GET /health` 豁免
- `GET /health`：返回 `{ ok, version, db, uptime, ts }`
- 优雅退出：SIGTERM → 等待 30s → 关闭 DB → exit
- 请求体大小限制：默认 1MB（`OPENKIN_MAX_BODY_BYTES`）
- 验收：`pnpm test:auth-health`

### 021 · Observability（已完成）

- HTTP 系统日志：每请求写 stderr（method/path/status/duration/traceId）
- `POST /v1/runs` 响应头注入 `X-Trace-Id`
- `GET /v1/runs/:traceId`：完整推理轨迹（含 steps）
- `GET /v1/sessions/:id/traces`：轨迹列表摘要（无完整 steps）
- `GET /metrics`：Prometheus text format，手写计数器（LLM 请求/延迟、工具调用、Run 状态）
- 慢推理告警：`durationMs > OPENKIN_SLOW_RUN_THRESHOLD_MS`（默认 30s）
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
- 进程内 TaskScheduler（10s tick，最大并发 `OPENKIN_TASK_MAX_CONCURRENT`，失败最多重试 `OPENKIN_TASK_MAX_RETRIES` 次）
- 10 条路由：CRUD + enable/disable/trigger + runs 列表/详情
- SDK 同步增加 Task 管理方法
- 验收：`pnpm test:scheduler`

---

## 遗漏点分析（待 024 收口）

第三层 018–023 覆盖了核心的持久化、Session API、鉴权、可观测性、Agent 配置和定时任务。但在**调试时期**，以下能力仍然缺失：

### 1. 系统状态快照

**场景**：开发调试时想一次看到系统整体状态（运行中有几个 Session、几个活跃 Run、工具/MCP/Skill 加载情况）。

**缺口**：没有 `GET /v1/system/status` 端点。当前只能分别查询 sessions、metrics，且工具/Skill 状态完全无 API。

**建议字段**：
```json
{
  "uptime": 12345,
  "activeSessions": 3,
  "activeRuns": 1,
  "tools": { "builtin": 8, "mcp": 5, "total": 13 },
  "skills": { "loaded": 4, "list": ["weather", "manage-mcp", ...] },
  "mcpProviders": [
    { "id": "filesystem", "status": "connected", "toolCount": 5 }
  ],
  "db": "connected",
  "version": "0.1.0"
}
```

### 2. 日志查询 HTTP API

**场景**：通过 HTTP 接口查询 `workspace/logs/` 中的运行日志，方便前端或管理工具展示。

**缺口**：日志目前只能通过 Agent 内置 `read_logs` 工具访问（LLM 调用），没有 HTTP 接口。

**建议路由**：
```
GET /v1/logs?date=2026-04-05&level=ERROR&limit=100&before=<ts>
```

### 3. 工具/Skill 清单 API

**场景**：调试时想知道当前 Agent 可用哪些工具（内置/MCP/Skill），方便排查工具未加载、名称冲突等问题。

**缺口**：无 `GET /v1/tools` 和 `GET /v1/skills` 端点。

**建议路由**：
```
GET /v1/tools        列出当前所有已注册工具（含来源：builtin/mcp/skill）
GET /v1/skills       列出 workspace/skills/ 下所有 Skill（含元数据）
```

### 4. 活跃 Run 查询

**场景**：Server 卡住时，想知道当前有没有 Run 卡在 `running` 状态。

**缺口**：`GET /v1/runs` 只能按 traceId 查单条，没有列表接口或状态过滤。

**建议路由**：
```
GET /v1/sessions/:id/runs?status=running|completed|failed
```
（通过 session 维度查，避免全局暴露）

### 5. MCP Provider 实时状态

**场景**：MCP server 连接断开、工具刷新失败时，想通过 API 查看各 MCP Provider 的连接状态和工具数量。

**缺口**：`/_internal/mcp/` 只有注册/注销，无状态查询。

**建议路由**：
```
GET /_internal/mcp/status    返回所有 MCP Provider 的连接状态和工具数量
```

---

## 下一步规划

第三层 018–023 已覆盖核心基础设施。剩余遗漏点建议合并为一个 `024_debug_and_introspection_api` 计划，统一落地以下能力：

1. `GET /v1/system/status`（系统状态快照）
2. `GET /v1/logs`（日志查询 HTTP API）
3. `GET /v1/tools` + `GET /v1/skills`（工具/Skill 清单）
4. `GET /v1/sessions/:id/runs`（Run 状态列表）
5. `GET /_internal/mcp/status`（MCP Provider 状态）

这五项能力共同构成**开发期 debug 控制台**的后端 API 基础，也是后续管理 UI 的数据来源。
