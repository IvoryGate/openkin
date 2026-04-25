# 021 Observability（可观测性：结构化系统日志、Trace 查询 API、Metrics 端点）

## 目标

为 Service 层补充三类可观测性能力：

1. **结构化 HTTP 系统日志**：每个请求自动记录 method / path / status / duration / traceId
2. **Trace 查询 API**：`GET /v1/runs/:traceId` 返回推理轨迹，`GET /v1/sessions/:id/traces` 返回会话的历史轨迹列表
3. **Metrics 端点**：`GET /metrics`（Prometheus text format），暴露 LLM 请求数、延迟、工具调用数等关键计数器

本计划依赖 018 持久化层（`agent_run_traces` 表）。
本计划产出的 Trace / Metrics 能力统一归入 **operator surface**，不进入 `packages/sdk/client`。

---

## 背景

### 当前可观测状态

| 能力 | 状态 |
|------|------|
| Agent 运行时日志（工具调用、LLM请求/响应） | ✓（`FileLogger` → `workspace/logs/` JSON Lines） |
| HTTP 请求/响应日志 | ✗（无 method/path/status/duration 记录） |
| Trace 查询 API | ✗（无 `GET /v1/runs/:traceId`） |
| Prometheus metrics | ✗ |
| 慢推理告警 | ✗ |

### 为什么三件事放一个计划

三件事都属于"可观测性"范畴，改动集中在 server 层，且共享同一批数据（traceId 串联）。
分开做会导致 traceId 体系被割裂为三个独立计划。

---

## 已冻结决策

### HTTP 系统日志

在 `createOpenKinHttpServer` 的 request handler 最外层包一个日志中间件，记录每个请求：

```
method=POST path=/v1/runs status=202 duration=12ms traceId=trace-xxx-abc
```

**日志格式：JSON Lines，写入 stderr**（与现有 `FileLogger` 分离；系统日志不写入 `workspace/logs/`，避免混入 Agent 运行日志）。

字段规范：
```typescript
interface HttpRequestLog {
  type: 'http_request'
  method: string
  path: string
  status: number
  durationMs: number
  traceId?: string      // 从响应体或 X-Trace-Id 响应头提取
  ts: number            // Unix ms
}
```

`X-Trace-Id` 响应头：对 `POST /v1/runs` 响应，在响应头中注入 `X-Trace-Id: <traceId>`，方便调用方无需解析 body 拿到 traceId。

### Trace 查询 API

**新增路由：**

```
GET /v1/runs/:traceId           获取单条推理轨迹（steps、status、duration）
GET /v1/sessions/:id/traces     获取会话的轨迹列表（不含完整 steps，只含摘要）
```

**TraceDto（完整）：**

```typescript
export interface TraceDto {
  traceId: string
  sessionId: string
  agentId: string
  status: RunFinalStatus
  steps: RunStepDto[]     // 简化版 RunStep，去除超大内嵌消息
  durationMs: number | null
  createdAt: number
}

export interface RunStepDto {
  stepIndex: number
  thought?: string         // LLM 的中间推理文本
  toolCalls?: ToolCallSummary[]
  toolResults?: ToolResultSummary[]
  finalAnswer?: string
}

export interface ToolCallSummary {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResultSummary {
  toolCallId: string
  name: string
  isError: boolean
  outputSummary: string    // 截断到 500 字符
}
```

**TraceSummaryDto（列表摘要，不含 steps）：**

```typescript
export interface TraceSummaryDto {
  traceId: string
  sessionId: string
  status: RunFinalStatus
  stepCount: number
  durationMs: number | null
  createdAt: number
}
```

**路由辅助（新增到 `shared/contracts`）：**

```typescript
export function apiPathRun(traceId: string): string {
  return `${API_V1_PREFIX}/runs/${encodeURIComponent(traceId)}`
}

export function apiPathSessionTraces(sessionId: string): string {
  return `${API_V1_PREFIX}/sessions/${encodeURIComponent(sessionId)}/traces`
}
```

**`GET /v1/sessions/:id/traces` 支持参数：**
- `limit`：默认 20，最大 100
- `before`：Unix ms，分页向前加载

**边界冻结：**
- `GET /v1/runs/:traceId` 与 `GET /v1/sessions/:id/traces` 都属于 operator surface
- 这两条路由不新增到 `packages/sdk/client`
- 如需 trusted/admin 侧调用，后续通过单独 surface 或直接 HTTP 使用，而不是扩张普通 client SDK

### Metrics 端点

```
GET /metrics
```

