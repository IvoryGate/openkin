# 026 — Task Run Notifications

## 状态

**后端接入口已完成**，等待前端 UI 接入（SSE 订阅 + Toast 展示）。

| 组件 | 状态 |
|------|------|
| `TaskNotifier` 接口 + `noopTaskNotifier` | ✅ scheduler.ts |
| `TaskEventBus`（SSE 广播） | ✅ task-event-bus.ts |
| `GET /v1/tasks/events` SSE 端点 | ✅ http-server.ts |
| `WebhookNotifier`（HTTP POST，超时+重试） | ✅ webhook-notifier.ts |
| `CompositeTaskNotifier`（扇出） | ✅ webhook-notifier.ts |
| DB migration（`webhook_url` 列） | ✅ 004_webhook_url.sql |
| `webhookUrl` 字段（create/update/DTO） | ✅ contracts + repositories |
| `cli.ts` 注入 notifier + 心跳定时器 | ✅ cli.ts |
| 前端订阅 SSE + 展示 Toast | ⏳ 等待 UI |

## 背景

定时任务（exec plan 023）已实现调度和执行。任务触发后，Agent 的回复只写入 `task_runs.output` 字段，用户必须主动打开 Web Console 查看，没有任何主动推送能力。

本计划的目标是**在已有的接口骨架上实现一套或多套通知机制**，使用户能在任务完成时及时感知结果。

## 已预留的接口

`packages/server/src/scheduler.ts` 中已定义：

```typescript
// 事件结构
interface TaskRunEvent {
  taskId: string
  taskName: string
  runId: string
  sessionId: string
  traceId: string
  status: 'completed' | 'failed'
  output?: string   // Agent 回复文本（成功时）
  error?: string    // 错误信息（失败时）
  startedAt: number
  completedAt: number
}

// 通知器接口
interface TaskNotifier {
  onTaskRunFinished(event: TaskRunEvent): Promise<void>
}

// 接入点
interface TaskExecutionContext {
  // ...
  notifier?: TaskNotifier  // 传 noopTaskNotifier 以外的实现即可激活
}
```

`executeTaskRun` 在每次任务运行结束（成功/失败/异常）后都会调用 `notifier.onTaskRunFinished()`，通知逻辑中的错误不会影响主流程。

**激活方式**：在 `cli.ts` 的 `createTaskScheduler(...)` 调用处传入 `notifier` 即可，无需改动调度器核心逻辑。

## 候选通知方案

### 方案 A — Web Console SSE 推送（推荐首选）

利用现有的 `TraceStreamHub` SSE 基础设施，新增一个任务通知频道。

- **实现位置**：`TraceStreamHub` 或独立的 `TaskEventBus`
- **前端**：Web Console 的定时任务页面订阅 `GET /v1/tasks/events`（SSE），收到事件后弹 Toast 或刷新列表
- **优点**：无需外部依赖，复用已有协议
- **缺点**：需要前端页面保持打开

新增端点：
```
GET /v1/tasks/events   — SSE stream，推送 TaskRunEvent
```

### 方案 B — Webhook 回调

任务创建时可指定 `webhookUrl`，任务完成后向该 URL POST `TaskRunEvent`。

- **实现位置**：`WebhookTaskNotifier`，实现 `TaskNotifier` 接口
- **适合场景**：与外部系统（Slack、企业微信、自建监控）集成
- **数据库变更**：`scheduled_tasks` 表需要加 `webhook_url TEXT` 列（新增 migration）

### 方案 C — 浏览器 Web Push Notifications

通过 Service Worker + Push API 在用户关闭页面时也能推送系统级通知。

- **依赖**：需要 VAPID 密钥、Service Worker、推送订阅持久化
- **复杂度**：高，适合后期实现

### 方案 D — 系统桌面通知（本地部署场景）

服务端通过 `osascript`（macOS）或 `notify-send`（Linux）发送桌面通知，适合本地运行场景。

- **实现简单**，但仅限服务端与客户端在同一台机器的场景

## 实现顺序建议

1. **方案 A**（SSE 推送）— 最小改动，利用已有基础设施，优先实现
2. **方案 B**（Webhook）— 实现 `WebhookTaskNotifier`，可与外部服务对接
3. **方案 C/D** — 按需求决定是否实现

## 实现方案 A 的最小步骤

1. ✅ 新建 `TaskEventBus`（task-event-bus.ts），实现 `TaskNotifier` 接口，广播给所有 SSE 客户端
2. ✅ 新增路由 `GET /v1/tasks/events`（SSE），客户端连接后加入 `TaskEventBus`
3. ✅ `cli.ts` 中把 `taskEventBus` 传给 `createTaskScheduler`，同时挂载 30s 心跳
4. ⏳ Web Console `TasksView.vue` 加 EventSource 订阅 `GET /v1/tasks/events`，收到 `task_run_finished` 事件后 Toast + 刷新列表

## 约束与注意事项

- `TaskNotifier.onTaskRunFinished` **不能抛出异常**，调用方已用 `.catch()` 包裹
- 通知内容不应包含敏感信息（如完整的 session messages）
- SSE 推送需考虑认证（通过 API Key query param 或 Cookie）
- Webhook 需要超时控制（建议 5s）和失败重试上限
