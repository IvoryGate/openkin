# 024 Debug & Introspection API（系统自检与调试接口）

## 目标

为开发期 debug 补全五类自检接口，使开发者在系统运行时无需查文件、调 Agent 工具即可通过 HTTP 直接观察系统内部状态：

1. **系统状态快照**：`GET /v1/system/status` — 一次 HTTP 请求看清活跃会话数、工具加载情况、MCP 连接状态、版本信息
2. **日志查询 API**：`GET /v1/logs` — 通过 HTTP 查询 `workspace/logs/` 中的结构化运行日志
3. **工具清单**：`GET /v1/tools` — 列出当前所有已注册工具（含来源 builtin/mcp/skill）
4. **Skill 清单**：`GET /v1/skills` — 列出 workspace/skills/ 下所有已加载 Skill 及元数据
5. **MCP Provider 状态**：`GET /_internal/mcp/status` — 各 MCP Provider 的连接状态与工具数量

以上五项能力共同构成 **`apps/web-console`（Web 调试控制台）** 的后端数据来源，也是后续管理 UI 的基础。

本计划依赖 018（持久化）、020（鉴权）、021（可观测性）。

---

## 背景

### 当前调试体验缺口

| 调试场景 | 当前方式 | 缺口 |
|---------|---------|------|
| 查看当前加载了哪些工具 | 看 Server 启动日志 | 没有 API，重启后无法实时查询 |
| 查看 MCP server 连接是否正常 | 看 `workspace/mcp-registry.json` + Server 日志 | 没有连接状态 API |
| 查看 Skill 列表和加载状态 | Agent 调用 `list_skills` 工具（需要走 LLM） | 没有直接 HTTP 接口 |
| 在 web 界面查看运行日志 | 只能通过 `read_logs` 工具（需要走 LLM） | 没有日志查询 HTTP API |
| 一次性看系统整体健康状态 | 分别查 `/health`、`/metrics`、数据库 | 需要多次请求，信息分散 |

### 与 `/health` 和 `/metrics` 的关系

- `/health`：面向运维 liveness probe，关注"服务是否可达"
- `/metrics`：面向 Prometheus scraper，暴露计数器数据
- `/v1/system/status`（本计划）：面向开发者调试，关注"系统现在加载了什么、跑了什么"

三者互补，不重叠。

---

## 已冻结决策

### 1. `GET /v1/system/status`

**Surface**：operator（受 API Key 保护；未设置 key 时本地开发可直接访问）

**响应格式**：

```typescript
export interface SystemStatusResponseBody {
  version: string                     // package.json version
  uptime: number                      // 进程已运行秒数
  db: 'connected' | 'unavailable' | 'not_configured'
  activeSessions: number              // InMemorySessionRegistry 当前缓存的 session 数
  tools: {
    builtin: number
    mcp: number
    total: number
  }
  skills: {
    loaded: number
    list: string[]                    // skill id 数组
  }
  mcpProviders: McpProviderStatusDto[]
  ts: number                          // Unix ms
}

export interface McpProviderStatusDto {
  id: string
  status: 'connected' | 'disconnected' | 'error'
  toolCount: number
  error?: string                      // 最近一次错误信息（截断到 200 字符）
}
```

**数据来源**：
- `activeSessions`：从 `InMemorySessionRegistry` 的内存缓存读取（不走 DB，体现运行时热状态）
- `tools`：从 `InMemoryToolRuntime.getRuntimeView()` 聚合，按 provider 类型分类统计
- `skills`：通过 `list_skills` 扫描逻辑（读 `workspace/skills/` 目录），不走 LLM
- `mcpProviders`：从 `InMemoryToolRuntime` 中的 MCP provider 列表读取连接状态

**实现约定**：`CreateOpenKinHttpServerOptions` 新增 `toolRuntime?: InMemoryToolRuntime`，由 `cli.ts` 在启动时注入，路由 handler 通过闭包访问。

---

### 2. `GET /v1/logs`

**Surface**：operator（受 API Key 保护）