**鉴权策略：**
- 如果 `OPENKIN_API_KEY` 未设置：本地开发模式下允许直接访问
- 如果 `OPENKIN_API_KEY` 已设置：`GET /metrics` 必须校验同一 Bearer API Key

`/metrics` 属于 operator surface，不与 `/health` 共享无鉴权策略。

**首期暴露的指标（Prometheus text format）：**

```
# HELP openkin_llm_request_total LLM request count by provider
# TYPE openkin_llm_request_total counter
openkin_llm_request_total{provider="openai"} 42

# HELP openkin_llm_latency_ms_sum LLM request total latency (ms)
# TYPE openkin_llm_latency_ms_sum counter
openkin_llm_latency_ms_sum{provider="openai"} 18400

# HELP openkin_tool_call_total Tool call count by tool name
# TYPE openkin_tool_call_total counter
openkin_tool_call_total{tool="get_current_time"} 7
openkin_tool_call_total{tool="run_command"} 3

# HELP openkin_agent_run_total Agent run count by status
# TYPE openkin_agent_run_total counter
openkin_agent_run_total{status="completed"} 15
openkin_agent_run_total{status="failed"} 2
```

**实现方式：进程内计数器**，不引入 `prom-client` 等库，手写简单的计数器结构：

```typescript
interface MetricsStore {
  llmRequests: Map<string, number>      // key = provider
  llmLatencyMs: Map<string, number>     // key = provider, value = sum ms
  toolCalls: Map<string, number>        // key = tool name
  agentRuns: Map<RunFinalStatus, number>
}
```

Server 启动时初始化，Hook 写入，`GET /metrics` 序列化输出。**进程重启后计数器重置**（符合 Prometheus 计数器语义：counter 重置时 rate() 会自动处理）。

### 慢推理告警

在 `PersistenceHook`（018 引入）的 `onRunEnd` 中，如果 `durationMs > OPENKIN_SLOW_RUN_THRESHOLD_MS`（默认 30000），向 stderr 打印 WARN 日志：

```
[WARN] Slow run detected: traceId=xxx durationMs=45000ms (threshold=30000ms)
```

---

## 影响范围

| 层级 | 影响 |
|------|------|
| `packages/server/src/http-server.ts` | HTTP 日志中间件、`GET /v1/runs/:traceId`、`GET /v1/sessions/:id/traces`、`GET /metrics`、`X-Trace-Id` 响应头 |
| `packages/server/src/metrics.ts` | 新建：进程内计数器 + Prometheus 序列化 |
| `packages/server/src/observability-hook.ts` | 新建：LLM/Tool/Run Hook 写 metrics 计数器 + 慢推理告警 |
| `packages/shared/contracts/src/index.ts` | 新增 TraceDto、TraceSummaryDto、RunStepDto、路由辅助函数 |
| `scripts/test-observability.mjs` | 新增 smoke 脚本 |
| `package.json`（根） | 新增 `test:observability`，纳入 `verify` |

---

## 允许修改的目录

- `packages/server/src/http-server.ts`
- `packages/server/src/metrics.ts`（新建）
- `packages/server/src/observability-hook.ts`（新建）
- `packages/shared/contracts/src/index.ts`
- `scripts/`
- `docs/exec-plans/completed/`（本计划文档）
- `package.json`（根，仅 `scripts` 字段）

## 禁止修改的目录

- `packages/core/`（不得在 core 引入 metrics 依赖）
- `packages/server/src/logger.ts`（FileLogger 不改）
- `packages/server/src/db/`（只读 DB，不改 schema）
- `packages/channel-core/`
- `apps/dev-console/`
- 现有路由 DTO（不 breaking change）

---

## 本轮范围

1. **修改** `packages/server/src/http-server.ts`
   - request handler 最外层包 HTTP 日志中间件
   - `POST /v1/runs` 响应头注入 `X-Trace-Id`
   - 新增 `GET /v1/runs/:traceId`（从 DB 查询 `agent_run_traces`）
   - 新增 `GET /v1/sessions/:id/traces`（列表，不含完整 steps）
   - 新增 `GET /metrics`（按 020 的 API Key 规则保护 operator surface；本地无 key 时可直接访问）
   - `CreateOpenKinHttpServerOptions` 新增 `metrics?: MetricsStore`

2. **新建** `packages/server/src/metrics.ts`
   - `createMetricsStore(): MetricsStore`
   - `formatPrometheusText(store: MetricsStore): string`

