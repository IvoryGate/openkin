# 018 Persistence Layer（SQLite + Session/Message/Trace 存储）

## 目标

为 **Service And Protocol Layer** 引入持久化能力，把当前内存态的会话、消息、推理轨迹落到 SQLite，
使服务重启后对话历史不丢失，并为后续 Message API（019）、Trace 查询 API（021）打好存储底座。

本计划是第三层所有工程能力的前提，其他计划必须等本计划收口后才能推进。

---

## 背景

### 当前状态

| 能力 | 状态 |
|------|------|
| Session 创建 / 查询 | ✓（内存，重启后丢失） |
| Message 历史 | ✗（仅保存在 `InMemorySessionRegistry` 的 `messages[]`） |
| 推理轨迹（RunState/steps） | ✗（内存，无查询 API） |
| 持久化 | ✗ |

### 为什么选 SQLite + `better-sqlite3`

| 方案 | 跨平台 | 零依赖部署 | 读写性能 | 迁移复杂度 |
|------|--------|------------|---------|------------|
| SQLite + `better-sqlite3` | ✓ | ✓（单文件） | 高（同步 API，无网络 RTT） | 低（手写迁移脚本） |
| PostgreSQL | 需要 PG 进程 | ✗ | 高 | 中 |
| MongoDB | 需要 Mongo 进程 | ✗ | 中 | 低 |

首期不需要向量存储（向量检索属于第三层知识库扩展，另开计划）。

---

## 已冻结决策

### 数据库位置

数据库文件路径：`$OPENKIN_WORKSPACE_DIR/openkin.db`（与 `logs/` 同目录，跟随 workspace 配置）。

### Schema（三张核心表）

```sql
-- 会话表
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL DEFAULT 'chat', -- 'chat' | 'task' | 'channel'
  agent_id    TEXT NOT NULL,
  created_at  INTEGER NOT NULL              -- Unix ms
);

-- 消息表（会话历史）
CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,               -- 'user' | 'assistant' | 'tool' | 'system'
  content     TEXT NOT NULL,               -- 纯文本或 JSON 序列化的 MessagePart[]
  created_at  INTEGER NOT NULL
);

-- 推理轨迹表
CREATE TABLE IF NOT EXISTS agent_run_traces (
  trace_id    TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  agent_id    TEXT NOT NULL,
  status      TEXT NOT NULL,               -- RunFinalStatus
  steps       TEXT NOT NULL DEFAULT '[]',  -- JSON: RunStep[]
  duration_ms INTEGER,
  created_at  INTEGER NOT NULL
);
```

**索引**（写入时建立）：
- `messages(session_id, created_at)` — 按时间顺序查询会话消息
- `agent_run_traces(session_id, created_at)` — 按会话查询轨迹

### 迁移策略

首期采用**手写迁移脚本**（`packages/server/src/db/migrate.ts`），不引入 ORM。

迁移表：`schema_migrations(version TEXT PRIMARY KEY, applied_at INTEGER)`

每次 server 启动时检查并自动应用未跑过的迁移，迁移文件放在 `packages/server/src/db/migrations/`。

### 接口设计

新增 `packages/server/src/db/` 目录，对外只暴露：

```typescript
// packages/server/src/db/index.ts
export interface Db {
  sessions: SessionRepository
  messages: MessageRepository
  traces: TraceRepository
  close(): void
}

export interface SessionRepository {
  insert(session: { id: string; kind: string; agentId: string; createdAt: number }): void
  findById(id: string): DbSession | undefined
  listAll(): DbSession[]
}

export interface MessageRepository {
  insert(msg: DbMessage): void
  listBySession(sessionId: string, limit?: number): DbMessage[]
}

export interface TraceRepository {
  upsert(trace: DbTrace): void
  findByTraceId(traceId: string): DbTrace | undefined
  listBySession(sessionId: string, limit?: number): DbTrace[]
}

export function createDb(dbPath: string): Db
```

**只允许这三个 Repository，不向外泄露 `better-sqlite3` Statement 对象。**

### server 集成方式

