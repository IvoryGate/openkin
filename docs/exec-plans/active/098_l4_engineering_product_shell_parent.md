# 098 · L4 Engineering Product Shell Parent

## 目标

为 `L4 Engineering Product Shell` 建立一条严格串行的实施队列，供低能力模型顺序执行。

这组工单的目的不是继续扩展第三层 API，也不是提前做第五层 Web / Desktop / channel，而是把已经完成的 L3 substrate 组合成本地 terminal-first 工程产品能力。

## 上游权威文档

- `docs/architecture-docs-for-agent/fourth-layer/CHANNEL_ADAPTER_COVERAGE.md`
- `docs/architecture-docs-for-agent/fourth-layer/ENGINEERING_PRODUCT_CAPABILITIES.md`
- `docs/architecture-docs-for-human/backend-plan/layer4-design/LAYER4_DESIGN.md`
- `docs/architecture-docs-for-agent/third-layer/THIRD_LAYER_COVERAGE.md`
- `docs/exec-plans/active/088_post_core_later_layers_architecture_roadmap.md`
- `docs/exec-plans/active/089_l3_product_substrate_parent.md`
- `docs/governance/MODEL_OPERATING_MODES.md`

## 前置条件

`090`–`096` 已归档并验收，第三层已具备支撑第四层的基础 substrate：

- run identity / lifecycle
- unified event plane
- scheduler reliability / heartbeat
- approval / danger protocol
- context / memory descriptors
- multimodal contract
- tooling exposure / introspection

## 子工单顺序（冻结）

| 编号 | 链接 | 目标 |
|------|------|------|
| 099 | [Product control plane and shell map](../completed/099_l4_product_control_plane_and_shell_map.md)（✅ 已归档） | 冻结 L4 产品对象、控制面与 CLI/TUI surface map |
| 100 | [Onboarding setup discoverability](../completed/100_l4_onboarding_setup_discoverability.md)（✅ 已归档） | 首启、空态、配置、权限说明、工具/Skill 发现 |
| 101 | [Context engineering surface](../completed/101_l4_context_engineering_surface.md)（✅ 已归档） | 把 L3 context descriptors 产品化为 inspect / TUI 可见能力 |
| 102 | [Layered memory product surface](../completed/102_l4_layered_memory_product_surface.md)（✅ 已归档） | 定义并暴露本地 layered memory 产品面 |
| 103 | [Permission approval product flow](../completed/103_l4_permission_approval_product_flow.md)（✅ 已归档） | 把 L3 approval 协议组合成正式 CLI/TUI 产品流 |
| 104 | [Background resume recover](../completed/104_l4_background_resume_recover.md)（✅ 已归档） | 本地 background / attach / resume / interrupt / recover 工作流 |
| 105 | [Single-agent plan review execute](../completed/105_l4_single_agent_plan_review_execute.md)（✅ 已归档） | 单 agent plan / review / execute 工程流 |
| 106 | [Terminal product shell polish](../completed/106_l4_terminal_product_shell_polish.md)（✅ 已归档） | 在语义稳定后收口 CLI/TUI 产品壳体验 |

## 串行执行规则

1. 不并行做多个子单。
2. 若前一单未完成，不跳到后一单。
3. 若某子单触发升级条件，停止该单并回报，不私自把后续单内容提前吸入。
4. 后续子单若依赖前一单新增的 CLI/TUI 命令、状态对象或文档术语，应先以已完成子单为权威，不重新解释。

## 本批工单解决什么

本批工单主要解决这些 L4 产品问题：

- product shell object map
- onboarding / setup / discoverability
- context engineering product surface
- layered memory product surface
- permission / approval product flow
- background / resume / recover
- single-agent plan / review / execute
- terminal product shell polish

## 本批工单不做什么

明确不在 `098`–`106` 内做：

- L5 的 Web / Desktop / channel / remote continuity
- L6 的 subagent / team / workflow / business app
- 大规模重写 L3 shared contracts
- 大规模重写 `packages/core/` 主运行语义
- 在语义未冻结前继续做纯视觉 TUI 改造

## 低能力模型统一要求

每个子单开始前必须先读：

- `AGENTS.md`
- `docs/index.md`
- `docs/governance/MODEL_OPERATING_MODES.md`
- 当前子单文档
- `docs/architecture-docs-for-agent/fourth-layer/ENGINEERING_PRODUCT_CAPABILITIES.md`
- 与当前子单直接相关的 CLI / SDK / server / test 文件

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
2. 需要修改核心运行时主语义，而非组合 L3 substrate 成本地产品能力
3. 需要把某个 L4 本地产品语义提升为 L5 remote / channel contract
4. 需要新增或修改跨多个子单共享的公共 schema，但当前子单无法单独冻结
5. `pnpm verify` 连续两轮不通过

## 验收方式

每个子单完成后至少应：

1. 更新相关第四层文档状态
2. 补充对应 CLI / TUI / smoke / check
3. 跑子单要求的必跑命令
4. 保持 `pnpm verify` 通过

## 关账条件

当 `099`–`106` 全部完成后，表示第四层已具备不依赖 Web / Desktop / channel 的本地工程产品闭环。（**当前状态：`099`–`106` 均已归档验收。**）

这不代表第五层 external surfaces 或第六层 multi-agent orchestration 已完成。
