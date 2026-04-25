# 091 · L3 Unified Event Plane

## 目标

为第三层冻结统一事件模型与订阅语义，使 run / task / approval / heartbeat / log / memory 相关状态变化可以被一致消费。

## 背景

当前仓库已有：

- run stream SSE
- task events SSE
- log SSE

但还没有统一的 event plane 叙事。第四层和第五层后续若继续分别消费这些接口，容易形成多套状态词汇和恢复逻辑。

## 已冻结决策

1. 本单关注 **事件模型与订阅语义**，不关注第四层具体界面消费。
2. 不在本单重做 transport；首期继续优先复用现有 SSE 能力。
3. 不要求一次补齐所有事件源，但必须形成统一 taxonomy。
4. 新事件必须显式声明：
   - event type
   - payload shape
   - ordering / replay 预期
   - surface 归属

## 允许修改

- `packages/shared/contracts/src/`
- `packages/server/src/`
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
- `090_l3_run_identity_and_lifecycle.md`
- `docs/architecture-docs-for-agent/third-layer/THIRD_LAYER_COVERAGE.md`
- 现有 run / task / log SSE 相关 contracts 与 server routes

## 本轮范围

1. 冻结统一 event type taxonomy
2. 对齐 run / task / approval / heartbeat / log / memory-related events 的 payload 归属
3. 明确 snapshot + stream 的最小组合原则
4. 明确 replay / reconnect / resume 的最小语义保留位
5. 为后续 `092–095` 提供统一事件扩展点

## 本轮不做

- 不做第四层事件 UI
- 不做 Web / Desktop remote continuity
- 不做新的客户端产品协议
- 不做 websocket 重构

## 验收标准

1. 第三层文档能明确回答“当前系统有哪些统一事件类型”
2. 至少补充一条自动化验证，证明两个以上现有事件流已经按统一模型对齐
3. 后续 heartbeat、approval、memory descriptors 可以作为 event plane 增量挂入，不需重写 taxonomy
4. `pnpm check` 通过
5. `pnpm verify` 通过

## 必跑命令

```bash
pnpm check
pnpm verify
```

## 升级条件

1. 需要同时重排 run / task / log 的 transport 机制
2. 需要把 event plane 直接扩张成第五层 remote continuity contract
3. 现有事件源之间存在无法在 L3 内统一的核心语义冲突
4. `pnpm verify` 连续两轮不通过

---

## 验收记录

**状态**：已完成（2026-04-25）

- **Contract**：`EventPlaneDomain` / `EventPlaneSubject` / `EventPlaneEnvelopeV1`；`streamEventToPlaneEnvelope`、`taskRunEventToPlaneEnvelope`、`logEntryToPlaneEnvelope`、`formatSseEventPlaneV1`、`parseSseEventPlaneV1DataLines`、`isEventPlaneEnvelopeV1`
- **Run 流**：保持既有 `StreamEvent` wire；统一语义通过 `streamEventToPlaneEnvelope` 映射（不修改 `sdk/client`）
- **Task SSE**：`GET /v1/tasks/events` 的 `data` 改为 plane 包络（`event:` = `task`），`payload` 为 `TaskRunEventDto`；**Webhook 仍直传 DTO**
- **Log SSE**：`GET /v1/logs/stream?v=1` 发出 `domain: log` 的 plane 行；无 query 时行为不变
- **文档**：`L3_EVENT_PLANE.md`；`THIRD_LAYER_COVERAGE` / `LAYER3_DESIGN` 链入
- **自动化**：`scripts/test-event-plane.mjs`（`pnpm test:event-plane`）验证 **task + log** 两路 `v===1` 包络
- **Operator SDK**：重导出 `EventPlane*` 类型

父单 `089` 下一子单：**092 Scheduler Reliability And Heartbeat**。
