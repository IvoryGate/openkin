# Layer 3 Design：Service & Protocol Layer 深化

## 一句话定位

第三层（018–024、026、027、046）在第一层核心运行时和第二层工具集成层的基础上，将 Service And Protocol Layer 从最小骨架演进为一个具备完整持久化、鉴权、可观测性和运行时管理能力的生产就绪服务层，为上层前端、管理工具、shared control plane 和 Channel Adapter 提供足够的基础设施 API。

---

## 层级关系

```
Layer 3 - Service & Protocol Layer 深化（本文档范围）
  ├── 018 SQLite 持久化层                → packages/server/src/db/
  ├── 019 Session/Message REST API       → packages/server/src/http-server.ts
  ├── 020 API Key 鉴权 + 健康检查       → packages/server/src/http-server.ts + cli.ts
  ├── 021 可观测性（日志/Trace/Metrics） → packages/server/src/observability-hook.ts
  ├── 022 Agent 配置 CRUD API            → packages/server/src/db/ + http-server.ts
  └── 023 定时任务系统                   → packages/server/src/scheduler.ts

Layer 2 - Tool & Integration Layer（已完成，017 关闭）
  ├── 013–016 内置工具 / MCP / Skill / 自我管理
  └── 017 Deno 沙箱

Layer 1 - Core Runtime（已完成，012 关闭）
  ├── ReActRunEngine
  ├── SimpleContextManager
  ├── OpenAiCompatibleChatProvider
  └── Session / History / Memory / Tool Runtime
```

---

## 设计目标

第三层要回答一个核心问题：

> **一旦 Agent 服务部署起来，上层应用和开发者如何管理它、观测它、调试它？**

具体目标：

1. **数据不丢失**：服务重启后，历史会话、消息、推理轨迹仍可查询
2. **可管理**：动态创建/更新/禁用 Agent，无需重启服务
3. **可鉴权**：生产环境中 API 调用需要认证
4. **可观测**：所有请求有日志，所有推理轨迹可查，关键指标可采集
5. **可调度**：支持定时自动化任务

---

## Surface 分层

第三层明确将所有 API 分为三类 surface：

| Surface | 面向对象 | 是否进入 `packages/sdk/client` |
|---------|---------|-------------------------------|
| **client surface** | 普通客户端（前端、Channel Adapter） | ✅ 是 |
| **operator surface** | 受信任的运维侧（管理工具、服务端应用） | ❌ 否 |
| **internal surface** | 进程内 / loopback only | ❌ 否 |

这个分层的核心价值：避免把观测、管理、用户调用混成同一套公开协议，防止管理能力意外暴露给普通客户端。

2026-04 的补充收口是：

- 第三层现在不仅是 REST API 层，也是 **event plane + trusted operator plane**
- `024` 已补齐 system status / logs / tools / skills / MCP status
- `026`、`027`、`046` 已补齐 task events、log stream、session run list
- 第三层首先服务第四层的 terminal-first 工程产品，其次才继续向第五层 external surfaces 与第六层 orchestration 提供共享底座
- 因此后续很多“感觉像服务层”的需求，其实应优先进入第四到第六层，而不是继续堆到第三层
- **Run identity / lifecycle（090）** 的专用说明见同目录 [L3_RUN_LIFECYCLE.md](./L3_RUN_LIFECYCLE.md)（`RunId`、`executionMode`、`streamAttachment`、attach/cancel 与终态边界）
- **统一事件平面（091）** 见 [L3_EVENT_PLANE.md](./L3_EVENT_PLANE.md)（`EventPlaneEnvelopeV1`、各域 `kind`、run 流与 task/log 的 wire 约定）
- **调度器可靠性与运行面观测（092）** 见 [L3_SCHEDULER_RELIABILITY.md](./L3_SCHEDULER_RELIABILITY.md)（tick/stale、`taskScheduler` 快照、`runSource`）
- **审批与危险操作协议（093）** 见 [L3_APPROVAL_DANGER.md](./L3_APPROVAL_DANGER.md)（`RiskClassDto`、`ApprovalRecordDto`、API + `approval` 平面事件）
- **Context / memory 描述符（094）** 见 [L3_CONTEXT_MEMORY_DESCRIPTORS.md](./L3_CONTEXT_MEMORY_DESCRIPTORS.md)（`ContextBuildReportDto`、`GET /v1/runs/:traceId/context`、`onPromptAssembled`）
- **多模态 contract（095）** 见 [L3_MULTIMODAL.md](./L3_MULTIMODAL.md)（`ImagePart` / `FileRefPart`、`RunInputDto.attachments`、v1 消息行、OpenAI 映射）
- **工具能力暴露与自检（096）** 见 [L3_TOOLING_EXPOSURE.md](./L3_TOOLING_EXPOSURE.md)（`ToolSurfaceCategoryDto`、`ToolEntryDto.riskClass` / `category`、`GET /v1/tools`、builtin 元数据）

---

## 六个执行计划（018–023）