**查询参数**：

```typescript
export interface ListLogsRequest {
  date?: string        // 格式 YYYY-MM-DD，默认今天（UTC+8）
  level?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'  // 不传则返回所有级别
  limit?: number       // 默认 100，最大 500
  before?: number      // Unix ms，时间游标（同 messages API 的分页模式）
  search?: string      // 可选关键词过滤（对 message 字段做 substring 匹配，不做正则）
}

export interface ListLogsResponseBody {
  logs: LogEntryDto[]
  hasMore: boolean
}

export interface LogEntryDto {
  type: string         // 日志事件类型（如 'tool_call' / 'tool_result' / 'llm_request'）
  level?: string
  ts: number           // Unix ms
  sessionId?: string
  traceId?: string
  message?: string     // 截断到 500 字符
  // 保留其余字段但不在 DTO 中强类型化，以 Record<string, unknown> 扩展
  [key: string]: unknown
}
```

**实现策略**：
- 读取 `$OPENKIN_WORKSPACE_DIR/logs/agent-YYYY-MM-DD.log`（JSON Lines 格式）
- 按行解析，应用 `level` / `before` / `search` 过滤，`limit` 截断
- **不建内存索引**，每次请求直接读文件（首期日志量不大，可接受）
- 文件不存在时返回空数组（不报 404）

**安全边界**：路径严格限制在 `workspace/logs/` 内，不允许 `..` 穿越。

---

### 3. `GET /v1/tools`

**Surface**：operator（受 API Key 保护）

**响应格式**：

```typescript
export interface ListToolsResponseBody {
  tools: ToolEntryDto[]
}

export interface ToolEntryDto {
  name: string
  description: string
  source: 'builtin' | 'mcp' | 'skill' | 'custom'
  providerId?: string      // MCP provider id（source='mcp' 时存在）
  parameters?: Record<string, unknown>   // JSON Schema（简化，不强类型）
}
```

**数据来源**：`InMemoryToolRuntime.getRuntimeView()` 返回的工具列表，读 `source` 字段和 schema。

**实现约定**：工具 `source` 来自 `ToolDefinition` 上已有的 provider 类型字段（如果不存在需要在 `ToolRuntime` 侧补充标注）。首期如果 `source` 难以区分，统一返回 `builtin`，不阻断计划推进。

---

### 4. `GET /v1/skills`

**Surface**：operator（受 API Key 保护）

**响应格式**：

```typescript
export interface ListSkillsApiResponseBody {
  skills: SkillEntryDto[]
}

export interface SkillEntryDto {
  id: string                 // skill 目录名
  title: string              // SKILL.md 中的 h1 标题（首行）
  description: string        // SKILL.md 中第一段描述（截断到 200 字符）
  hasScript: boolean         // skill 目录中是否有可执行脚本
}
```

**数据来源**：扫描 `workspace/skills/` 目录，读取每个 `SKILL.md` 的前几行，与 `list_skills` 内置工具复用同一扫描逻辑（提取为共享函数）。

**不需要**：走 LLM、动态执行脚本。

---

### 5. `GET /_internal/mcp/status`

**Surface**：internal（loopback only，与现有 `/_internal/mcp/*` 同等约束）

**响应格式**：

```typescript
export interface McpStatusResponseBody {
  providers: McpProviderStatusDto[]   // 复用 McpProviderStatusDto（见 system/status）
}
```

**数据来源**：`InMemoryToolRuntime` 中已注册的 MCP provider 列表，读取其 `connected` 状态。

---

## 关于 `apps/web-console`

本计划后端 API 完成后，上层前端将作为独立应用落在 `apps/web-console/`，与现有 `apps/dev-console/` 并列：

```text
apps/
  dev-console/   ← Node CLI 调试工具（已有）
  web-console/   ← Web 调试控制台（本计划解锁，后续另开 025 计划实现）
    package.json
    index.html
    src/
      main.ts     ← 入口
      views/
        StatusView.vue  ← 系统状态快照
        LogsView.vue    ← 日志查询
        ToolsView.vue   ← 工具/Skill 清单
        AgentsView.vue  ← Agent 配置管理
        SessionsView.vue← Session/Trace 查询
```

