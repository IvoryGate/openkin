# 096 · L3 Tooling Exposure And Introspection

## 目标

在第三层补强面向产品壳与受信任运维面的工具能力暴露、自检与风险可见性，使当前工具系统更接近可工作的 agent substrate。

## 背景

用户明确指出当前内置工具强度还不够，且危险操作必须有明确提醒。

本单不试图一次补到外部 benchmark 的全部工具数量，而是聚焦第三层应该承担的两类问题：

1. 工具能力如何被稳定暴露给上层
2. 工具能力如何被观察、分类、解释和调试

## 已冻结决策

1. 本单优先做 **L3-facing exposure / introspection / descriptors**，不无限扩张到 L2 工具实现大全。
2. 新增工具如果必须进入本单，需明确其价值是“补 substrate 缺口”，不是“顺手再加一个 demo tool”。
3. 危险工具与危险命令的可见性必须和 `093` 对齐。
4. 不在本单内做第四层最终工具 UX。

## 允许修改

- `packages/shared/contracts/src/`
- `packages/server/src/`
- `packages/core/src/`（仅限工具状态只读暴露或必要的 provider metadata，不重写主工具体系）
- `packages/sdk/operator-client/src/`
- `scripts/`
- `docs/architecture-docs-for-agent/third-layer/`
- `docs/architecture-docs-for-human/backend-plan/layer3-design/`
- `docs/exec-plans/active/`
- 根 `package.json`（仅脚本）

## 禁止修改

- `packages/sdk/client/`
- `packages/channel-core/`
- `packages/cli/src/tui/`
- `apps/web-console/`
- 大规模重构 L2 工具架构

## 低能力模型执行前必须先读

- `AGENTS.md`
- `docs/index.md`
- `docs/governance/MODEL_OPERATING_MODES.md`
- `024_debug_and_introspection_api.md`
- `093_l3_approval_and_danger_protocol.md`
- 当前 tool runtime / introspection API / logs / skills 相关文件

## 本轮范围

1. 明确工具能力暴露 contract
2. 明确工具来源、风险级别、能力类别等 metadata 的观察面
3. 补强工具 / skill / provider 自检与发现路径
4. 为第四层工具产品体验提供稳定 substrate
5. 如需新增少量工具相关字段或 introspection 接口，必须保持 L3 边界清晰

## 本轮不做

- 不做 benchmark 级“大量新增工具”
- 不重做 L2 工具系统
- 不做第四层工具面板 UX
- 不做第五层 remote tool continuity

## 验收标准

1. 第三层能更明确回答“当前系统有哪些工具、它们来自哪里、风险如何”
2. 至少一条自动化验证覆盖 tool exposure / introspection / risk metadata
3. 与 `093` 的 danger / approval protocol 对齐
4. `pnpm check` 通过
5. `pnpm verify` 通过

## 必跑命令

```bash
pnpm check
pnpm verify
```

## 升级条件

1. 需要重写工具运行时主接口
2. 需要把大量 L2 工具新增工作塞进本单
3. 无法在不影响既有 tool contract 的前提下补 exposure metadata
4. `pnpm verify` 连续两轮不通过

## 关账与交付

- **Contract**：`ToolSurfaceCategoryDto`；`ToolEntryDto` 含可选 `riskClass`（`RiskClassDto`）、`category`（`ToolSurfaceCategoryDto`）。
- **服务**：`GET /v1/tools` 从 `ToolDefinition.metadata`（`surfaceCategory`、`riskClass`）合并；MCP 未声明 `surfaceCategory` 时默认 `category: mcp`。
- **Core**：主要内置工具已标注 `metadata`（`utility` / `filesystem` / `shell` / `skill` / `logs` / `workspace` 等；高危路径含 `riskClass`）。
- **operator-client**：`ToolSurfaceCategoryDto` 重导出。
- **自动化**：`test-introspection.mjs` 中断言 `run_command`、`write_file` 的 096 字段。
- **文档**：`THIRD_LAYER_COVERAGE.md`（096 节）、`L3_TOOLING_EXPOSURE.md`。

**`089` L3 substrate 子单 `090–096` 已齐**；后续以 `088` 路线图为父级、或新开 L4 工单。
