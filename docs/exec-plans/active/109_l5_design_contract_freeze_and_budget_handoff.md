# 109 · L5 设计资产 contract 冻结与 budget 承接工单

> 状态：superseded（2026-04-27）。  
> 后续主路径：`110_l5_client_componentized_design_and_dev_workorders.md`。

## 问题边界

`108` 已冻结「先接 Figma MCP 再做 L5 原型」的入口，但尚未冻结 **L5 设计资产到实现前置阶段** 的跨层 contract，导致后续 budget 模型仍可能出现：

- 把设计文件组织问题误扩展为 SDK/API 改造
- 在未明确验收口径时并行推进多条路径（文档、Figma、实现混跑）
- 产出停留在聊天，没有形成可重复执行的工作单

本单目标是把 L5 当前阶段收口为：**仅冻结设计资产 contract 与执行回路，不进入客户端实现**。

## 取舍依据

- 依据 `AGENTS.md`：先冻结跨层 contract，再推进实现。
- 依据 `docs/index.md` 当前重点：L4/L5/L6 增量推进，不重写 L1/L3 基座。
- 依据 `MODEL_OPERATING_MODES`：高能力模式负责方向与边界，budget 模式只在冻结工作单内执行。

因此本单采用单一路径：**先文档化 contract + 自动化反馈口径，再交给 budget 模式做低风险执行。**

## 影响范围（多层）

- **L5 Client and Control Plane（直接影响）**
  - 冻结设计信息架构的页面结构、命名、尺寸和交付清单
  - 冻结 Figma 作为唯一设计资产输入源（当前阶段）
- **L4 Engineering Product Shell（间接影响）**
  - 通过文档验收与 `pnpm verify` 约束，确保产品壳层不被设计任务反向污染
- **L3 Service / L1 SDK（明确不改）**
  - 不新增 endpoint / event / DTO
  - 不调整 SDK 对外 contract 与 channel 生命周期协议

## 不做什么

- 不实现正式客户端 UI 代码
- 不引入 Pixso/Figma 双轨并行交付
- 不新增 MCP provider 类型或扩展服务端协议
- 不修改 `packages/` 下运行时、协议层、SDK 对外接口

## 最小可执行方案（单一路径）

1. 以 `OPENKIN_DESKTOP_APP_DESIGN_INFORMATION_ARCHITECTURE.md`（theworld 桌面端 IA 基线文档）作为 L5 设计资产组织基线。
2. 所有后续设计任务必须先满足该文档的页面/命名/尺寸约束，再进入评审。
3. budget 模型只允许做三类动作：
   - 文档一致性修复（命名、链接、状态字段）
   - 基于 `108` 的 Figma MCP 可观测验证与记录
   - 不触及跨层 contract 的脚本/校验补强
4. 每轮修改结束必须执行 `pnpm verify`，并在结果中明确：
   - 是否通过
   - 若失败，失败点是否触发升级条件

## 自动化约束与反馈回路

- **必跑命令**：`pnpm verify`
- **建议补充（若本轮仅文档改动）**：`pnpm lint:docs`
- **反馈模板（每轮）**：
  - 任务范围（是否仍在 `108/109` 边界内）
  - 修改文件列表
  - 验收命令结果
  - 是否命中升级条件

## budget 模式承接工作单（可直接复制）

```text
你当前处于 budget mode。

当前任务：
在 108/109 已冻结边界内，推进 L5 设计资产治理与 Figma MCP 可观测验证，不做实现层扩展。

任务范围：
- 允许修改目录：
  - docs/requirements/
  - docs/exec-plans/active/
  - docs/exec-plans/completed/
  - docs/governance/
  - workspace/（仅与 MCP 配置或校验脚本直接相关时）
- 不允许修改目录：
  - packages/（除非仅修复 verify 阻断且不改变 contract）
  - apps/（除非仅修复 verify 阻断且不改变 contract）

不做什么：
- 不新增/修改跨层 API、DTO、event
- 不修改 SDK 对外接口
- 不扩展到多设计平台并行
- 不实现正式客户端 UI 功能

验收标准：
- `pnpm verify` 通过
- 文档中明确写出影响范围与不做项
- 如涉及 Figma MCP，保留可观测验证记录（status/tools 可见性）

升级条件（命中任一立即停止并汇报）：
- 需要变更架构边界或新增跨层 contract
- 连续两轮无法通过 `pnpm verify`
- 需要修改计划外目录才能继续
- 需要在多个方案间做架构级取舍
```

## 验收标准

- 本文档存在并登记到 `docs/exec-plans/active/README.md`
- 本文档明确了多层影响范围与不做项
- 本轮产出可直接作为 budget 模式单一路径输入