**技术选型建议**（留给 025 计划决策）：
- 纯静态 SPA（Vite + Vue 3 或 Vite + React），无需 SSR
- 直接调用 `packages/sdk/client` 和 operator surface HTTP API
- 不引入额外 BFF，本地开发直连 `packages/server`（同源 `http://127.0.0.1:3333`）
- `pnpm dev:web-console` 启动开发服，`pnpm build:web-console` 产出静态文件

web-console 属于**开发期工具**，不是产品侧的用户界面，因此：
- 不要求生产级别的权限管控（API Key 足够）
- 不要求移动端适配
- 不要求国际化

---

## 影响范围

| 层级 | 影响 |
|------|------|
| `packages/server/src/http-server.ts` | 新增 5 条路由 handler；`CreateOpenKinHttpServerOptions` 新增 `toolRuntime?` |
| `packages/server/src/cli.ts` | 把 `toolRuntime` 注入到 server options |
| `packages/shared/contracts/src/index.ts` | 新增 5 类 DTO + 路由辅助函数 |
| `packages/core/src/tool-runtime.ts` | 可能需要暴露 provider 类型信息（`source` 字段）；如不影响接口则改 impl |
| `scripts/test-introspection.mjs` | 新增 smoke 脚本 |
| `package.json`（根） | 新增 `test:introspection`，纳入 `verify` |
| `docs/architecture-docs-for-agent/third-layer/THIRD_LAYER_COVERAGE.md` | 更新 024 状态 |

---

## 允许修改的目录

- `packages/server/src/http-server.ts`
- `packages/server/src/cli.ts`
- `packages/shared/contracts/src/index.ts`
- `packages/core/src/tool-runtime.ts`（只允许增加只读状态查询，不改现有接口）
- `scripts/`
- `docs/architecture-docs-for-agent/third-layer/THIRD_LAYER_COVERAGE.md`
- `docs/exec-plans/active/`（本计划文档）
- `package.json`（根，仅 `scripts` 字段）

## 禁止修改的目录

- `packages/core/src/run-engine.ts`（不改执行引擎）
- `packages/core/src/types.ts`（不改核心类型）
- `packages/server/src/db/`（不改 schema，024 不新增数据库表）
- `packages/channel-core/`
- `apps/dev-console/`
- 现有路由和 DTO（不 breaking change 任何 018–023 已冻结的接口）

---

## 本轮范围

1. **修改** `packages/shared/contracts/src/index.ts`
   - 新增 `SystemStatusResponseBody`、`McpProviderStatusDto`
   - 新增 `ListLogsRequest`、`ListLogsResponseBody`、`LogEntryDto`
   - 新增 `ListToolsResponseBody`、`ToolEntryDto`
   - 新增 `ListSkillsApiResponseBody`、`SkillEntryDto`
   - 新增 `McpStatusResponseBody`
   - 新增路由辅助：`apiPathSystemStatus()`、`apiPathLogs()`、`apiPathTools()`、`apiPathSkills()`

2. **修改** `packages/server/src/http-server.ts`
   - `CreateOpenKinHttpServerOptions` 增加 `toolRuntime?: InMemoryToolRuntime`
   - 新增 `GET /v1/system/status` handler
   - 新增 `GET /v1/logs` handler（读文件 → 解析 JSON Lines → 过滤 → 截断）
   - 新增 `GET /v1/tools` handler（从 toolRuntime 读工具列表）
   - 新增 `GET /v1/skills` handler（扫描 skills 目录）
   - 新增 `GET /_internal/mcp/status` handler（读 MCP provider 状态）

3. **修改** `packages/server/src/cli.ts`
   - 把 `toolRuntime` 注入到 `createOpenKinHttpServer()` options

