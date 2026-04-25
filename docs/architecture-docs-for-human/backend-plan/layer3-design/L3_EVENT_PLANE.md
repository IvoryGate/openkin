# L3 · Unified event plane（091）

本文件是第三层**统一事件**的规范入口：与 **090 run identity** 配合，为 092+（调度、心跳）、093（审批）、094（memory）等增量事件提供**同一套**类型与包络，避免每增一路 SSE/ webhook 就发明一套新名词。

## 包络：`EventPlaneEnvelopeV1`

所有「平面」事件（可观测、可订阅、可对账）的公共形状在 `EventPlaneEnvelopeV1`（`packages/shared/contracts`）：

| 字段 | 说明 |
|------|------|
| `v` | 固定 `1`，未来若有不兼容换版再 bump |
| `domain` | 粗分域：`run` \| `task` \| `log` \| `approval` \| `heartbeat` \| `memory` |
| `kind` | 域内子类型，见下表 |
| `ts` | 事件时间（ms，通常服务端生成；日志行可取自原 JSON `ts`） |
| `subject` | 可过滤主体（`run` → `runId`；`task` → `taskId`/`runId`/`traceId` 等） |
| `payload` | 该事件携带的**具体** DTO 或子结构（域自定义） |
| `seq` | 可选；**单连接**内递增或游标，用于重连时「之后」的 best-effort 排序，**不**保证跨进程全序 |

**Wire（SSE）**：`formatSseEventPlaneV1` — `event:` 行 = `domain` 字符串；`data:` 行 = 完整 JSON 包络。解析辅助：`parseSseEventPlaneV1DataLines`。

## 各域 `kind` 与 transport（当前）

| domain | kind（示例） | 典型 payload | 传输 |
|--------|----------------|-------------|------|
| `run` | `message`, `text_delta`, `tool_call`, `tool_result`, `run_completed`, `run_failed` | `StreamEvent['payload']` 或等效；终态在 payload 中 | `GET /v1/runs/:traceId/stream` 仍为**既有**行内 `StreamEvent` JSON，避免破坏现网解析；**统一视图**在消费侧用 `streamEventToPlaneEnvelope` |
| `task` | `task_run_finished` | 完整 `TaskRunEventDto`（092 起必填 `runSource`：`schedule` \| `trigger` \| `retry`） | `GET /v1/tasks/events`：`data` = `EventPlaneEnvelopeV1`，`payload` = `TaskRunEventDto`；**Webhook** 仍直接 POST `TaskRunEventDto`（不包包络） |
| `log` | 与 `LogEntryDto.type` 相同或 `entry`（非 JSON 行时） | 结构化日志对象或 `{ raw: string }` | `GET /v1/logs/stream`：默认**旧**行协议；`?v=1` 时每行一 plane 包络（`domain: log`） |
| `approval` | `approval_requested`, `approval_resolved` | `ApprovalEventDto` | `GET /v1/approvals/events`：`data` = `EventPlaneEnvelopeV1`；详见 [L3_APPROVAL_DANGER.md](./L3_APPROVAL_DANGER.md) |
| `heartbeat` | *仍预留*（092 未以独立 SSE 域落地） | 运行面心跳/ staleness 的**首期**可观测在 `GET /v1/system/status` 的 `taskScheduler`（见 [L3_SCHEDULER_RELIABILITY.md](./L3_SCHEDULER_RELIABILITY.md)）；跨域 `heartbeat` 事件与 `seq` 组合待后续单 |
| `memory` | *预留 094* | TBD | TBD |

## Snapshot + stream（最小原则）

- **Snapshot**：`GET` 列表/详情 REST（如 sessions、traces、logs 历史）提供**可分页**的当前视图。
- **Stream**：SSE 等推送**之后**的增量与终态；**不**要求 stream 能独自重建完整世界状态，重启后以 snapshot 为准再 subscribe。

## 重连 / 恢复（最小保留位）

- 客户端可记 `ts` 与（若有）`seq`，重连后请求**新** snapshot 或从最后 `ts` 调带游标的 `GET`（若 API 支持）。
- Run 子流不保证全局 `seq`；长任务以 `RunId`（090）+ 终态查询为主。

## 与第四层、第五层关系

- 本单**不**规定终端 UI 如何展示事件；**不**将 event plane 扩张为 L5 remote continuity 的完整协议（见 091 升级条件）。
