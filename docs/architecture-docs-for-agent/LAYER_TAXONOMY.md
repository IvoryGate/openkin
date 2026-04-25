# Layer Taxonomy

## 目标

本文件用于解决仓库中“第几层”口径漂移的问题。

当前仓库同时存在两套历史分层表达：

1. 早期 5 层后端规划
2. 当前 6 层全栈演进模型

如果不显式建立映射，后续文档会出现三种混乱：

1. “第四层”有时表示多 Agent 协作
2. “第四层”有时表示 Channel Framework
3. “完整产品能力”被误放到 channel / remote client 之后

## 当前权威口径

以后续设计、执行计划和实现收口为准，当前权威分层是 `[ARCHITECTURE.md](./ARCHITECTURE.md)` 中的 **6 层模型**：

1. `Core Runtime Layer`
2. `Tool And Integration Layer`
3. `Service And Protocol Layer`
4. `Engineering Product Shell`
5. `External Surfaces And Channel Access`
6. `App And Orchestration`

后续新增文档、执行计划和代码边界说明，默认都应使用这套编号。

## 历史口径映射

早期人类后端规划文档 `[../architecture-docs-for-human/backend-plan/AI_Agent_Backend_Tech_Plan.md](../architecture-docs-for-human/backend-plan/AI_Agent_Backend_Tech_Plan.md)` 使用的是偏后端视角的 5 层模型：


| 早期 5 层口径 | 当前 6 层口径中的对应位置 | 说明 |
|---|---|---|
| 第一层：通用 Agent 基础框架 | 第一层：`Core Runtime Layer` | 大体一致 |
| 第二层：工具生态与协议层 | 第二层：`Tool And Integration Layer` | 大体一致 |
| 第三层：服务化与工程能力层 | 第三层：`Service And Protocol Layer` + 第四层：`Engineering Product Shell` | 早期“服务化与工程能力”现在拆成服务底座与完整产品层两部分 |
| 第四层：多 Agent 协作层 | 第六层：`App And Orchestration` | 这是最容易混淆的漂移点 |
| 第五层：特化场景与智能进化层 | 第六层：`App And Orchestration` 的上层产品/场景延展 | 当前不再单独编号为一个基础架构层 |


## 为什么改成 6 层

当前模型把早期没有单独拉开的三个系统面独立出来：

1. **Engineering Product Shell**
   - 这是本次修正后的关键层
   - 表示不依赖 channel / remote client 也能成立的完整工程产品
   - `opencode` / `claudecode` 一类能力首先应在这里成立
2. **External Surfaces And Channel Access**
   - 把 Web / Desktop / SDK / channel adapter 都视为“对 L4 产品能力的外部化”
   - 外部接入不再反向定义完整产品语义
3. **App And Orchestration**
   - 明确把多 Agent、workflow、业务应用保留在最上层
   - 不再和“terminal-first 单 agent 产品层”混在一起

因此：

- 早期“第四层多 Agent 协作”在当前模型里不再是 L4
- 当前 L4 先固定为 `Engineering Product Shell`
- 当前 L5 再固定为 `External Surfaces And Channel Access`
- 多 Agent、workflow、产品编排统一放入 L6

## 使用规则

后续写文档时应遵守：

1. 如果写“第 N 层”，优先写完整英文层名，避免纯数字孤立出现。
2. 若引用早期 5 层文档，必须标明“这是历史 5 层编号”。
3. 若新文档讨论 terminal-first 单 agent 完整能力、CLI/TUI 产品闭环、context / memory / approval / background / resume，默认归入 **L4 Engineering Product Shell**。
4. 若新文档讨论 Web / Desktop / SDK / channel adapter / pairing / presence / multi-surface continuity，默认归入 **L5 External Surfaces And Channel Access**。
5. 若新文档讨论多 Agent、workflow、team、vertical app，默认归入 **L6 App And Orchestration**。

## 当前后半层权威文档

- L3：`[third-layer/THIRD_LAYER_COVERAGE.md](./third-layer/THIRD_LAYER_COVERAGE.md)`
- L4：`[fourth-layer/CHANNEL_ADAPTER_COVERAGE.md](./fourth-layer/CHANNEL_ADAPTER_COVERAGE.md)`
- L5：`[fifth-layer/CLIENT_AND_CONTROL_PLANE.md](./fifth-layer/CLIENT_AND_CONTROL_PLANE.md)`
- L6：`[sixth-layer/APP_AND_ORCHESTRATION.md](./sixth-layer/APP_AND_ORCHESTRATION.md)`

