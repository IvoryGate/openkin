# 099 · L4 Product Control Plane And Shell Map

## 目标

冻结第四层本地工程产品壳的对象、控制面与 CLI/TUI surface map，为后续 `100`–`106` 提供统一产品骨架。

本单先定义“有哪些产品面、状态从哪里来、命令如何归属”，不急于实现复杂 UX。

## 背景

`090`–`096` 已提供 L3 substrate，但当前 CLI/TUI 仍更像若干入口和聊天壳。第四层需要先有自己的产品对象：

- HomeShell
- ConversationShell
- InspectSurface
- TaskSurface
- LogsSurface
- SessionThreadSurface
- ProductControlPlane

## 已冻结决策

1. L4 product control plane 是本地产品语义，不是 L5 remote control plane。
2. 本单优先冻结 map / command taxonomy / state source，不做复杂视觉重写。
3. CLI 和 TUI 必须共享同一套产品对象名称，避免两套语义。
4. L3 API 只作为数据源，不在本单新增大型 L3 contract。

## 允许修改

- `packages/cli/src/`
- `packages/sdk/operator-client/src/`（仅限已有 L3 API 的本地消费 helper）
- `scripts/`
- `docs/architecture-docs-for-agent/fourth-layer/`
- `docs/architecture-docs-for-human/backend-plan/layer4-design/`
- `docs/exec-plans/active/`
- 根 `package.json`（仅脚本）

## 禁止修改

- `packages/sdk/client/`
- `packages/channel-core/`
- `apps/web-console/`
- L5 / L6 设计文档
- 大规模重写 `packages/core/`
- 新增 channel / remote continuity 语义

## 低能力模型执行前必须先读

- `AGENTS.md`
- `docs/index.md`
- `docs/governance/MODEL_OPERATING_MODES.md`
- `098_l4_engineering_product_shell_parent.md`
- `docs/architecture-docs-for-agent/fourth-layer/ENGINEERING_PRODUCT_CAPABILITIES.md`
- 当前 CLI help / command / TUI 入口相关文件

## 本轮范围

1. 定义 L4 product surfaces 与职责边界。
2. 梳理现有 CLI/TUI 命令到 product surfaces 的映射。
3. 定义 ProductControlPlane 的本地状态来源：session、run、context、approval、tool、task、log。
4. 补充最小 CLI/TUI smoke 或快照测试，证明 map 不漂移。
5. 更新第四层文档，作为后续子单引用的权威词汇。

## 本轮不做

- 不做 onboarding 流程。
- 不做 context / memory / approval 的具体产品 UI。
- 不做 background / recover 实现。
- 不做 visual polish。
- 不做 L5 remote control plane。

## 验收标准

1. 第四层文档能明确回答“本地产品壳有哪些 surface”。
2. CLI/TUI 命令、help 或内部 registry 能映射到这些 surface。
3. 后续 `100`–`106` 可直接引用本单定义的产品对象。
4. `pnpm check` 通过。
5. `pnpm verify` 通过。

## 必跑命令

```bash
pnpm check
pnpm verify
```

## 升级条件

1. 需要新增 L3 shared schema 才能完成本单。
2. 需要把 L4 control plane 提升为 L5 remote contract。
3. CLI/TUI 现有入口无法在不大改架构的前提下建立统一 map。
4. `pnpm verify` 连续两轮不通过。

## 关账与交付

- 权威表：`docs/architecture-docs-for-agent/fourth-layer/L4_PRODUCT_SHELL_MAP.md`
- 人类向：`docs/architecture-docs-for-human/backend-plan/layer4-design/L4_PRODUCT_CONTROL_PLANE.md`；`LAYER4_DESIGN.md` 已链到上述与 099
- 实现 + 漂移测：`packages/cli/src/l4-product-map.ts`（`L4_KNOWN_CLI_VERBS` 为 `index.ts` 动词条目唯一来源）、`scripts/test-l4-shell-map.ts` · `pnpm test:l4-shell-map`（已并入 `verify`）
- 入口帮助：`theworld help` 根 help 中提示 `l4-product-map` 与 L4 文档路径
- `docs/index.md` 推荐阅读与「核心文档」表已收编 L4 map

**下一子单：[`100`](../active/100_l4_onboarding_setup_discoverability.md).**
