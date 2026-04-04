# 023 Scheduled Task System（定时任务）

## 目标

允许用户和 Agent 创建周期性或单次定时执行的 Agent 任务。每次触发时，系统自动创建一个独立 Session 并驱动指定 Agent 完成任务，执行结果持久化并可追溯。

本计划依赖 018（持久化）、019（Session API）、022（Agent 配置 API）。

> **优先级说明**：本计划属于第三层的高阶能力，不是第三层首期必须完成的功能。
> 在 018–022 均稳定后，再推进本计划。弱模型不应在没有明确指令的情况下自行开始本计划。

---

## 背景

### 使用场景

- 每天早 8 点让 Agent 汇总前一天的日志并发送摘要
- 每 30 分钟检查外部 API 状态，发现异常时触发告警
- 用户要求 Agent "明天下午三点提醒我做 XXX"

### 与其他层的关系

| 交互层 | 交互方式 |
|--------|---------|
| Core Runtime | 调用 `agent.run(sessionId, input)` |
| Session（019） | 每次执行创建 `kind='task'` 的独立 Session |
| Agent Config（022） | 从 DB 查询 Agent 定义，驱动对应 Agent |
| Trace（021） | 每次执行产生 `traceId`，可查询轨迹 |
| 持久化（018） | 新增 `scheduled_tasks` + `task_runs` 两张表 |

---

## 已冻结决策

### 触发类型

首期支持三种触发方式：

| 类型 | 配置方式 | 示例 |
|------|---------|------|
| `cron` | Cron 表达式（UTC） | `0 8 * * *`（每天 8:00） |
| `once` | Unix ms 时间戳 | `1712345678000` |
| `interval` | 间隔秒数 | `1800`（每 30 分钟） |

Cron 解析使用 `cron-parser` npm 包（轻量，无依赖）。

### DB Schema（追加到 018 迁移或新建 `003_scheduled_tasks.sql`）

```sql
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  trigger_type    TEXT NOT NULL,          -- 'cron' | 'once' | 'interval'
  trigger_config  TEXT NOT NULL,          -- JSON: { cron?, once_at?, interval_seconds? }
  agent_id        TEXT NOT NULL REFERENCES agents(id),
  input           TEXT NOT NULL,          -- JSON: { text: string }（用户消息内容）
  enabled         INTEGER NOT NULL DEFAULT 1,
  created_by      TEXT NOT NULL DEFAULT 'user',  -- 'user' | 'agent'
  created_at      INTEGER NOT NULL,
  next_run_at     INTEGER               -- Unix ms，调度器据此决定下次触发
);

CREATE TABLE IF NOT EXISTS task_runs (
  id              TEXT PRIMARY KEY,
  task_id         TEXT NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  status          TEXT NOT NULL,          -- 'running' | 'completed' | 'failed'
  progress        INTEGER,               -- 0-100
  progress_msg    TEXT,
  output          TEXT,                  -- JSON（run 最终回复）
  error           TEXT,                  -- JSON（RunError）
  trace_id        TEXT,                  -- 关联 agent_run_traces
  session_id      TEXT,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  started_at      INTEGER NOT NULL,
  completed_at    INTEGER
);
```

### 调度器实现

**进程内调度**（不依赖 Redis / Celery 等）：

```
TaskScheduler.tick()  // 每 10 秒运行一次
  ├── SELECT * FROM scheduled_tasks WHERE enabled=1 AND next_run_at <= now
  ├── 对每个待触发的任务：
  │     ├── 创建 Session（kind='task'）
  │     ├── 异步调用 agent.run(sessionId, input)
  │     ├── 插入 task_runs 记录（status='running'）
  │     └── 更新 next_run_at（下次触发时间）
  └── 等待下一个 tick
```

**任务执行隔离：**
- 每次触发创建独立 Session（`kind='task'`），不与用户对话 Session 混用
- 最大并发执行数：`OPENKIN_TASK_MAX_CONCURRENT`（默认 3），超出时跳过本次 tick

**失败重试：**
- 如果 run 失败，`task_runs.retry_count++`，最多重试 `OPENKIN_TASK_MAX_RETRIES`（默认 2）次
- 重试延迟：60 秒

**`once` 类型任务：**
- 执行完成后自动设置 `enabled=0`，不再触发

### `report_progress` 内置工具

`run_script` 或其他工具执行期间，Agent 可调用 `report_progress` 向 `task_runs` 写入进度：

```typescript
// 新增到 packages/core/src/tools/
{
  name: 'report_progress',
  description: '上报当前任务执行进度（仅在定时任务上下文中有效）',
  inputSchema: {
    progress: { type: 'number', description: '0-100 的整数' },
    message: { type: 'string', description: '进度描述文本' }
  }
}
```

`report_progress` 需要从 run context 拿到 `taskRunId`（通过 `AgentDefinition.metadata` 注入）。如果不在定时任务上下文，返回 `{ ok: false, reason: 'not_in_task_context' }`，不 crash。

### REST API

