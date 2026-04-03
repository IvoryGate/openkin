# Active Exec Plans

本目录用于存放当前进行中的执行计划。

## 当前队列

| 编号 | 计划 | 状态 | 前置 |
|---|---|---|---|
| [`013`](./013_tool_and_integration_layer_v1.md) | Tool And Integration Layer v1（内置工具 + `docs/second-layer/` 建立） | 🟡 进行中 | `012` |
| [`014`](./014_mcp_tool_provider.md) | MCP Tool Provider（stdio + listChanged 动态更新） | ⏳ 待开始 | `013` |
| [`015`](./015_skill_framework.md) | Skill Framework（SKILL.md + 任意脚本 + list/read/run 三件套） | ⏳ 待开始 | `013`（建议先完成 `014`） |

新增计划时，将新文件放在本目录并在此 README 中登记队列与依赖。

### 历史：第一层完成路径（已收口）

已完成：[`007`](../completed/007_memory_ports_and_history_boundaries.md)–[`012`](../completed/012_first_layer_readiness_closure.md)（含 provider、demo、可靠性 guard、真实 provider 验收与本收口计划）。

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