- `packages/server/src/cli.ts` 在启动时调用 `createDb()` 并注入到 `createOpenKinHttpServer()` 的选项中
- `CreateOpenKinHttpServerOptions` 增加可选字段 `db?: Db`（不传则保持现有内存行为，向后兼容）
- `PersistenceHook` 只负责在 `onRunEnd` / `onRunError` 写入 `traces` 表
- `messages` 表不通过新增 core hook 挂点写入，而是由 service 层在现有边界内完成：
  - `POST /v1/runs` 接收到用户输入后，先写入一条 user message
  - run 成功完成后，再写入一条 assistant message

这样 `018` 不需要修改 `packages/core` 的 lifecycle contract。

### `better-sqlite3` 类型

`better-sqlite3` 有对应的 `@types/better-sqlite3`，两个都列为 `dependencies`（not devDependencies），因为它在运行时需要。

### 现有内存行为保持不变

`InMemorySessionRegistry` 保持现有逻辑不变。`db?.sessions.insert(...)` 是额外写入，不替换内存状态。

---

## 影响范围

| 层级 | 影响 |
|------|------|
| `packages/server/src/db/` | 新建目录：`index.ts`、`migrate.ts`、`repositories.ts`、`migrations/001_init.sql` |
| `packages/server/src/http-server.ts` | `CreateOpenKinHttpServerOptions` 增加可选 `db?: Db`（向后兼容） |
| `packages/server/src/cli.ts` | 启动时初始化 DB，注入到 server |
| `packages/server/package.json` | 新增 `better-sqlite3` + `@types/better-sqlite3` 依赖 |
| `scripts/test-persistence.mjs` | 新增 smoke 脚本 |
| `package.json`（根） | 新增 `test:persistence`，纳入 `verify` |
| `docs/architecture-docs-for-agent/ARCHITECTURE.md` | 更新 Service 层持久化状态说明 |

---

## 允许修改的目录

- `packages/server/src/db/`（新建）
- `packages/server/src/http-server.ts`
- `packages/server/src/cli.ts`
- `packages/server/package.json`
- `scripts/`
- `docs/architecture-docs-for-agent/ARCHITECTURE.md`
- `docs/exec-plans/completed/`（本计划文档）
- `package.json`（根，仅 `scripts` 字段）

## 禁止修改的目录

- `packages/core/`（不得在 core 层引入 DB 依赖）
- `packages/shared/contracts/`（本计划不新增 DTO）
- `packages/sdk/client/`
- `packages/channel-core/`
- `apps/dev-console/`
- `packages/server/src/http-server.ts` 路由与 DTO（本计划不改路由，只改 options interface）

---

## 本轮范围

1. **新建** `packages/server/src/db/migrations/001_init.sql`
   - 三张表 DDL + 两个索引

2. **新建** `packages/server/src/db/repositories.ts`
   - 实现 `SessionRepository`、`MessageRepository`、`TraceRepository`
   - 使用 `better-sqlite3` 同步 API

3. **新建** `packages/server/src/db/migrate.ts`
   - 读取 `migrations/` 目录下所有 `.sql` 文件，按文件名排序，依次执行未跑的迁移

4. **新建** `packages/server/src/db/index.ts`
   - `createDb(dbPath: string): Db`
   - 内部调用 `migrate(db)` 确保 schema 最新

5. **修改** `packages/server/src/http-server.ts`
   - `CreateOpenKinHttpServerOptions` 增加 `db?: Db`
   - 在 `POST /v1/sessions` handler 里：如果 `db` 存在，调用 `db.sessions.insert(...)`
   - 在 `POST /v1/runs` handler 里：如果 `db` 存在，先写入 user message；run 成功后写入 assistant message
   - 在 hooks 链路里注入 `PersistenceHook`（如果 `db` 存在，仅写 trace）

6. **新建** `packages/server/src/persistence-hook.ts`
   - 实现 `AgentLifecycleHook`
   - `onRunEnd` / `onRunError`：写 `agent_run_traces` 记录

7. **修改** `packages/server/src/cli.ts`
   - 初始化 DB（路径 `$OPENKIN_WORKSPACE_DIR/openkin.db`）
   - 把 `db` 注入 `createOpenKinHttpServer()`
   - 进程退出时调用 `db.close()`