```
POST   /v1/tasks                       创建定时任务
GET    /v1/tasks                       列出任务
GET    /v1/tasks/:taskId               查询单个任务
PUT    /v1/tasks/:taskId               更新任务
DELETE /v1/tasks/:taskId               删除任务（同时 CASCADE 删除 task_runs）
POST   /v1/tasks/:taskId/enable        启用
POST   /v1/tasks/:taskId/disable       暂停
POST   /v1/tasks/:taskId/trigger       立即触发一次（不影响 next_run_at）
GET    /v1/tasks/:taskId/runs          执行历史列表
GET    /v1/tasks/:taskId/runs/:runId   单次执行详情（含 traceId）
```

---

## 影响范围

| 层级 | 影响 |
|------|------|
| `packages/server/src/db/migrations/003_scheduled_tasks.sql` | 两张新表 |
| `packages/server/src/db/` | 新增 `TaskRepository`、`TaskRunRepository` |
| `packages/server/src/scheduler.ts` | 新建：进程内 `TaskScheduler` |
| `packages/server/src/http-server.ts` | 新增 Task CRUD + runs 路由 |
| `packages/server/src/cli.ts` | 启动调度器 |
| `packages/core/src/tools/report-progress.ts` | 新增 `report_progress` 内置工具 |
| `packages/shared/contracts/src/index.ts` | 新增 TaskDto、TaskRunDto、路由辅助 |
| `packages/sdk/client/src/index.ts` | 新增 Task 管理方法 |
| `packages/server/package.json` | 新增 `cron-parser` 依赖 |
| `scripts/test-scheduler.mjs` | 新增 smoke 脚本（使用 `interval` 类型，短间隔验证触发） |
| `package.json`（根） | 新增 `test:scheduler`，纳入 `verify` |

---

## 允许修改的目录

- `packages/server/src/`（scheduler、db、http-server、cli）
- `packages/core/src/tools/`（新增 report-progress）
- `packages/core/src/tools/index.ts`（导出新工具）
- `packages/shared/contracts/src/index.ts`
- `packages/sdk/client/src/index.ts`
- `packages/server/package.json`（新增 cron-parser）
- `scripts/`
- `docs/exec-plans/active/`
- `package.json`（根，仅 `scripts` 字段）

## 禁止修改的目录

- `packages/core/src/run-engine.ts`（不改 ReAct 引擎）
- `packages/core/src/types.ts`（不改 RunState 语义）
- `packages/channel-core/`
- `apps/dev-console/`
- 现有路由的 DTO（不 breaking change）

---

## 本轮范围

1. `003_scheduled_tasks.sql` 迁移
2. `TaskRepository` + `TaskRunRepository`
3. `TaskScheduler`（tick 调度、next_run_at 计算、并发控制、重试）
4. `report_progress` 内置工具
5. Task CRUD + runs 路由（10 条路由）
6. SDK Task 管理方法
7. smoke 脚本（创建 interval 任务 → 等待触发 → 验证 task_runs 记录）

---

## 本轮不做

- 不实现任务完成后向 Session 发送通知消息（需要 Channel 层推送）
- 不实现任务执行 WebSocket 实时进度推送（用轮询 `/v1/tasks/:id/runs/:runId` 代替）
- 不实现分布式任务锁（单进程部署，无需考虑并发触发）
- 不实现任务依赖 DAG（属于第四层多 Agent 工作流）
- 不实现 `report_progress` 的实时 SSE 推送

---

## 验收标准

1. `POST /v1/tasks`（`interval` 类型，5 秒间隔）后，等待 10 秒，`GET /v1/tasks/:id/runs` 至少有 1 条 `status=completed` 的记录。
2. 创建的 run 有对应 `traceId`，可通过 `GET /v1/runs/:traceId` 查询。
3. `POST /v1/tasks/:id/disable` 后调度器不再触发。
4. `POST /v1/tasks/:id/trigger` 立即创建一次 task_run（不受 `next_run_at` 限制）。
5. smoke 脚本通过。
6. `pnpm verify` 通过。

---

## 必跑命令

1. `pnpm verify`
2. `pnpm test:scheduler`

---

## 升级条件

命中以下任一情况时，弱模型必须立即停止并升级：

- `TaskScheduler` 的 tick 循环与 server 关闭逻辑出现竞态（优雅退出时任务仍在执行）
- `cron-parser` 无法正确解析某些 Cron 表达式（不应自行修复 cron 解析逻辑）
- 需要实现分布式锁或多进程部署（属于架构级决策）
- 连续两轮无法让 `pnpm verify` 与 `test:scheduler` 同时通过

---

## 依赖与顺序

- **前置**：[`018`](./018_persistence_layer.md)（DB 基础设施）
- **前置**：[`019`](./019_session_message_api.md)（Session API，任务触发时创建 Session）
- **前置**：[`022`](./022_agent_config_api.md)（Agent 配置 API，任务需要关联 Agent）
- **建议顺序**：018 → 019 → 020 → 021 → 022 → 023

---

## 决策记录

| 决策点 | 选择 | 原因 |
|--------|------|------|
| 进程内调度 vs 外部调度（Redis等） | 进程内（10s tick） | 单机部署优先；无外部依赖；tick 间隔内的时间误差可接受 |
| `cron-parser` | 引入 npm 包 | Cron 解析是已知复杂问题；不自行实现 |
| `once` 任务执行后禁用 | 自动 `enabled=0` | 防止时钟漂移导致重复执行 |
| `report_progress` 不报告 → 不 crash | 返回 ok=false | 向后兼容；非任务上下文的 run 中调用此工具不应失败 |
