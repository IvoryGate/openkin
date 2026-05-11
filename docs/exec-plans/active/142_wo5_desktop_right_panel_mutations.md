# 142 · WO-5 右栏卡片操作接入

## 任务边界

本单只处理右栏卡片操作行为闭环：

- `采纳`
- `编辑`
- `暂存`

目标是从“仅 UI 按钮”升级为“可落服务端 mutation + 状态回流”。

## 影响范围

- `apps/desktop/renderer/components/right-panel/CandidateCard.js`
- `apps/desktop/renderer/components/right-panel/RightPanel.js`
- `apps/desktop/src/preload.ts`
- `packages/server/**`（必要时）
- `packages/shared/contracts/**`（必要时）

## 不做什么

- 不改右栏基础数据拉取策略（由 WO-4 负责）
- 不重构整个右栏组件层级
- 不引入复杂工作流审批系统

## 允许修改目录

- `apps/desktop/**`
- `packages/server/**`（必要时）
- `packages/shared/contracts/**`（必要时）
- `docs/exec-plans/active/**`

## 不允许修改目录

- `packages/sdk/**` 对外接口
- 与本单无关的运行引擎核心逻辑

## 实施步骤（单一路径）

1. 明确操作语义与后端 mutation 路由/命令映射。
2. Renderer 增加点击处理、loading/disabled 态、失败回滚。
3. 操作成功后刷新右栏数据，保证计数与筛选一致。

## 验收标准

- 三个按钮均有真实行为，不再是占位。
- 失败场景有可理解提示，且 UI 状态不脏写。
- `pnpm --filter @theworld/desktop check` 通过。
- `pnpm verify` 通过。

## 升级条件（命中即停）

- 无法在现有业务边界内定义动作语义。
- 需要大规模重做右栏数据模型。
- 连续两轮 `pnpm verify` 失败。
