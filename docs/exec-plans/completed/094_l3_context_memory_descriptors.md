# 094 · L3 Context Memory Descriptors

## 目标

在第三层暴露后续第四层所需的 context / compact / memory 观察面与 descriptors，使上下文工程和多层记忆系统不再只是内部机制。

## 背景

用户明确要求：

- 上下文管理必须成为工程能力
- 要有多层压缩策略
- 要设计多层记忆系统
- 后续要支持 persona / identity / skill memory

本单不直接完成第四层的最终产品行为，但必须先让第三层提供“可被观察、可被展示、可被后续扩展”的基础描述符。

## 已冻结决策

1. 本单做 **descriptors / snapshots / event-facing metadata**，不做第四层最终 UX。
2. 不在本单内直接实现完整 layered memory system。
3. 允许为后续 persona / identity / skill memory 保留来源字段，但不直接把完整策略塞进第三层。
4. compact / memory 暴露应优先保证“可解释”，不追求一次到位的精确 token 统计终态。

## 允许修改

- `packages/shared/contracts/src/`
- `packages/server/src/`
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
- 直接重写 `packages/core/` 的 context / memory 算法终态

## 低能力模型执行前必须先读

- `AGENTS.md`
- `docs/index.md`
- `docs/governance/MODEL_OPERATING_MODES.md`
- `docs/architecture-docs-for-agent/fourth-layer/ENGINEERING_PRODUCT_CAPABILITIES.md`
- 第一层 memory / context 相关文档与当前 server introspection 相关文件

## 本轮范围

1. 明确 context usage descriptor
2. 明确 compact boundary / compact summary descriptor
3. 明确 memory contribution descriptor
4. 为 system / workspace / session / persona / skill 来源预留表达位
5. 让这些 descriptor 可通过第三层查询或事件被观察

## 本轮不做

- 不做第四层 context UI
- 不做 layered memory 写入 / 召回策略终态
- 不做 persona 产品流
- 不做 identity / skill memory 具体行为

## 验收标准

1. 第三层文档明确列出新增 descriptors 的作用
2. 至少一条自动化验证证明 compact 或 memory source 可被第三层观察
3. 后续第四层可直接基于这些 descriptors 做 context engineering 产品面
4. `pnpm check` 通过
5. `pnpm verify` 通过

## 必跑命令

```bash
pnpm check
pnpm verify
```

## 升级条件

1. 需要直接重构第一层 context / memory 主算法
2. 需要把完整 layered memory 策略一次性塞进第三层
3. persona / skill / identity memory 的边界在本单内无法稳定表达
4. `pnpm verify` 连续两轮不通过

---

## 验收记录

**状态**：已完成（2026-04-16）

- **说明**：在 **不重写** `TrimCompressionPolicy` / MemoryPort 主语义的前提下，增加只读 `describePromptBuild` 与 `onPromptAssembled` 观察点，符合本单对 core 的约束。
- **Contract**：`ContextBlock*Dto`、`ContextCompactDescriptorDto`、`MemorySourceKindDto`、`MemoryContributionDescriptorDto`、`ContextBuildReportDto`、`GetRunContextResponseBody`；`CreateRunRequest.maxPromptTokens?`；`apiPathRunContext`。
- **Core**：`HookRunner.onPromptAssembled`；`ReActRunEngine` 在 `beforeLLMCall` 前调用；`SimpleContextManager.describePromptBuild`；`TheWorldAgent.getSessionRuntime`。
- **Server**：`context-build-hook.ts` + `contextBuildByTrace`；`GET /v1/runs/:traceId/context`；`contextHook` 置于 hooks 首项。
- **Operator SDK**：`ContextBuildReportDto` 等类型与 `apiPathRunContext` 重导出。
- **文档**：`L3_CONTEXT_MEMORY_DESCRIPTORS.md`；`THIRD_LAYER_COVERAGE` / `LAYER3_DESIGN`。
- **自动化**：`pnpm test:context-descriptors`（`memory` 层 + `sourceKind: 'session'`；可选 `history` 被丢弃时的 compact 断言）。

父单 `089` 下一子单：**095 Multimodal contract**。
