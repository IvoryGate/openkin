# 012 First Layer Readiness Closure

## 目标

在 `007` 到 `011` 完成后，正式收口“第一层已经可交付”的文档、质量状态与执行计划目录，避免实现已完成但仓库记录系统仍停留在旧状态。

## 已冻结决策

### 收口性质

- 本计划只做文档、计划、质量状态与目录收口
- 不新增新的 runtime feature
- 不借机扩展到 service / SDK / channel 完成态

### 完成判定

只有在以下事实都成立时，才允许开始本计划：

1. `007` 已完成并归档
2. `008` provider 已完成
3. `009` demo runner 已完成
4. `010` reliability guards 已完成
5. `011` 真实 provider 反馈回路已完成

## 影响范围

| 层级 | 影响 |
|------|------|
| 文档 | 更新 `ARCHITECTURE`、`QUALITY_SCORE`、运行说明与相关入口文档 |
| 执行计划目录 | 把已完成计划从 `active/` 归档到 `completed/` |
| README 索引 | 保持 active/completed 索引与事实一致 |

## 允许修改的目录

- `docs/`
- `docs/exec-plans/active/`
- `docs/exec-plans/completed/`

## 禁止修改的目录

- `packages/core/`
- `packages/server/`
- `packages/sdk/`
- `packages/channel-core/`
- `apps/`

## 本轮范围

- 更新第一层完成状态的权威文档
- 同步质量分数、运行说明与计划索引
- 归档 `007` 到 `011`

## 本轮不做

- 不新增功能
- 不补写与实际实现不符的“完成”声明
- 不把未来跨层计划一并归档

## 验收标准

1. `docs/QUALITY_SCORE.md`、`docs/ARCHITECTURE.md` 与第一层实际完成度一致。
2. `active/` 与 `completed/` 的计划索引已同步。
3. 第一层真实运行方式在入口文档中可找到。
4. `pnpm verify` 通过。

## 必跑命令

1. `pnpm verify`

## 升级条件

- 发现 `007` 到 `011` 仍有未完成实现
- 发现“完整第一层”的验收边界需要重新定义
- 连续两轮无法让 `pnpm verify` 通过

## 依赖与顺序

- **前置**：[`011`](./011_first_layer_real_provider_feedback_loop.md)

## 验收结果

- **`QUALITY_SCORE.md`**：维度 2 / 6 / 7 与「第一层首期完成态」段落已与探索分支事实对齐（含 `verify`、scenarios、`test:first-layer-real`、非产品层范围说明）。
- **`ARCHITECTURE.md`**：Core Runtime 层补充首期 harness 收口说明与文档指针。
- **`index.md`**：`DEMO_FIRST_LAYER` 与「当前探索重点」已指向第一层验收与后续方向。
- **执行计划**：`012` 自 `active/` 移至本目录；`active/README.md` 标明当前无进行中的第一层队列；`007`–`011` 此前已在 `completed/`（本计划仅做索引与叙述一致）。
