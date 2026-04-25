# 088 · Post-Core Later-Layer Architecture Roadmap

## 目标

把已经冻结的后半层设计（L4–L6）转换成可分波次实施的父级路线图，避免后续低能力模型在：

- context / memory / permission / approval
- local engineering product shell
- control plane / event plane
- single-agent completeness
- channel products
- plan / team / workflow

这些问题上各自做局部“看起来能跑”的实现。

本工单是 **父级路线图**，不是单次线性实现单。

---

## 上游权威文档

- `docs/architecture-docs-for-agent/ARCHITECTURE.md`
- `docs/architecture-docs-for-agent/LAYER_TAXONOMY.md`
- `docs/architecture-docs-for-agent/fourth-layer/CHANNEL_ADAPTER_COVERAGE.md`
- `docs/architecture-docs-for-agent/fourth-layer/ENGINEERING_PRODUCT_CAPABILITIES.md`
- `docs/architecture-docs-for-agent/fifth-layer/CLIENT_AND_CONTROL_PLANE.md`
- `docs/architecture-docs-for-agent/fifth-layer/EXTERNAL_SURFACES_CAPABILITIES.md`
- `docs/architecture-docs-for-agent/sixth-layer/APP_AND_ORCHESTRATION.md`
- `docs/architecture-docs-for-agent/sixth-layer/ORCHESTRATION_AND_APP_CAPABILITIES.md`
- `docs/architecture-docs-for-human/backend-plan/layer4-design/LAYER4_DESIGN.md`
- `docs/architecture-docs-for-human/backend-plan/layer5-design/LAYER5_DESIGN.md`
- `docs/architecture-docs-for-human/backend-plan/layer6-design/LAYER6_DESIGN.md`

---

## 不在本父单内直接完成的事

- 不直接实现某个真实 IM 平台
- 不一次性补完所有 Desktop / Web / CLI 产品差距
- 不在共享 contract 未冻结的前提下直接做复杂 team / workflow
- 不把单个 shell 中已经存在的局部 affordance 直接冒充为系统完成态

---

## 已登记但待拆分的能力簇

`L3 -> L4` 之间后续必须持续回看的能力登记，已收录在：

- `docs/architecture-docs-for-agent/fourth-layer/ENGINEERING_PRODUCT_CAPABILITIES.md`

当前明确登记的重点包括：

- reliable scheduler / cron / heartbeat
- unified event plane
- context engineering
- multi-layer compression
- layered memory system
- persona / identity / skill memory
- stronger built-in tooling
- dangerous command warning / approval safety
- onboarding / setup / discoverability
- multimodal product entry
- multi-surface continuity / remote control plane / channel access
- subagent / team / workflow / business app

---

## 分波次路线

### Wave A · L3 -> L4 Product Substrate

目标：先补齐第四层本地工程产品需要的服务与事件基建。

建议子方向：

1. event plane 统一
   - run / task / logs / future control-plane events 的稳定订阅基础
2. active/background run identity
   - attach / resume / interrupt / recover 的基础状态模型
3. descriptors
   - context / memory / approval / capability 的基础描述符
4. product-shell-facing snapshots
   - 让第四层能够做 context / memory / inspect / status 产品面

验收重点：

- 第四层不再只能靠临时壳层状态拼装完整产品体验

当前已落地的实施队列：

- 父单：`089_l3_product_substrate_parent.md`
- 子单：
  - `090_l3_run_identity_and_lifecycle.md`（✅ [`../completed/090_l3_run_identity_and_lifecycle.md`](../completed/090_l3_run_identity_and_lifecycle.md)）
  - `091_l3_unified_event_plane.md`（✅ [`../completed/091_l3_unified_event_plane.md`](../completed/091_l3_unified_event_plane.md)）
  - `092_l3_scheduler_reliability_and_heartbeat.md`（✅ [`../completed/092_l3_scheduler_reliability_and_heartbeat.md`](../completed/092_l3_scheduler_reliability_and_heartbeat.md)）
  - `093_l3_approval_and_danger_protocol.md`（✅ [`../completed/093_l3_approval_and_danger_protocol.md`](../completed/093_l3_approval_and_danger_protocol.md)）
  - `094_l3_context_memory_descriptors.md`（✅ [`../completed/094_l3_context_memory_descriptors.md`](../completed/094_l3_context_memory_descriptors.md)）
  - `095_l3_multimodal_contract.md`（✅ [`../completed/095_l3_multimodal_contract.md`](../completed/095_l3_multimodal_contract.md)）
  - `096_l3_tooling_exposure_and_introspection.md`（✅ [`../completed/096_l3_tooling_exposure_and_introspection.md`](../completed/096_l3_tooling_exposure_and_introspection.md)）

