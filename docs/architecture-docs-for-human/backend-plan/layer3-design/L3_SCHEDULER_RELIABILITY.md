# L3 · Scheduler reliability and heartbeat（092）

本文件冻结第三层**进程内任务调度器**的可依赖语义、事件补充字段，以及**最小**可观测/ staleness 面（为后续 L4+ 的 heartbeat 与 degraded 检测打底）。

与 [L3_EVENT_PLANE.md](./L3_EVENT_PLANE.md) 配合：`task` 域的 `TaskRunEventDto` 在 092 起携带 `runSource`。

## 调度 tick 与环境变量

- **`THEWORLD_TASK_TICK_MS`**：调度主循环周期（ms），**默认 `2000`**，实现侧 clamp 在 **500–60000**。
- **`THEWORLD_TASK_MAX_CONCURRENT`**：同 tick 内允许并行执行的上限（与 023 一致，具体数值以 `scheduler` 实现为准）。
- **`THEWORLD_TASK_MAX_RETRIES`**：单次排程失败后的重试次数上限（与 023 一致）。

调度器在启动时注册 interval 后**立即**执行一次 `tick()`，避免“刚写好的 once 在首个整点 tick 前长时间不跑”的脆弱性。

## 可观测快照：`GET /v1/system/status` → `taskScheduler`

`SystemStatusResponseBody` 可包含可选字段 `taskScheduler`（进程内视图，**非**跨副本真理源）：

| 字段 | 说明 |
|------|------|
| `active` | 当前进程是否已挂载并运行调度循环 |
| `tickIntervalMs` | 实际使用的 tick 周期（与 `THEWORLD_TASK_TICK_MS` 解析结果一致） |
| `lastTickAt` | 上次 `tick` 完成时间（ms）；未跑过为 `0` |
| `lastDueCount` | 上次 tick 中进入 due 窗口的任务数（观测用） |
| `runningExecutions` | 当前正在执行中的任务 run 数 |
| `maxConcurrent` | 配置的最大并发 |
| `stale` | `active && (now - lastTickAt > 3 * tickIntervalMs)`，用于**粗粒度**检测“调度循环疑似卡住或进程无响应” |

`stale` 是启发式：短暂停或 GC 尖峰可能误报，长期 `true` 应配合日志与进程健康一起判断。

## `runSource`（`TaskRunEventDto`）

`TaskRunSourceDto` = `'schedule' | 'trigger' | 'retry'`：

- **`schedule`**：由调度器按 `cron` / `once` / `interval` 自然触发
- **`trigger`**：由 `POST .../trigger` 等**手动/即时**入口触发
- **`retry`**：同一次排程在失败重试路径上再次执行（与首次 `schedule` 区分，便于对账与告警）

任务完成事件（SSE `GET /v1/tasks/events`、Webhook body）中均携带与 contract 一致的 `runSource`。

## 自动化

- `pnpm test:scheduler`：含 **once** 在约定期附近执行、完成后**自动 disabled** 的路径
- `pnpm test:introspection`：校验 `taskScheduler` 存在且 `stale === false` 等
- `pnpm test:event-plane`：校验 task 域 payload 含预期 `runSource`

## 092 未收口（显式留到后续单）

- 跨进程序列号 / 全序 heartbeat 事件域（`EventPlaneEnvelopeV1` 的 `domain: heartbeat` 仍可为预留）
- 第四层任务 UI 与多入口产品化心跳

父单 `089`：`093` 已收录审批协议；见 [L3_APPROVAL_DANGER.md](./L3_APPROVAL_DANGER.md)。下一 substrate 子单以 `089` 队列为准。
