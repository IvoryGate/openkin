# 140 · WO-3 流式渲染与取消接入

## 任务边界

本单将运行体验从“终态轮询”升级到“增量反馈 + 可取消”：

- 对 `GET /v1/runs/:traceId/stream` 的 SSE 增量消费与 UI 更新
- `POST /v1/runs/:traceId/cancel` 的用户可触发取消

## 影响范围

- `apps/desktop/src/preload.ts`
- `apps/desktop/src/global.d.ts`
- `apps/desktop/renderer/app.js`

## 不做什么

- 不新增 run 状态类型
- 不修改服务端已有 cancel 语义
- 不在本单重构消息存储结构

## 允许修改目录

- `apps/desktop/**`
- `docs/exec-plans/active/**`

## 不允许修改目录

- `packages/shared/contracts/**`（除非确需补已存在字段的类型暴露）
- `packages/server/**`（本单默认不改）

## 实施步骤（单一路径）

1. preload 提供 SSE 消费器（解析 `text_delta`/`tool_*`/`run_*`）。
2. Renderer 在 run 期间接收增量并实时刷新气泡/过程区。
3. Busy 态提供取消按钮，触发 cancel API，并处理已取消后的收尾状态。

## 验收标准

- 发送后可看到逐步输出，而非仅终态刷新。
- 取消按钮可用，取消后状态一致且不反弹。
- `pnpm --filter @theworld/desktop check` 通过。
- `pnpm verify` 通过。

## 升级条件（命中即停）

- SSE 事件与 contract 形态不一致。
- 取消与终态竞争导致状态机无法收敛。
- 连续两轮 `pnpm verify` 失败。
