# 148 · Desktop 运行过程可视化（SSE / 工具 / 审批）

## 目标

在**不改后端契约**的前提下，桌面客户端订阅现有 `GET /v1/runs/:traceId/stream`，增量展示：

- 输出流（`text_delta`）
- 夹工具时的中间推理文本（`message`）
- 工具调用与结果（`tool_call` / `tool_result`）
- 运行中待审批项（轮询 `GET /v1/approvals`，按 `traceId` + `pending` 过滤）
- 结束后一次性兜底：`GET /v1/runs/:traceId` → `steps` 写入最后一条 assistant 消息的折叠摘要（SSE 漏事件时仍可回看）

## 实现要点

| 模块 | 变更 |
|------|------|
| [`apps/desktop/src/preload.ts`](../../apps/desktop/src/preload.ts) | `parseSseStream`、`parseSseStreamEvents`、`streamRunUntilTerminal`、`listApprovals`、`getRunTrace`；`waitRunTerminal` 改为空监听封装 |
| [`apps/desktop/src/global.d.ts`](../../apps/desktop/src/global.d.ts) | 暴露上述 API |
| [`apps/desktop/renderer/app.js`](../../apps/desktop/renderer/app.js) | 运行中 `__runProcess` 状态、事件处理、审批轮询、终态 `__traceSteps` 附着 |
| [`apps/desktop/renderer/styles.css`](../../apps/desktop/renderer/styles.css) | `.message-column`、`.run-process-*` 过程区样式 |

## 事件映射（StreamEvent）

- `text_delta` → 累加至「输出流」
- `message` → 「推理」卡片
- `tool_call` → 工具名 + 入参 JSON（路径类工具抽一行路径）
- `tool_result` → 结果/错误样式
- `run_completed` / `run_failed` → 流结束

## 不做什么（首版）

- 在桌面内执行 approve/deny（仅展示待审批；后续可接 `POST /v1/approvals/:id/approve`）
- 改 `StreamEvent` 类型或新增后端路由
- 右栏大改

## 验收

- [x] 含工具调用的 run 可在过程区看到调用与结果
- [x] 流式输出可见（长文截断防卡死）
- [x] 待审批时过程区出现「权限」提示
- [x] 结束后最后一条 assistant 可展开「运行过程（摘要）」
- [x] `pnpm verify` 通过

## 状态

与代码同步落地。
