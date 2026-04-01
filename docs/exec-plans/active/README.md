# Active Exec Plans

本目录用于存放当前进行中的执行计划。

## 当前队列（下一阶段）

### 第一层完成路径

默认顺序：

1. [`008_openai_compatible_llm_provider.md`](./008_openai_compatible_llm_provider.md) — OpenAI-compatible provider 最小闭环
2. [`009_first_layer_config_and_demo_runner.md`](./009_first_layer_config_and_demo_runner.md) — 第一层配置注入与真实 demo runner
3. [`010_first_layer_reliability_guards.md`](./010_first_layer_reliability_guards.md) — 第一层可靠性 guard 与回归约束
4. [`011_first_layer_real_provider_feedback_loop.md`](./011_first_layer_real_provider_feedback_loop.md) — 真实 provider 的非默认反馈回路
5. [`012_first_layer_readiness_closure.md`](./012_first_layer_readiness_closure.md) — 第一层完成态收口

### 跨层 contract 路径

跨层计划 **004–006** 已收口（见 [`../completed/README.md`](../completed/README.md)）。

已完成：[`004`](../completed/004_service_api_and_streaming_contract.md)（Service）、[`005`](../completed/005_client_sdk_v1_minimal.md)（Client SDK）、[`006`](../completed/006_channel_adapter_framework_contract.md)（Channel framework + mock）。

如果要打破默认顺序，必须先由 high-capability mode 明确说明为什么可以并行，以及额外的冲突控制方式。

已完成计划见 [`../completed/README.md`](../completed/README.md)。

---

每份计划建议只解决一个清晰增量，例如：

- monorepo 骨架
- shared contracts
- core runtime 最小闭环
- service streaming contract
- client SDK v1
- channel framework

每份计划建议包含：

1. 目标
2. 修改范围（含跨层影响与不做什么）
3. 验收标准
4. 决策记录
5. 允许修改目录 / 禁止修改目录
6. 必跑命令
7. 升级条件
