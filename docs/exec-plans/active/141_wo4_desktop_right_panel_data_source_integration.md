# 141 · WO-4 右栏数据源接入

## 任务边界

本单把右栏从 mock 数据切换到真实数据源：

- 最近整理结果
- 抽屉区（冻结项）
- 底部摘要与 heartbeat 时间

## 影响范围

- `apps/desktop/renderer/components/right-panel/**`
- `apps/desktop/renderer/app.js`（如需共享状态）
- `apps/desktop/src/preload.ts`
- `packages/server/**` 与 `packages/shared/contracts/**`（仅在现有接口不足时）

## 不做什么

- 不在本单处理卡片操作 mutation（留给 WO-5）
- 不做右栏视觉新一轮改版
- 不引入与右栏无关的新业务域

## 允许修改目录

- `apps/desktop/**`
- `packages/server/**`（必要时）
- `packages/shared/contracts/**`（必要时）
- `docs/exec-plans/active/**`

## 不允许修改目录

- `packages/sdk/**` 对外接口
- 与本单无关的多端 UI 工程目录

## 实施步骤（单一路径）

1. 盘点复用现有接口；若不足，先最小补接口再接 renderer。
2. 右栏加载改为异步拉取 + 空态/错误态。
3. 移除对 `mockData.js` 的运行时依赖（可保留开发 fallback）。

## 验收标准

- 切换会话时右栏数据与会话上下文一致。
- 网络异常时右栏可降级显示且不影响主会话发送。
- `pnpm --filter @theworld/desktop check` 通过。
- `pnpm verify` 通过。

## 升级条件（命中即停）

- 需要设计全新业务模型才能表达右栏数据。
- 接口补齐将影响既有 SDK 对外 contract。
- 连续两轮 `pnpm verify` 失败。