4. **新增** `scripts/test-introspection.mjs`
   - 断言：`GET /v1/system/status` 返回 200，`tools.total >= 1`
   - 断言：`GET /v1/logs` 返回 200，`logs` 为数组（可空）
   - 断言：`GET /v1/tools` 返回至少一个工具（`echo` 或 `get_current_time`）
   - 断言：`GET /v1/skills` 返回数组（可空，取决于 workspace 是否有 skills）
   - 断言：`GET /_internal/mcp/status` 从 loopback 返回 200

5. **更新** 根 `package.json`：`"test:introspection": "node scripts/test-introspection.mjs"` 纳入 `verify`

---

## 本轮不做

- 不实现 `apps/web-console`（另开 025 计划，本计划只打通后端 API）
- 不实现日志全文搜索（正则 / ElasticSearch）
- 不实现工具调用历史的 per-tool 统计（已由 `/metrics` 的 `tool_call_total` 覆盖）
- 不实现 `GET /v1/runs`（全局 run 列表，属于 operator 敏感接口，通过 session 维度查已足够）
- 不为 `packages/sdk/client` 新增对应方法（operator surface 不进 client SDK）
- 不新增数据库表

---

## 验收标准

1. `GET /v1/system/status` 返回 200，`tools.total` 反映当前加载的真实工具数量。
2. `GET /v1/logs` 在有日志文件时返回非空数组，文件不存在时返回空数组而不是 404。
3. `GET /v1/tools` 至少返回一个 `source: 'builtin'` 的工具。
4. `GET /v1/skills` 返回数组（空或非空均可，取决于 workspace 状态）。
5. `GET /_internal/mcp/status` 从 loopback 返回 200，外部 IP 返回 403。
6. smoke 脚本所有断言通过。
7. `pnpm verify` 通过。

---

## 必跑命令

1. `pnpm verify`
2. `pnpm test:introspection`

---

## 升级条件

命中以下任一情况时，弱模型必须立即停止并升级到 high-capability mode 或人工：

- `InMemoryToolRuntime` 没有暴露足够的 provider 类型信息，需要修改 core 层的 `ToolProvider` 接口（属于跨层 contract 变更，需要强模型决策）
- `GET /v1/logs` 的日志文件格式与预期不符（字段名不一致），需要做格式迁移
- 需要在日志 API 中支持正则搜索（安全性评估属于架构级决策）
- 连续两轮无法让 `pnpm verify` 与 `test:introspection` 同时通过

---

## 依赖与顺序

- **前置**：[`018`](../completed/018_persistence_layer.md)（DB 基础设施）
- **前置**：[`020`](../completed/020_auth_and_health.md)（API Key 鉴权——operator surface 需要保护）
- **前置**：[`021`](../completed/021_observability.md)（日志文件格式已由 FileLogger 确定）
- **建议顺序**：018 → 020 → 021 → 024
- **解锁**：[`025`](./025_web_console.md)（Web 调试控制台，消费本计划的 5 个 API）

---

## 决策记录

| 决策点 | 选择 | 原因 |
|--------|------|------|
| `system/status` 的 `activeSessions` 数据源 | 内存（`InMemorySessionRegistry`） | 反映运行时热状态；DB 里的 session 是历史记录，不代表"正在活跃" |
| 日志读取方式 | 每次请求读文件 | 首期日志量小（每日一文件）；不建内存索引降低实现复杂度 |
| `source` 字段分类 | builtin / mcp / skill / custom | 与现有 provider 类型对应；不需要新建类型体系 |
| `GET /v1/skills` vs 复用 `list_skills` 工具 | HTTP API，复用扫描逻辑 | 工具走 LLM，有 token 成本；HTTP API 直接返回，适合 UI 消费 |
| `GET /_internal/mcp/status` 放 internal 而非 operator | internal | 与现有 `/_internal/mcp/*` 保持一致；MCP 管理操作本身就是内部接口 |
| web-console 不在本计划实现 | 另开 025 | 保持"一个计划一个增量"原则；后端 API 需先验证可用才适合开始 UI |