### 018 · SQLite 持久化

**目标**：为所有上层 API 提供数据底座，server 重启后历史不丢失。

**关键决策**：

- 存储：SQLite + `better-sqlite3`（零额外进程，单文件，同步 API）
- DB 路径：`$THEWORLD_WORKSPACE_DIR/theworld.db`（与日志、Skill 同目录）
- 三张核心表：`sessions`、`messages`、`agent_run_traces`
- 迁移：手写 SQL 文件（`packages/server/src/db/migrations/`），server 启动时自动应用

**架构约束**：
- `packages/core/` 不引入任何 DB 依赖（强制 lint 检查）
- `InMemorySessionRegistry` 保持现有逻辑，DB 写入是额外副作用层

**数据模型**：

```sql
sessions (id, kind, agent_id, created_at)
messages (id, session_id, role, content, created_at)
agent_run_traces (trace_id, session_id, agent_id, status, steps, duration_ms, created_at)
```

**验证**：`pnpm test:persistence`（含服务重启后仍可查询 session）

---

### 019 · Session & Message API

**目标**：把 Session 和 Message 能力完整暴露为 REST API。

**新增路由**：

```
GET    /v1/sessions                     列出所有 session（limit/offset）
DELETE /v1/sessions/:id                 删除 session（CASCADE 删除关联消息和轨迹）
GET    /v1/sessions/:id/messages        消息历史（limit/before 时间游标）
```

**关键决策**：
- 分页用 `limit + before`（时间游标），适合聊天历史向上翻页
- GET 单条/列表均以 DB 为数据源（保证重启后一致）
- SDK 同步新增三个方法：`listSessions`、`getMessages`、`deleteSession`

**验证**：`pnpm test:session-message`

---

### 020 · Auth & Health Check

**目标**：补充运维就绪能力：鉴权、健康检查、优雅退出。

**鉴权机制**：
- `THEWORLD_API_KEY` 环境变量，未设置则不启用（开发友好）
- `GET /health` 和 `/_internal/*` 豁免（运维和内部接口不需要 key）
- 超过限制返回 `401 Unauthorized`

**健康检查**：

```json
GET /health →
{
  "ok": true,
  "version": "0.1.0",
  "db": "connected",    // connected | unavailable | not_configured
  "uptime": 12345,
  "ts": 1712345678901
}
```

**优雅退出**：`SIGTERM → server.close() → 等待 30s → db.close() → exit(0)`

**请求体限制**：默认 1MB（`THEWORLD_MAX_BODY_BYTES`），超过返回 413

**验证**：`pnpm test:auth-health`

---

### 021 · Observability

**目标**：三类可观测性能力——HTTP 请求日志、推理轨迹查询、Prometheus 指标。

**HTTP 系统日志**：
- 每请求记录到 stderr（与 Agent 运行日志分离）：`method=POST path=/v1/runs status=202 duration=12ms traceId=xxx`
- `POST /v1/runs` 响应头注入 `X-Trace-Id`，客户端无需解析 body

**Trace 查询 API**（operator surface）：

```
GET /v1/runs/:traceId            完整推理轨迹（含 steps、thought、toolCalls）
GET /v1/sessions/:id/traces      轨迹摘要列表（不含完整 steps，按时间分页）
```

**TraceDto 设计原则**：
- 不包含完整 LLM 消息内容（避免 PII 暴露）
- `thought` + `toolCalls` + `finalAnswer` 足够用于 debug
- `outputSummary` 截断到 500 字符

**Metrics 端点**：

```
GET /metrics → Prometheus text format
```

首期 4 类指标：`llm_request_total`、`llm_latency_ms_sum`、`tool_call_total`、`agent_run_total`

实现策略：手写进程内计数器（不引入 prom-client），重启后重置。

**慢推理告警**：`durationMs > THEWORLD_SLOW_RUN_THRESHOLD_MS`（默认 30s）写 stderr WARN

**验证**：`pnpm test:observability`

---

### 022 · Agent Config API

**目标**：允许运行时动态创建、查询、更新、禁用 Agent 定义，无需重启服务。

**数据模型**：

```sql
agents (id, name, description, system_prompt, model, enabled, is_builtin, created_at, updated_at)
```

首期只持久化 `name`/`systemPrompt`/`model`/`enabled`/`isBuiltin`，其他（Skills、MCP 绑定、LLM 参数）延后到第四层。

**路由**（operator surface）：

```
GET    /v1/agents                获取 Agent 列表
GET    /v1/agents/:id            获取单个 Agent 配置
POST   /v1/agents                创建 Agent
PUT    /v1/agents/:id            更新 Agent
DELETE /v1/agents/:id            删除（isBuiltin=true 返回 403）
POST   /v1/agents/:id/enable     启用
POST   /v1/agents/:id/disable    禁用
```

**向后兼容**：
- Server 启动时自动插入 `id="default"` 内置 Agent（如不存在）
- `POST /v1/runs` 新增可选 `agentId` 字段，不传则用 `"default"`
- 指定 `agentId` 属于 client surface（可进入 SDK），Agent CRUD 属于 operator surface

