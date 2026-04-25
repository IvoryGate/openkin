# 092 · L3 Scheduler Reliability And Heartbeat

## 目标

把第三层现有任务能力从“有 API”提升为“可依赖 substrate”，并补齐 heartbeat / staleness 基础能力。

## 背景

用户已明确指出：当前 task 系统虽然存在，但像“一分钟后执行的 once 任务未成功执行”这类问题说明它还不是完成态。

同样，heartbeat 目前尚未作为正式系统能力收口，而第四层后续需要：

- agent / scheduler / background session heartbeat
- stale / degraded detection
- 可靠的 task run history 与恢复语义

## 已冻结决策

1. 本单聚焦第三层 substrate 可靠性，不做第四层 task UX。
2. `once` / `cron` / `interval` 三类触发都必须被纳入同一可靠性叙事。
3. heartbeat 首期优先作为服务与事件基础能力，不直接扩展为多入口产品功能。
4. 本单可以补恢复、补偿、重试与状态事件，但不直接做 L4 background UI。

## 允许修改

- `packages/server/src/`
- `packages/shared/contracts/src/`
- `packages/sdk/operator-client/src/`
- `scripts/`
- `docs/architecture-docs-for-agent/third-layer/`
- `docs/architecture-docs-for-human/backend-plan/layer3-design/`
- `docs/exec-plans/active/`
- 根 `package.json`（仅脚本）

## 禁止修改

- `packages/core/src/`
- `packages/sdk/client/`
- `packages/channel-core/`
- `packages/cli/src/tui/`
- `apps/web-console/`

## 低能力模型执行前必须先读

- `AGENTS.md`
- `docs/index.md`
- `docs/governance/MODEL_OPERATING_MODES.md`
- `091_l3_unified_event_plane.md`
- 现有 scheduler / task / notifier / task test 相关文件

## 本轮范围

1. 明确并收口 `once` / `cron` / `interval` 的可靠执行语义
2. 明确重启恢复、missed window、retry / backoff、最大并发策略
3. 增加 heartbeat / stale / degraded 的基础 contract 与事件语义
4. 更新 task state events，使其能支撑后续第四层产品面
5. 用自动化验证证明至少一个 previously-fragile 调度路径已变可靠

## 本轮不做

- 不做第四层任务页面交互
- 不做 channel 通知
- 不做多 agent 调度
- 不做复杂 workflow scheduler

## 验收标准

1. `once` 任务可通过自动化验证可靠执行
2. task failure / retry / recovery 至少一条路径有自动化覆盖
3. heartbeat / staleness 基础语义被文档化并具备最小验证
4. `pnpm check` 通过
5. `pnpm verify` 通过

## 必跑命令

```bash
pnpm check
pnpm verify
```

## 升级条件

1. 需要重写整个 task scheduler 模型
2. 需要引入跨层 workflow / team scheduler
3. 需要新增复杂 DB schema 且超出本单可冻结范围
4. `pnpm verify` 连续两轮不通过

---

## 验收记录

**状态**：已完成（2026-04-16）

- **Contract**：`TaskRunSourceDto`；`TaskRunEventDto.runSource` 必填；`SystemStatusResponseBody.taskScheduler`（`active`、`tickIntervalMs`、`lastTickAt`、`lastDueCount`、`runningExecutions`、`maxConcurrent`、`stale`）
- **Server**：`gTaskScheduler` + `getTaskSchedulerView()`；`createTaskScheduler` 首 tick 立即执行；`THEWORLD_TASK_TICK_MS`（默认 2000ms，500–60k）；`onTaskRunFinished` 全路径带 `runSource`；`GET /v1/system/status` 合并 `taskScheduler`
- **Notifiers**：SSE / webhook DTO 含 `runSource`
- **文档**：`L3_SCHEDULER_RELIABILITY.md`；`L3_EVENT_PLANE.md`（task 行、`heartbeat` 行）；`LAYER3_DESIGN.md` 链入；`THIRD_LAYER_COVERAGE.md` 小节；023 段落 tick 表述更新
- **Operator SDK**：`TaskRunSourceDto` 重导出
- **自动化**：`test:scheduler`（once 调度后完成并 `enabled === false`）；`test:introspection`（`taskScheduler` / 非 stale）；`test:event-plane`（`runSource=trigger`）；`pnpm check` + `pnpm verify` 通过

**说明**：独立 `domain: heartbeat` SSE 与跨进程全序 heartbeat 仍预留；运行面 staleness 以 `taskScheduler.stale` + 人类文档为准。

父单 `089` 下一子单：**093 Approval and danger protocol**。