---

### Wave B · L4 Engineering Product Shell

目标：先让不依赖 channel / remote client 的 terminal-first 产品成立。

建议子方向：

1. context engineering UX
2. layered memory UX
3. permission / approval UX
4. background / resume / recover UX
5. single-agent `plan / review / execute`
6. TUI / CLI product shell polish

验收重点：

- 仅通过 CLI / TUI，用户就能得到完整工程产品能力

当前已登记的实施队列：

- 父单：[`098_l4_engineering_product_shell_parent.md`](./098_l4_engineering_product_shell_parent.md)
- 子单：
  - [`099_l4_product_control_plane_and_shell_map.md`](../completed/099_l4_product_control_plane_and_shell_map.md)（已归档）
  - [`100_l4_onboarding_setup_discoverability.md`](../completed/100_l4_onboarding_setup_discoverability.md)（已归档）
  - [`101_l4_context_engineering_surface.md`](../completed/101_l4_context_engineering_surface.md)（已归档）
  - [`102_l4_layered_memory_product_surface.md`](../completed/102_l4_layered_memory_product_surface.md)（已归档）
  - [`103_l4_permission_approval_product_flow.md`](../completed/103_l4_permission_approval_product_flow.md)（已归档）
  - [`104_l4_background_resume_recover.md`](../completed/104_l4_background_resume_recover.md)（已归档）
  - [`105_l4_single_agent_plan_review_execute.md`](../completed/105_l4_single_agent_plan_review_execute.md)（已归档）
  - [`106_l4_terminal_product_shell_polish.md`](../completed/106_l4_terminal_product_shell_polish.md)（已归档）

---

### Wave C · L5 External Surfaces And Channel Access

目标：把已经成立的本地产品能力外扩到更多入口。

建议子方向：

1. Web / Desktop / remote client continuity
2. remote control plane
3. account graph
4. pairing / allowlist / approval boundary
5. presence / delivery health
6. 一个代表性真实平台接入

验收重点：

- external surfaces / channel 复用的是同一套产品语义，而不是各自造一套

---

### Wave D · L6 Plan / Team / Workflow

目标：在 L4/L5 成立后，再推进多 agent 与高层编排。

建议子方向：

1. orchestrated plan artifact
2. review / revise
3. approve / execute
4. team / subagent / coordinator
5. workflow run / goal loop
6. business / scenario apps

验收重点：

- orchestration 只组合现有 contract，不要求底层理解业务编排对象

---

## 推荐排序原则

后续任何 later-layer 工单，默认按以下顺序判断是否可以立项：

1. 先问：这是 shell-only，还是 contract / control-plane 问题？
2. 若是本地完整产品问题，优先落到 Wave A / B
3. 若 single-agent completeness 还没补齐，不优先上 remote surface 或复杂 multi-agent feature
4. 若某能力同时影响 CLI / Web / Desktop / Channel，先确认它是 L4 产品语义，还是 L5 外扩问题

---

## 风险提醒

### 风险 1：external surfaces 早于本地产品

后果：

- Web / Desktop / channel 各自定义自己的 mode、approval、background 状态

约束：

- 先做 Wave A / B，再做 Wave C

### 风险 2：先做复杂 team，单 agent 仍不完整

后果：

- 多 agent demo 看起来强，但核心产品仍不可恢复、不可审批、不可追踪

约束：

- Wave B 必须先于 Wave D 成为主线

### 风险 3：真实平台接入早于第五层 continuity

后果：

- pairing、delivery、presence 与 approval continuity 语义散落在某个 adapter 内

约束：

- 真实平台应在 Wave C 的 account / presence / continuity 方向冻结后推进

---

## 当前结论

从本工单开始，后半层实施路线固定为：

1. 先补第三层到第四层之间的产品基建缺口
2. 再让第四层本地工程产品闭环成立
3. 再把这些能力外扩到第五层 external surfaces / channel
4. 最后再做第六层 plan / team / workflow

这条顺序的意义是：**先让一个 agent 作为本地工程产品真正可工作，再把它带到更多入口，最后再让很多 agent 协同工作。**
