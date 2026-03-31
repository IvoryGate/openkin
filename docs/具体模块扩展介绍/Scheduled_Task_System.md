# 定时任务系统详细设计

> 所属层级：第三层 · 服务化与工程能力层  
> 模块路径：`server/task-scheduler/`  
> 更新时间：2026-03-31

---

## 目录

1. [模块定位与边界](#1-模块定位与边界)
2. [数据模型](#2-数据模型)
3. [触发机制](#3-触发机制)
4. [执行流程](#4-执行流程)
5. [异常捕获与错误记录](#5-异常捕获与错误记录)
6. [进度上报机制](#6-进度上报机制)
7. [重试策略](#7-重试策略)
8. [完成通知](#8-完成通知)
9. [Agent 操作任务的工具接口](#9-agent-操作任务的工具接口)
10. [API 路由详细说明](#10-api-路由详细说明)
11. [目录结构](#11-目录结构)
12. [与其他模块的集成点](#12-与其他模块的集成点)

---

## 1. 模块定位与边界

### 职责范围

定时任务系统负责：

- **调度**：按配置的时间规则（Cron / 单次 / 间隔）在正确时间触发 Agent 执行
- **执行管理**：为每次执行创建独立的 Session 和 TaskRun 记录
- **状态追踪**：记录每次执行的状态、进度、输出、耗时
- **生命周期管理**：支持任务的创建、编辑、启用/暂停/删除，用户和 Agent 均可操作

### 不在职责内

- **不负责 Agent 推理**：推理逻辑完全交由 `core/agent` 的 `agent.run()` 处理
- **不负责流式推送**：定时任务是后台异步执行，结果写入 DB，不走 SSE/WebSocket 流式输出
- **不是分布式任务队列**：基于 `node-cron` 的单进程调度，不支持跨进程/跨节点分发

### 与第四层 AgentScheduler 的区别

| | 定时任务系统（本模块） | AgentScheduler（`core/scheduler`） |
| --- | --- | --- |
| **触发方式** | 时间驱动（Cron / 定时） | 事件驱动（用户目标 / Supervisor 分配） |
| **执行主体** | 单个 Agent | 多个 Agent 协作 |
| **配置方式** | 用户或 Agent 预先配置，持久化 | 由 Supervisor 动态规划生成 |
| **典型场景** | "每天 8 点总结昨日工作" | "完成一个需要研究员+代码助手协作的复杂任务" |

---

## 2. 数据模型

### 2.1 ScheduledTask（任务定义）

```typescript
interface ScheduledTask {
  id: string                        // 任务唯一 ID（nanoid）

  // ── 基础信息 ──────────────────────────────────────────
  name: string                      // 任务名称，人类可读
  description?: string              // 任务描述（说明任务用途）

  // ── 触发方式（三选一）────────────────────────────────
  triggerType: 'cron' | 'once' | 'interval'
  cronExpression?: string           // triggerType=cron，标准 5/6 位 Cron 表达式
                                    // 如 "0 8 * * *"（每天 8:00）
  runAt?: number                    // triggerType=once，Unix 时间戳（毫秒）
  intervalMs?: number               // triggerType=interval，间隔毫秒数（最小 60000）

  // ── 执行配置 ──────────────────────────────────────────
  agentId: string                   // 执行此任务的 Agent ID
  input: object                     // 传给 Agent 的输入，等价于用户发的消息
                                    // 如 { message: "请总结今天的工作日志" }
  sessionMode: 'new_each_run'       // 每次运行新建 Session（当前版本固定此模式）
               | 'persistent'       // 复用同一个 Session（保留对话历史，后续扩展）

  // ── 执行控制 ──────────────────────────────────────────
  enabled: boolean                  // 是否启用（false 时不触发，但保留配置）
  maxRuns?: number                  // 最多执行次数（null = 不限）
  timeoutMs: number                 // 单次执行超时，默认 300000（5 分钟）
  retryOnFailure: boolean           // 失败是否自动重试
  maxRetries: number                // 最大重试次数（默认 2）
  retryDelayMs: number              // 重试前等待时间（默认 5000，指数退避）

  // ── 完成通知 ──────────────────────────────────────────
  onComplete?: {
    notifySessionId?: string        // 完成后往此 Session 注入一条通知消息
    notifyTemplate?: string         // 通知消息模板，支持 {{output}} / {{taskName}} 占位符
  }

  // ── 权限 ─────────────────────────────────────────────
  createdBy: 'user' | 'agent'
  creatorId: string                 // userId 或 agentId

  // ── 统计（只读，自动维护）──────────────────────────────
  runCount: number                  // 已执行次数
  lastRunAt?: number
  lastRunStatus?: TaskRunStatus
  nextRunAt?: number                // 下次预计执行时间（cron/interval 自动计算）

  createdAt: number
  updatedAt: number
}
```

### 2.2 TaskRun（执行记录）

每次触发（无论成功、失败、重试）都产生一条独立记录。

```typescript
type TaskRunStatus =
  | 'pending'    // 已创建，等待执行
  | 'running'    // 执行中
  | 'completed'  // 成功完成
  | 'failed'     // 执行失败（已用完所有重试次数）
  | 'cancelled'  // 被手动取消
  | 'timeout'    // 超时强制终止

interface TaskRun {
  id: string
  taskId: string

  // ── 状态与进度 ────────────────────────────────────────
  status: TaskRunStatus
  progress: number                  // 0-100，由 Agent 通过 report_progress 工具上报
  progressMessage?: string          // 进度说明，如 "正在分析第 3/10 个文件"

  // ── 关联信息 ──────────────────────────────────────────
  sessionId?: string                // 本次运行创建的 Session ID（sessionType='scheduled_task'）
  traceId?: string                  // 对应的 AgentRunTrace ID（可跳转查看完整推理步骤）

  // ── 结果 ─────────────────────────────────────────────
  output?: object                   // Agent 最终输出（AgentResult.content）
  error?: string                    // 错误类型前缀 + 消息，如 "[TOOL_EXECUTION_ERROR] fetch_url failed"
  errorCode?: string                // 机器可读错误码（见第 5 节枚举），重试策略也依据此字段判断
  errorStack?: string               // 完整堆栈（仅 NODE_ENV=development 写入，生产环境留空）
  errorPhase?: 'init' | 'running' | 'timeout'  // 异常发生阶段

  // ── 重试信息 ──────────────────────────────────────────
  retryCount: number                // 当前是第几次重试（0 = 首次执行）
  parentRunId?: string              // 若是重试，指向上一次失败的 TaskRun

  startedAt?: number
  completedAt?: number
}
```

### 2.3 数据库 Schema

```sql
CREATE TABLE scheduled_tasks (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  trigger_type    TEXT NOT NULL CHECK(trigger_type IN ('cron', 'once', 'interval')),
  cron_expression TEXT,
  run_at          INTEGER,
  interval_ms     INTEGER,
  agent_id        TEXT NOT NULL,
  input           TEXT NOT NULL,      -- JSON 字符串
  session_mode    TEXT NOT NULL DEFAULT 'new_each_run',
  enabled         INTEGER NOT NULL DEFAULT 1,
  max_runs        INTEGER,
  timeout_ms      INTEGER NOT NULL DEFAULT 300000,
  retry_on_failure INTEGER NOT NULL DEFAULT 0,
  max_retries     INTEGER NOT NULL DEFAULT 2,
  retry_delay_ms  INTEGER NOT NULL DEFAULT 5000,
  on_complete     TEXT,              -- JSON 字符串
  created_by      TEXT NOT NULL CHECK(created_by IN ('user', 'agent')),
  creator_id      TEXT NOT NULL,
  run_count       INTEGER NOT NULL DEFAULT 0,
  last_run_at     INTEGER,
  last_run_status TEXT,
  next_run_at     INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE task_runs (
  id               TEXT PRIMARY KEY,
  task_id          TEXT NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'pending',
  progress         INTEGER NOT NULL DEFAULT 0,
  progress_message TEXT,
  session_id       TEXT,
  trace_id         TEXT,
  output           TEXT,             -- JSON 字符串
  error            TEXT,             -- 错误类型前缀 + 消息
  error_code       TEXT,             -- 机器可读错误码，如 'LLM_RATE_LIMIT'
  error_stack      TEXT,             -- 完整堆栈（仅开发环境写入）
  error_phase      TEXT,             -- 异常发生阶段：'init' | 'running' | 'timeout'
  retry_count      INTEGER NOT NULL DEFAULT 0,
  parent_run_id    TEXT REFERENCES task_runs(id),
  started_at       INTEGER,
  completed_at     INTEGER
);

CREATE INDEX idx_task_runs_task_id ON task_runs(task_id);
CREATE INDEX idx_task_runs_status ON task_runs(status);
CREATE INDEX idx_scheduled_tasks_next_run ON scheduled_tasks(next_run_at) WHERE enabled = 1;
```

---

## 3. 触发机制

### 3.1 三种触发类型

| 类型 | 描述 | 示例配置 |
| --- | --- | --- |
| `cron` | 标准 Cron 表达式，周期执行 | `"0 8 * * *"` 每天 8:00 |
| `once` | 指定时间点执行一次，执行后自动 disable | `runAt: 1743465600000` |
| `interval` | 固定间隔反复执行，最小间隔 60 秒 | `intervalMs: 3600000`（每小时）|

### 3.2 CronManager 实现

```typescript
// server/task-scheduler/cron-manager.ts

class CronManager {
  // 内存中存储所有活跃的 cron job 实例
  private jobs = new Map<string, ScheduledTask>()  // taskId → cron job

  // 服务启动时从 DB 加载所有 enabled=true 的任务并注册
  async loadAll(): Promise<void>

  // 注册或更新一个任务的调度
  register(task: ScheduledTask): void

  // 取消一个任务的调度（任务被禁用/删除时调用）
  unregister(taskId: string): void

  // 重新注册（任务配置被编辑后调用）
  refresh(task: ScheduledTask): void
}
```

**启动时序：**

```
服务启动（server/index.ts）
  → CronManager.loadAll()
      → SELECT * FROM scheduled_tasks WHERE enabled = 1
      → 对每个任务调用 register()
          → cron: node-cron.schedule(cronExpression, handler)
          → once: setTimeout(handler, runAt - Date.now())
          → interval: setInterval(handler, intervalMs)
```

### 3.3 触发时的幂等保护

防止时钟漂移或服务重启导致任务重复执行：

- 触发前先检查 `task_runs` 表中是否已有 `status='running'` 的记录（距当前 < 30 秒）
- 若存在，跳过本次触发并记录 WARN 日志
- `once` 类型执行成功后立即将 `enabled` 置为 `false`

---

## 4. 执行流程

```
CronManager 触发
  ↓
TaskRunner.run(taskId)
  ↓
① 读取 ScheduledTask 配置（确认 enabled=true）
  ↓
② 检查并发：已有 running 状态的 TaskRun？→ 跳过
  ↓
③ 创建 TaskRun 记录（status: 'pending'）
  ↓
④ 通过 SessionRegistry 创建新 Session
     sessionType = 'scheduled_task'
     initiatorId = task.id
  ↓
⑤ 更新 TaskRun.status = 'running'，TaskRun.startedAt = now
  ↓
⑥ 调用 agent.run(task.input, { sessionId, onProgress })
     Agent 推理过程中途可调用 report_progress 工具
     → onProgress 回调更新 TaskRun.progress
  ↓
⑦ 推理完成
   ├─ 成功：TaskRun.status = 'completed', output = result, traceId = result.traceId
   └─ 失败：→ 进入重试逻辑（见第 6 节）
  ↓
⑧ 更新 ScheduledTask.lastRunAt / lastRunStatus / runCount / nextRunAt
  ↓
⑨ 触发完成通知（如配置了 onComplete）
```

---

## 5. 异常捕获与错误记录

Agent 执行过程中可能在多个阶段抛出异常。`TaskRunner` 对每类异常分别捕获、分类标注后写入 `TaskRun` 记录，确保所有失败都有据可查。

### 5.1 异常来源分类

| 异常类型 | 触发场景 | TaskRun.status | 是否触发重试 |
| --- | --- | --- | --- |
| `agent_error` | LLM 调用失败、工具执行抛出异常、ReAct 循环内部错误 | `failed` | ✅ 是 |
| `timeout` | 执行时间超过 `task.timeoutMs` | `timeout` | ❌ 否 |
| `config_error` | agentId 不存在、Agent 已禁用、input 格式非法 | `failed` | ❌ 否（配置问题，重试无意义）|
| `session_error` | Session 创建失败（如 DB 写入异常） | `failed` | ✅ 是 |
| `scheduler_error` | CronManager / node-cron 内部调度异常 | — | 任务标记为 `enabled=false` 并记录系统日志 |

### 5.2 错误信息的捕获与存储

`TaskRun` 记录包含以下错误相关字段：

```typescript
interface TaskRun {
  // ...其他字段
  error?: string          // 错误类型前缀 + 消息，如 "[agent_error] Tool 'fetch_url' timed out after 10s"
  errorCode?: string      // 机器可读的错误码，如 'TOOL_TIMEOUT' / 'LLM_RATE_LIMIT' / 'AGENT_NOT_FOUND'
  errorStack?: string     // 完整堆栈（仅 NODE_ENV=development 时写入，生产环境留空）
  errorPhase?: string     // 异常发生阶段：'init' | 'running' | 'timeout'
}
```

**错误码枚举（`errorCode`）：**

| errorCode | 说明 |
| --- | --- |
| `AGENT_NOT_FOUND` | agentId 对应的 Agent 不存在或已被删除 |
| `AGENT_DISABLED` | Agent 存在但 `enabled=false` |
| `SESSION_CREATE_FAILED` | Session 创建失败（DB 异常）|
| `LLM_RATE_LIMIT` | LLM Provider 触发限流 |
| `LLM_AUTH_ERROR` | LLM API Key 无效或过期 |
| `LLM_CONTEXT_OVERFLOW` | 输入超出模型上下文长度上限 |
| `TOOL_EXECUTION_ERROR` | 工具调用内部抛出未处理异常 |
| `MAX_STEPS_EXCEEDED` | ReAct 循环达到最大步骤数上限 |
| `EXECUTION_TIMEOUT` | 超过 `task.timeoutMs` 强制终止 |
| `UNKNOWN_ERROR` | 未归类异常（兜底）|

### 5.3 TaskRunner 异常捕获结构

```typescript
// runner.ts（伪代码，展示捕获结构）
async function executeRun(task: ScheduledTask, taskRun: TaskRun) {
  // 阶段一：初始化
  let session: Session
  try {
    const agent = agentRegistry.get(task.agentId)
    if (!agent)       throw new TaskError('AGENT_NOT_FOUND', `Agent ${task.agentId} not found`)
    if (!agent.enabled) throw new TaskError('AGENT_DISABLED', `Agent ${task.agentId} is disabled`)
    session = await sessionRegistry.create({ ... })
  } catch (err) {
    await finalizeRun(taskRun, 'failed', err, 'init')
    return
  }

  // 阶段二：执行（含超时控制）
  try {
    const result = await Promise.race([
      agent.run(task.input, { sessionId: session.id }),
      sleep(task.timeoutMs).then(() => { throw new TaskError('EXECUTION_TIMEOUT', 'Task timed out') })
    ])
    await finalizeRun(taskRun, 'completed', null, 'running', result)
  } catch (err) {
    const status = err.code === 'EXECUTION_TIMEOUT' ? 'timeout' : 'failed'
    await finalizeRun(taskRun, status, err, 'running')
  }
}

// 统一的收尾写入函数
async function finalizeRun(
  taskRun: TaskRun,
  status: TaskRunStatus,
  err: TaskError | null,
  phase: 'init' | 'running',
  result?: AgentResult
) {
  await db.taskRuns.update(taskRun.id, {
    status,
    output:      result?.content ?? null,
    traceId:     result?.traceId ?? null,
    error:       err ? `[${err.code}] ${err.message}` : null,
    errorCode:   err?.code ?? null,
    errorStack:  isDev ? err?.stack : null,   // 生产环境不写堆栈
    errorPhase:  err ? phase : null,
    completedAt: Date.now(),
  })
}
```

### 5.4 CronManager 的调度异常处理

CronManager 本身（即 `node-cron` 层面）的异常与单次 Task 执行异常性质不同，需要单独处理：

```typescript
// cron-manager.ts
const job = nodeCron.schedule(expr, async () => {
  try {
    await taskRunner.run(task.id)
  } catch (err) {
    // TaskRunner 内部已处理所有预期异常，到这里说明是调度层本身的意外错误
    logger.error({ taskId: task.id, err }, '[scheduler_error] Unexpected error in cron handler')
    // 将任务标记为 disabled，避免反复触发损坏的任务
    await db.scheduledTasks.update(task.id, { enabled: false, lastRunStatus: 'failed' })
    // 取消该任务的调度
    this.unregister(task.id)
  }
})
```

### 5.5 错误信息在 API 的暴露

`GET /api/tasks/:id/runs/:runId` 返回的 `TaskRun` 对象：
- **生产环境**：返回 `error` + `errorCode`，不返回 `errorStack`
- **开发环境**（`NODE_ENV=development`）：额外返回 `errorStack`，便于本地调试

完整的推理内部异常（如具体哪一步工具调用失败）可通过 `traceId` 跳转到 `GET /api/traces/:traceId` 查看逐步记录。

---

## 6. 进度上报机制

Agent 在推理过程中可以通过内置工具主动上报进度，让外部观察者（前端轮询或 WebSocket）实时看到任务进展。

### 5.1 内置工具：`report_progress`

注册到 `core/tool-registry`，所有 Agent 默认可用（但只在 `scheduled_task` 类型的 Session 中有实际效果）。

```typescript
// 工具定义
{
  name: 'report_progress',
  description: '上报当前任务的执行进度。仅在定时任务执行期间有效，在普通对话中调用无副作用。',
  inputSchema: {
    type: 'object',
    properties: {
      progress: {
        type: 'number',
        minimum: 0,
        maximum: 100,
        description: '当前进度，0-100 的整数'
      },
      message: {
        type: 'string',
        description: '进度说明，如"正在处理第 3/10 个文件"'
      }
    },
    required: ['progress']
  }
}
```

### 5.2 工具执行逻辑

```typescript
// 工具实现
async function execute({ progress, message }, context) {
  const { sessionId } = context

  // 通过 sessionId 找到对应的 TaskRun
  const taskRun = await db.taskRuns.findBySessionId(sessionId)
  if (!taskRun) {
    // 普通对话中调用，无副作用，直接返回成功
    return { content: 'ok', isError: false }
  }

  // 更新 TaskRun 进度
  await db.taskRuns.update(taskRun.id, { progress, progressMessage: message })

  return { content: `进度已更新：${progress}%`, isError: false }
}
```

### 5.3 前端轮询进度

定时任务是异步后台执行，前端通过轮询 `GET /api/tasks/:id/runs/:runId` 获取最新进度：

```
前端每 2 秒轮询 → 获取 TaskRun.progress + progressMessage
                 → 渲染进度条
                 → status = 'completed' 时停止轮询
```

> 后续可升级为 WebSocket 订阅（`/ws/tasks/runs/:runId`），减少轮询开销，实现实时推送。

---

## 7. 重试策略

### 7.1 重试条件

仅在以下情况触发重试：
- `task.retryOnFailure === true`
- `taskRun.retryCount < task.maxRetries`
- `errorCode` 不在不可重试列表中（见下表）

**不触发重试的 errorCode：**

| errorCode | 原因 |
| --- | --- |
| `EXECUTION_TIMEOUT` | 超时说明任务本身耗时过长，重试大概率仍超时 |
| `AGENT_NOT_FOUND` | 配置问题，重试不会自愈 |
| `AGENT_DISABLED` | 配置问题，重试不会自愈 |
| `LLM_AUTH_ERROR` | 认证问题，需要人工介入修复 API Key |
| `LLM_CONTEXT_OVERFLOW` | 输入超长，重试不会自愈，需修改 input |
| `MAX_STEPS_EXCEEDED` | Agent 推理设计问题，重试不会自愈 |

### 7.2 指数退避

```
第 1 次重试：等待 task.retryDelayMs × 2^0 = 5s
第 2 次重试：等待 task.retryDelayMs × 2^1 = 10s
第 3 次重试：等待 task.retryDelayMs × 2^2 = 20s
（以此类推，上限 5 分钟）
```

### 7.3 重试流程

```
执行失败
  → 判断 errorCode 是否可重试？
      不可重试 → TaskRun.status = 'failed'，记录 ERROR 日志，结束
      可重试  → retryOnFailure=true && retryCount < maxRetries？
                  是 → 等待退避时间
                      → 创建新 TaskRun（retryCount+1, parentRunId=上次失败的runId）
                      → 重新执行（回到第 4 节流程 ③）
                  否 → TaskRun.status = 'failed'
                      → ScheduledTask.lastRunStatus = 'failed'
                      → 记录 ERROR 日志
```

---

## 8. 完成通知

任务执行完成后（无论成功或失败），如果配置了 `onComplete.notifySessionId`，系统会向该 Session 注入一条通知消息，让用户下次打开对话时能看到执行结果。

### 8.1 通知消息模板

支持以下占位符：

| 占位符 | 说明 |
| --- | --- |
| `{{taskName}}` | 任务名称 |
| `{{status}}` | 执行状态（completed / failed） |
| `{{output}}` | Agent 输出内容（JSON 序列化） |
| `{{error}}` | 错误信息（仅失败时有值） |
| `{{duration}}` | 执行耗时（如 "2分34秒"） |
| `{{runId}}` | TaskRun ID（可用于查询详情） |

**默认模板（未配置时使用）：**

```
✅ 定时任务「{{taskName}}」已完成（耗时 {{duration}}）
{{output}}
```

```
❌ 定时任务「{{taskName}}」执行失败（耗时 {{duration}}）
错误原因：{{error}}
```

### 8.2 实现方式

通知消息通过直接写入 `messages` 表实现（`role: 'assistant'`，`content: 渲染后的模板文字`），不经过 Agent 推理，不消耗 Token。

---

## 9. Agent 操作任务的工具接口

Agent 可以通过以下内置工具创建和管理定时任务，实现"让 Agent 帮你设置定时任务"的能力。

### 9.1 `create_scheduled_task`

```typescript
{
  name: 'create_scheduled_task',
  description: '创建一个定时任务，让指定 Agent 在设定的时间自动执行。',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '任务名称' },
      description: { type: 'string', description: '任务描述' },
      triggerType: { type: 'string', enum: ['cron', 'once', 'interval'] },
      cronExpression: { type: 'string', description: 'Cron 表达式，如 "0 8 * * *"' },
      runAt: { type: 'number', description: '单次执行的 Unix 时间戳（毫秒）' },
      intervalMs: { type: 'number', description: '间隔毫秒数，最小 60000' },
      agentId: { type: 'string', description: '执行任务的 Agent ID' },
      input: { type: 'object', description: '传给 Agent 的输入内容' },
    },
    required: ['name', 'triggerType', 'agentId', 'input']
  }
}
```

### 9.2 `update_scheduled_task`

```typescript
{
  name: 'update_scheduled_task',
  description: '修改已有定时任务的配置（触发时间、输入内容、执行 Agent 等）。',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string' },
      // 以下所有字段均为可选，只传需要修改的字段
      name: { type: 'string' },
      cronExpression: { type: 'string' },
      runAt: { type: 'number' },
      intervalMs: { type: 'number' },
      agentId: { type: 'string' },
      input: { type: 'object' },
      enabled: { type: 'boolean' },
    },
    required: ['taskId']
  }
}
```

### 9.3 `list_scheduled_tasks`

```typescript
{
  name: 'list_scheduled_tasks',
  description: '查询当前所有定时任务列表，可按状态筛选。',
  inputSchema: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', description: '筛选启用/暂停状态，不传则返回全部' },
      createdBy: { type: 'string', enum: ['user', 'agent'], description: '按创建者类型筛选' }
    }
  }
}
```

> 这三个工具注册到 `core/tool-registry`，供 Agent 在推理中调用。实际的 DB 写入和 CronManager 注册逻辑复用 `server/task-scheduler` 的同一套实现，不单独实现。

---

## 10. API 路由详细说明

所有路由挂载在 `/api/tasks` 下，实现在 `server/routes/tasks/`。

### `POST /api/tasks` — 创建任务

**请求体：**
```json
{
  "name": "每日工作总结",
  "triggerType": "cron",
  "cronExpression": "0 18 * * 1-5",
  "agentId": "agent_writer",
  "input": { "message": "请总结今天的代码提交记录并生成日报" },
  "retryOnFailure": true,
  "maxRetries": 2,
  "onComplete": {
    "notifySessionId": "sess_abc123"
  }
}
```

**响应：** 创建后的完整 `ScheduledTask` 对象（含 `id`, `nextRunAt` 等）

---

### `PUT /api/tasks/:id` — 编辑任务

支持部分更新（Partial）。编辑触发方式后自动重新计算 `nextRunAt` 并刷新 CronManager。

**可修改的字段：** `name` / `description` / `triggerType` / `cronExpression` / `runAt` / `intervalMs` / `agentId` / `input` / `enabled` / `maxRuns` / `timeoutMs` / `retryOnFailure` / `maxRetries` / `onComplete`

---

### `POST /api/tasks/:id/trigger` — 立即执行

不等下次计划时间，立即触发一次执行。常用于：
- 调试任务是否配置正确
- 手动补跑某次错过的执行

返回新创建的 `TaskRun` 对象。

---

### `GET /api/tasks/:id/runs` — 执行历史

**查询参数：**
- `status`：按状态筛选（`completed` / `failed` 等）
- `limit`：返回条数（默认 20，最大 100）
- `offset`：分页偏移

**响应示例：**
```json
{
  "total": 45,
  "runs": [
    {
      "id": "run_xyz",
      "status": "completed",
      "progress": 100,
      "traceId": "trc_8x2kq",
      "startedAt": 1743465600000,
      "completedAt": 1743465723000
    }
  ]
}
```

---

### `GET /api/tasks/:id/runs/:runId` — 单次执行详情

返回完整 `TaskRun` 对象，包含：
- 完整的 `output`
- `traceId`（可用于调用 `GET /api/traces/:traceId` 查看完整推理步骤）
- `error` / `errorStack`（失败时）

---

## 11. 目录结构

```
server/task-scheduler/
├── index.ts          # 模块入口：导出 TaskSchedulerService，负责初始化和优雅退出
├── cron-manager.ts   # node-cron 实例管理（注册/取消/刷新）
├── runner.ts         # 单次任务执行逻辑（触发 Agent run，管理 TaskRun 生命周期）
├── retry.ts          # 重试逻辑（指数退避计算、重试决策）
├── notifier.ts       # 完成通知（模板渲染、写入 messages 表）
└── db.ts             # scheduled_tasks / task_runs 表的 CRUD 操作

server/routes/tasks/
└── index.ts          # HTTP 路由（调用 TaskSchedulerService）
```

**与服务启动的集成（`server/index.ts`）：**

```typescript
import { TaskSchedulerService } from './task-scheduler'

const scheduler = new TaskSchedulerService({ db, agentRunner, sessionRegistry })

// 启动时加载所有任务
await scheduler.start()

// 优雅退出时等待正在运行的任务完成
process.on('SIGTERM', async () => {
  await scheduler.stop()   // 停止接受新触发，等待 running 任务完成
  process.exit(0)
})
```

---

## 12. 与其他模块的集成点

### 12.1 与 `core/session` 的集成

每次触发时，`TaskRunner` 调用 `SessionRegistry.create()` 创建新 Session：

```typescript
const session = await sessionRegistry.create({
  agentId: task.agentId,
  sessionType: 'scheduled_task',   // 新增的 session 类型
  initiatorId: task.id,            // 发起方是定时任务本身
})
```

**`sessionType = 'scheduled_task'` 的含义：**
- 不出现在用户的对话列表 API（`GET /api/sessions` 默认过滤此类型）
- `ConversationHistory` 对此类 Session 的历史默认不加载（每次执行是独立上下文）
- `LongTermMemory` 正常工作（定时任务的执行经验会积累到 Agent 的长期记忆）

### 12.2 与 `core/agent` 的集成

```typescript
// runner.ts
const result = await agent.run({
  input: task.input,
  sessionId: session.id,
  onProgress: (progress, message) => {
    // report_progress 工具调用时触发此回调
    db.taskRuns.update(taskRun.id, { progress, progressMessage: message })
  }
})
```

### 12.3 与 `server/observability` 的集成

每次执行完成后，`TaskRun.traceId` 关联到 `agent_run_traces` 表，前端可以：

```
TaskRun 详情页
  → 点击 "查看推理轨迹"
  → 跳转到 GET /api/traces/{traceId}
  → 展示完整的 Thought → Action → Observation 步骤
```

### 12.4 依赖关系总结

```
server/task-scheduler
  ├─ 依赖 core/agent          （调用 agent.run()）
  ├─ 依赖 core/session        （创建 scheduled_task 类型 Session）
  ├─ 依赖 core/tool-registry  （注册 report_progress 工具）
  ├─ 依赖 server/db           （读写 scheduled_tasks / task_runs 表）
  └─ 被 server/routes/tasks   （HTTP API 调用）
     被 server/index.ts        （服务启动/停止）
```

---

*文档由 CatPaw 生成，待 Review 后迭代更新*
