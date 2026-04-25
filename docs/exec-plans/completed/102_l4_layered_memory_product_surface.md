# 102 · L4 Layered Memory Product Surface

## 目标

定义并实现本地 layered memory 的首期产品 surface，让用户能理解当前会话和工作区中哪些信息被记住、总结、引用或忽略。

本单不一次性完成完整长期记忆系统，而是先冻结 L4 产品叙事和本地可见操作面。

## 背景

当前已有 L1 `MemoryPort` 与 L3 memory descriptors，但仍缺少产品层记忆模型：

- working memory
- session memory
- session summary memory
- workspace memory
- persona / identity memory
- skill memory
- retrieval / long-term memory

## 已冻结决策

1. 本单优先做产品 surface 与本地操作语义，不把完整 memory engine 塞进 L3。
2. 首期可以将部分层定义为只读 / planned，只要边界明确。
3. 记忆来源、生命周期、隔离边界必须可见。
4. CLI/TUI 表达应复用 `101` 的 context engineering summary，而不是另造一套。

## 允许修改

- `packages/cli/src/`
- `packages/sdk/operator-client/src/`（仅限消费已有 L3 descriptors）
- `scripts/`
- `docs/architecture-docs-for-agent/fourth-layer/`
- `docs/architecture-docs-for-human/backend-plan/layer4-design/`
- `docs/exec-plans/active/`
- 根 `package.json`（仅脚本）

## 禁止修改

- 大规模重写 `packages/core/src/` memory / context 主算法
- 新增复杂持久化 schema（除非升级并重新冻结）
- `packages/sdk/client/`
- `packages/channel-core/`
- L5 remote memory continuity
- L6 team memory / workflow memory

## 低能力模型执行前必须先读

- `AGENTS.md`
- `docs/index.md`
- `docs/governance/MODEL_OPERATING_MODES.md`
- [`098`](../active/098_l4_engineering_product_shell_parent.md)
- [`101`](../completed/101_l4_context_engineering_surface.md)
- `094_l3_context_memory_descriptors.md`
- `docs/architecture-docs-for-agent/fourth-layer/ENGINEERING_PRODUCT_CAPABILITIES.md`

## 本轮范围

1. 冻结 L4 layered memory taxonomy 与每层状态：implemented / read-only / planned。
2. 增加本地 memory inspect surface，展示来源、生命周期、隔离边界。
3. 为 save / pin / ignore / summarize 设计最小命令语义；若无法安全实现，明确 postponed。
4. 将 session memory 与 context descriptors 连接到同一产品叙事。
5. 增加自动化验证覆盖 memory surface 或 docs/schema consistency。

## 本轮不做

- 不做完整向量检索。
- 不做云端长期记忆。
- 不做跨设备 memory sync。
- 不做 persona 产品流终态。
- 不做多 agent / team memory。

## 验收标准

1. 第四层文档能明确列出 layered memory taxonomy。
2. 本地 CLI/TUI 至少能 inspect 当前可用 memory contribution。
3. 未实现的 memory 层有明确 planned 状态，不冒充已完成。
4. 后续 L4 子单可引用统一 memory vocabulary。
5. `pnpm check` 通过。
6. `pnpm verify` 通过。

## 必跑命令

```bash
pnpm check
pnpm verify
```

## 升级条件

1. 需要新增长期记忆存储 schema。
2. 需要引入 retrieval / embedding / vector store。
3. 需要改变 L1 memory 主接口。
4. `pnpm verify` 连续两轮不通过。

---

## 关账与交付

- 登记表：`docs/architecture-docs-for-agent/fourth-layer/L4_LAYERED_MEMORY.md`；人类向：`docs/architecture-docs-for-human/backend-plan/layer4-design/L4_LAYERED_MEMORY.md`；`ENGINEERING_PRODUCT_CAPABILITIES` §Layered Memory 指针
- CLI：`l4-layered-memory.ts`（`L4_LAYERED_MEMORY_TAXONOMY`、`formatGetRunContextMemoryHuman`、`formatL4ContextAndMemoryRailLine`）；`theworld inspect memory`（无参 taxonomy / 有参 per-run）；行模式 `chat` 后灰字 `inspect memory`；斜杠 `/memory`；help 行
- TUI：context rail 使用 101+102 合并单行（仍一次 `getRunContext`）
- `l4-product-map.ts`：`inspect:memory`、`slash:/memory`（`entries=35`）
- 自动化：`pnpm test:l4-memory`（已并入 `verify`）
- 推迟：`save` / `pin` / `ignore` / `summarize` 作为独立产品动词在 CLI 输出与 taxonomy 中明确 postponed；`/compact` 与 L3 报告仍用

**下一子单：[`104`](./104_l4_background_resume_recover.md).**（`103` 已归档：[`./103_l4_permission_approval_product_flow.md`](./103_l4_permission_approval_product_flow.md)。）