**验证**：`pnpm test:agent-config`

---

### 023 · Scheduled Task System

**目标**：允许用户和 Agent 创建周期性或单次定时执行的 Agent 任务。

**触发类型**：

| 类型 | 配置 | 示例 |
|------|------|------|
| `cron` | Cron 表达式（UTC） | `0 8 * * *` |
| `once` | Unix ms 时间戳 | `1712345678000` |
| `interval` | 间隔秒数 | `1800` |

**调度器**：进程内 10s tick，`SELECT` 到期任务后：
- 创建独立 Session（`kind='task'`）
- 异步驱动 Agent run
- 写入 `task_runs` 记录
- 更新 `next_run_at`

**并发与重试**：
- `THEWORLD_TASK_MAX_CONCURRENT`（默认 3）
- `THEWORLD_TASK_MAX_RETRIES`（默认 2），重试延迟 60s
- `once` 任务执行后自动设 `enabled=0`

**路由**：10 条（CRUD + enable/disable/trigger + runs 历史/详情），进入 client SDK

**验证**：`pnpm test:scheduler`

---

## 遗漏点：待 024 收口

018–023 完成后，开发期 debug 仍缺少以下能力：

### 024 · Debug & Introspection API（建议计划）

**1. 系统状态快照**

```
GET /v1/system/status
```

一次性展示运行中的 Session 数、活跃 Run 数、工具/MCP/Skill 加载情况、DB 状态、版本信息。这是前端 debug 控制台的核心入口。

**建议响应**：
```json
{
  "uptime": 12345,
  "activeSessions": 3,
  "activeRuns": 1,
  "tools": { "builtin": 8, "mcp": 5, "total": 13 },
  "skills": { "loaded": 4, "list": ["weather", "manage-mcp", "fibonacci-calculator", "create-file"] },
  "mcpProviders": [
    { "id": "filesystem", "status": "connected", "toolCount": 5 }
  ],
  "db": "connected",
  "version": "0.1.0"
}
```

**2. 日志查询 HTTP API**

```
GET /v1/logs?date=2026-04-05&level=ERROR&limit=100&before=<ts>
```

将 `workspace/logs/` 下的 JSON Lines 日志通过 HTTP 接口暴露，方便前端或管理工具展示，而不需要通过 Agent 工具调用来查日志。

**属于 operator surface**，受 API Key 保护。

**3. 工具/Skill 清单 API**

```
GET /v1/tools     列出所有已注册工具（含来源：builtin/mcp/skill）
GET /v1/skills    列出 workspace/skills/ 下所有 Skill（含元数据）
```

用于排查工具未加载、名称冲突等问题，也是管理 UI 展示工具面板的数据来源。

**4. Session 维度的 Run 列表**

```
GET /v1/sessions/:id/runs?status=running|completed|failed&limit=20
```

当前 Trace 查询需要 traceId，没有按 session 查 run 状态的入口。

注意：已有 `GET /v1/sessions/:id/traces` 返回轨迹摘要，但不能按 run status 过滤；两者可以合并或作为不同视角。

**5. MCP Provider 实时状态**

```
GET /_internal/mcp/status
```

返回所有已注册 MCP Provider 的连接状态（connected/disconnected/error）和当前工具数量。帮助排查 MCP server 连接失败的问题。

---

## 架构约束（第三层共享）

1. `packages/core/` 不引入任何 DB 依赖（每次 CI 中 lint 验证）
2. `packages/sdk/client` 只包装 client surface，不暴露 operator / internal 能力
3. Channel Adapter 只允许调用最小 run 链路，不依赖 operator 路由
4. 新增 endpoint 前必须声明其 surface 归属（client / operator / internal）
5. `agent_run_traces` 的 `steps` 不存储完整 LLM 消息（隐私边界）

---

## 依赖与顺序

```
018 (SQLite) ──→ 019 (Session/Message API)
     │
     └──→ 020 (Auth & Health) ──→ 021 (Observability) ──→ 022 (Agent Config) ──→ 023 (Scheduled Tasks)
```

018 是前置依赖，其余可适度并行。020 建议先于 021/022 完成（operator surface 应受鉴权保护）。

---

## 与其他层的交互边界

| 层 | 交互方式 | 约束 |
|----|---------|------|
| Core Runtime（L1） | 通过 `AgentLifecycleHook` 接收运行时事件 | core 不知道 DB 存在 |
| Tool & Integration（L2） | HTTP `/_internal/mcp/*` 管理 MCP provider | 只走 loopback |
| Client SDK（L5） | `packages/sdk/client` 包装 client surface 路由 | 不暴露 operator 能力 |
| Channel Adapter（L4） | 通过 client surface 发起 run | 不依赖 operator/internal 路由 |
| App & Orchestration（L6） | 通过 operator surface 管理 Agent 配置和任务 | 受 API Key 保护 |