3. **新建** `packages/server/src/observability-hook.ts`
   - 实现 `AgentLifecycleHook`
   - `onAfterLLMCall`：写 `llmRequests[provider]++`、`llmLatencyMs[provider] += durationMs`
   - `onAfterToolCall`：写 `toolCalls[toolName]++`
   - `onRunEnd` / `onRunError`：写 `agentRuns[status]++`，检查慢推理阈值

4. **修改** `packages/server/src/cli.ts`
   - 初始化 `MetricsStore`，注入到 server options 和 `ObservabilityHook`

5. **修改** `packages/shared/contracts/src/index.ts`
   - 新增 `TraceDto`、`TraceSummaryDto`、`RunStepDto`、`ToolCallSummary`、`ToolResultSummary`
   - 新增 `apiPathRun(traceId)`、`apiPathSessionTraces(sessionId)`

6. **新增** `scripts/test-observability.mjs`
   - 启动 server → 提交 run → 等待完成
   - 断言：`GET /v1/runs/:traceId` 返回 200，`steps` 不为空
   - 断言：`GET /v1/sessions/:id/traces` 包含该 run 的摘要
   - 断言：`GET /metrics` 返回 `openkin_agent_run_total{status="completed"}` 计数 ≥ 1
   - 断言：响应头 `X-Trace-Id` 在 `POST /v1/runs` 响应中存在

7. **更新** 根 `package.json`：`"test:observability": "node scripts/test-observability.mjs"` 纳入 `verify`

---

## 本轮不做

- 不引入 `prom-client` 等第三方 metrics 库（手写计数器足够首期）
- 不实现 histogram（P50/P95/P99）（只做 sum，方便计算 rate，histogram 需要 bucket 配置）
- 不实现日志集中到外部系统（ELK、Loki 等）
- 不实现 trace 的完整 LLM 消息内容查询（避免暴露敏感 prompt）
- 不实现 `GET /v1/runs` 列表（trace 必须通过 session 查询，不直接暴露全局 trace 列表）
- 不实现 OpenTelemetry 集成
- 不实现告警触发器（Alertmanager 等）
- 不把 trace / metrics 能力加入 `packages/sdk/client`

---

## 验收标准

1. `POST /v1/runs` 响应头包含 `X-Trace-Id`。
2. `GET /v1/runs/:traceId` 返回含 `steps` 的完整轨迹。
3. `GET /v1/sessions/:id/traces` 返回 session 的轨迹列表摘要。
4. `GET /metrics` 返回合法 Prometheus text format，包含 `openkin_agent_run_total`。
5. 慢推理触发时，stderr 输出含 `[WARN] Slow run detected` 日志。
6. smoke 脚本所有断言通过。
7. `pnpm verify` 通过。

---

## 必跑命令

1. `pnpm verify`
2. `pnpm test:observability`

---

## 升级条件

命中以下任一情况时，弱模型必须立即停止并升级：

- 需要在 `agent_run_traces` 的 `steps` 中存储完整 LLM 消息（有 PII 风险，需要先确定隐私策略）
- 需要引入 OpenTelemetry 或 Prometheus 客户端库
- `GET /metrics` 需要实现 histogram 或 summary（bucket 配置属于高阶决策）
- 需要把 trace 查询或 metrics 暴露为普通 client SDK 能力
- 连续两轮无法让 `pnpm verify` 与 `test:observability` 同时通过

---

## 依赖与顺序

- **前置**：[`018`](./018_persistence_layer.md)（`agent_run_traces` 表必须存在）
- **建议顺序**：018 → 020 → 021（019 可并行于 021）
- **后续**：[`022`](./022_agent_config_api.md) — Agent 配置 CRUD API（可独立进行）

---

## 决策记录

| 决策点 | 选择 | 原因 |
|--------|------|------|
| HTTP 日志写 stderr vs 文件 | stderr | 系统日志不应与 Agent 运行日志混合；stderr 可被日志采集器捕获 |
| Metrics 手写 vs prom-client | 手写 | 首期指标少（<10 个）；不引入 prom-client 降低依赖复杂度 |
| `GET /metrics` 是否公开无鉴权 | 否；仅在未设置 `OPENKIN_API_KEY` 的本地开发模式下可直接访问 | metrics 属于 operator surface；一旦启用 API Key，应与其他 operator 能力同等保护 |
| TraceDto 是否包含完整 LLM 消息 | 否（只含 thought/toolCalls/answer）| 完整 prompt 可能含 PII；隐私边界在功能设计阶段必须明确 |
| Trace 列表通过 session 查 | 是 | 全局 trace 列表可能泄漏其他 session 数据；session 是数据隔离边界 |