8. **修改** `packages/server/package.json`：添加 `better-sqlite3` + `@types/better-sqlite3`

9. **新增** `scripts/test-persistence.mjs`
   - 启动带 DB 的 server 子进程
   - 创建 session → 提交 run → 等待 `run_completed`
   - 重启 server 子进程（同一 DB 文件）
   - 断言：session 仍可查询（`GET /v1/sessions/:id` 返回 200）
   - 断言：trace 记录存在（通过直接读 DB 文件验证，等待 019 提供 API）

10. **更新** 根 `package.json`：`"test:persistence": "node scripts/test-persistence.mjs"` 纳入 `verify`

---

## 本轮不做

- 不实现 Message 查询 API（属于 019）
- 不实现 Trace 查询 API（属于 021）
- 不实现向量存储 / RAG（属于知识库扩展）
- 不引入 ORM（`drizzle-orm` 等）
- 不实现数据备份与导出
- 不实现多数据库后端切换（PostgreSQL 等）
- 不修改 `InMemorySessionRegistry`（保持现有内存逻辑）
- 不新增 core lifecycle hook（如 `onConversationTurn`）

---

## 验收标准

1. server 启动时自动创建 / 迁移 `$OPENKIN_WORKSPACE_DIR/openkin.db`（首次启动自动建表）。
2. `POST /v1/sessions` 成功后，session 被写入 SQLite `sessions` 表。
3. 一次 run 完成后，`agent_run_traces` 表中有对应记录（status、steps、duration_ms 不为空）。
4. server 重启后，通过 `GET /v1/sessions/:id` 仍可查询之前创建的 session（返回 200）。
5. `scripts/test-persistence.mjs` 所有断言通过。
6. `pnpm verify` 通过（含新增 `test:persistence`）。
7. `packages/core/` 无 `better-sqlite3` 依赖引入（架构 lint 验证）。

---

## 必跑命令

1. `pnpm verify`
2. `pnpm test:persistence`

---

## 升级条件

命中以下任一情况时，弱模型必须立即停止并升级到 high-capability mode 或人工：

- `better-sqlite3` 与当前 Node 版本的 native addon 构建失败，无法简单解决
- 需要修改 `InMemorySessionRegistry` 的对外接口
- 需要在 `packages/core/` 中引入任何 DB 依赖
- 需要修改 `packages/shared/contracts` 的现有 DTO 类型
- 连续两轮无法让 `pnpm verify` 与 `test:persistence` 同时通过

---

## 依赖与顺序

- **前置**：[`017`](../completed/017_sandbox.md)（第二层已收口）
- **解锁**：
  - [`019`](./019_session_message_api.md) — Session/Message/Trace API（依赖本计划的 DB）
  - [`020`](./020_auth_and_health.md) — 鉴权与健康检查（独立，可与 018 并行，但建议先完成 018）
  - [`021`](./021_observability.md) — 可观测性深化（依赖本计划的 Trace 表）

---

## 决策记录

| 决策点 | 选择 | 原因 |
|--------|------|------|
| 存储技术 | SQLite + `better-sqlite3` | 零额外进程；单文件；同步 API 减少异步复杂度；与 workspace 目录统一管理 |
| 迁移方式 | 手写 SQL 迁移脚本 | 首期表少；ORM 引入成本高于收益；迁移逻辑可读性更高 |
| `InMemorySessionRegistry` 是否替换 | 保留 | 保证 in-process 和 channel smoke 的向后兼容；DB 写入是额外副作用层 |
| messages 写入位置 | service 路由内写入 | 当前 core 无 `onConversationTurn` 挂点；避免为了持久化反向修改 lifecycle contract |
| traces 写入位置 | Hook 写入 | trace 属于运行时终态产物，使用现有 `onRunEnd` / `onRunError` 最自然 |
| 不实现 ORM | 直接 SQL | 首期表少于 5 张；SQL 更可控；降低弱模型实现风险 |
| DB 路径跟随 workspace | `OPENKIN_WORKSPACE_DIR` | 与日志、Skill、MCP 注册表统一位置，部署时只需挂载一个目录 |
