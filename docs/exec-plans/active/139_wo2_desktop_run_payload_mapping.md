# 139 · WO-2 运行参数接入

## 任务边界

本单处理 Composer 工具栏状态到 `createRun` 请求体的映射：

- 模型选择
- network 开关
- full-control 开关
- 附件/图片占位输入

## 影响范围

- `apps/desktop/renderer/app.js`
- `apps/desktop/src/preload.ts`
- `apps/desktop/src/global.d.ts`
- `packages/shared/contracts/src/index.ts`（仅在确需补类型时）

## 不做什么

- 不做流式增量渲染
- 不做取消运行
- 不实现完整上传系统（附件可先以 `file_ref/image url` 最小闭环）

## 允许修改目录

- `apps/desktop/**`
- `packages/shared/contracts/**`（必要时）
- `docs/exec-plans/active/**`

## 不允许修改目录

- `packages/sdk/**` 对外接口
- 非 Desktop 相关应用目录

## 实施步骤（单一路径）

1. 扩展 `createRun` bridge 入参，允许携带 `agentId/model` 和 `attachments/executionMode` 等提示。
2. Renderer 在发送前组装 payload 并下发。
3. 不支持的组合在 UI 提示并降级处理（而不是静默丢弃）。

## 验收标准

- 工具栏状态可影响真实 run 请求。
- 请求失败时能给出明确错误。
- `pnpm --filter @theworld/desktop check` 通过。
- `pnpm verify` 通过。

## 升级条件（命中即停）

- 现有 `CreateRunRequest` 无法表达必要字段。
- 需要新增跨层协议但无法达成冻结。
- 连续两轮 `pnpm verify` 失败。
