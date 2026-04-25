# 089 · L3 Product Substrate Parent

## 目标

为 `L3 Service And Protocol` 到 `L4 Engineering Product Shell` 之间的 substrate 能力建立一条严格串行的实施队列，供低能力模型顺序执行。

这组工单的目的不是直接完成第四层产品壳，而是先补齐第四层成立所依赖的第三层基础 contract、事件、调度、审批、描述符与多模态协议。

## 上游权威文档

- `docs/architecture-docs-for-agent/third-layer/THIRD_LAYER_COVERAGE.md`
- `docs/architecture-docs-for-human/backend-plan/layer3-design/LAYER3_DESIGN.md`
- `docs/architecture-docs-for-agent/fourth-layer/ENGINEERING_PRODUCT_CAPABILITIES.md`
- `docs/exec-plans/active/088_post_core_later_layers_architecture_roadmap.md`
- `docs/governance/MODEL_OPERATING_MODES.md`

## 子工单顺序（冻结）

| 编号 | 链接 | 目标 |
|------|------|------|
| 090 | [Run Identity And Lifecycle](../completed/090_l3_run_identity_and_lifecycle.md)（✅ 已归档） | 冻结 foreground/background/resumable run 语义 |
| 091 | [Unified Event Plane](../completed/091_l3_unified_event_plane.md)（✅ 已归档） | 冻结统一事件模型与订阅语义 |
| 092 | [Scheduler Reliability And Heartbeat](../completed/092_l3_scheduler_reliability_and_heartbeat.md)（✅ 已归档） | 补齐可靠调度、恢复与 heartbeat |
| 093 | [Approval And Danger Protocol](../completed/093_l3_approval_and_danger_protocol.md)（✅ 已归档） | 冻结危险操作分类与审批协议 |
| 094 | [Context Memory Descriptors](../completed/094_l3_context_memory_descriptors.md)（✅ 已归档） | 暴露 context / compact / memory 观察面 |
| 095 | [Multimodal Contract](../completed/095_l3_multimodal_contract.md)（✅ 已归档） | 冻结附件与多模态消息/流协议 |
| 096 | [Tooling Exposure And Introspection](../completed/096_l3_tooling_exposure_and_introspection.md)（✅ 已归档） | 提升 L3 层工具能力暴露与自检 contract |

## 串行执行规则

1. 不并行做多个子单。
2. 若前一单未完成，不跳到后一单。
3. 若某子单触发升级条件，停止该单并回报，不私自把后续单内容提前吸入。
4. 后续子单若依赖前一单新增的 schema / event / DTO，应先以已完成子单为权威，不重新解释。

## 本批工单解决什么

本批工单主要解决这些 L3 substrate 问题：

- run / session identity
- unified event plane
- reliable scheduler / cron / once / interval
- heartbeat
- approval / danger protocol
- context / compact / memory descriptors
- multimodal contract
- product-grade tooling exposure

## 本批工单不做什么

明确不在 `089–096` 内做：

- L4 的 CLI/TUI onboarding、home shell、具体交互页面逻辑
- L4 的 layered memory 产品行为与 UX 细节
- L5 的 multi-surface continuity、remote control plane、channel account UX
- L6 的 subagent、team、workflow、business app
- 大规模重写 `packages/core/`

## 低能力模型统一要求

每个子单开始前必须先读：

- `AGENTS.md`
- `docs/index.md`
- `docs/governance/MODEL_OPERATING_MODES.md`
- 当前子单文档
- 与当前子单直接相关的实现文件

每个子单必须显式声明：

- 允许修改的目录 / 文件
- 禁止修改的目录 / 文件
- 本轮范围
- 本轮不做
- 验收标准
- 必跑命令
- 升级条件

## 升级条件（父级）

出现以下任一情况，应停止当前子单并升级到 high-capability mode：

1. 需要重排 L3 / L4 / L5 / L6 的层级边界
2. 需要修改核心运行时主语义，而非仅增加 service / protocol substrate
3. 需要把某个 operator / internal 能力提升为 client surface
4. 需要新增或修改跨多个子单共享的公共 schema，但当前子单无法单独冻结
5. `pnpm verify` 连续两轮不通过

## 验收方式

每个子单完成后至少应：

1. 更新相关第三层文档状态
2. 补充对应 smoke / check
3. 跑子单要求的必跑命令
4. 保持 `pnpm verify` 通过

## 关账条件

当 `090–096` 全部完成后，表示第三层已具备支撑第四层 terminal-first 工程产品进一步实现的基础 substrate，但不代表第四层产品本身已完成。
