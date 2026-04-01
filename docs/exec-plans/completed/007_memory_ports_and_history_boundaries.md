# 007 Memory Ports And History Boundaries

## 目标

在 **Core Runtime Layer** 内冻结一个足够窄的 `MemoryPort` 扩展点，并明确 history 与 memory 的边界。

本计划只处理 core 内部的端口与上下文拼装顺序，不为 server / sdk / channel 新增公开 contract。

## 已冻结决策

### 边界规则

- `history` 继续表示会话内的原始消息链
- `memory` 只表示通过 `MemoryPort` 注入的摘要或提炼内容
- `memory` 不能替代 `history`
- `memory` 不能绕过既有 `ContextBlock` 与 `CompressionPolicy`

### 注入顺序

唯一允许的顺序是：

1. 从 `MemoryPort` 读取摘要型 memory
2. 把 memory 作为独立上下文段注入 prompt 构建
3. 再由既有 `CompressionPolicy` 统一裁剪

不允许把 memory 放到裁剪之后再偷偷拼回 prompt。

### 默认行为

- 无 memory 配置时，默认行为必须与当前完全一致
- 首期提供 `InMemoryMemoryPort` 或 no-op stub
- 不引入外部服务依赖

## 影响范围

| 层级 | 影响 |
|------|------|
| `packages/core` | 增加 memory 端口、stub、注入顺序与最小可观测行为 |
| `apps/dev-console` | 允许扩充 `src/scenarios.ts` 以证明 memory 对 prompt 构建有影响 |
| 文档 | 允许在 `docs/ARCHITECTURE.md` 补一段记忆边界说明 |

## 本轮范围

- 定义 `MemoryPort` 读写接口与调用时机
- 明确 history 与 memory 的归属边界
- 提供最小 no-op / in-memory 实现
- 用 `apps/dev-console/src/scenarios.ts` 或等价可观测路径证明 memory 注入会影响 prompt 构建

## 本轮不做

- 不实现向量检索、RAG pipeline、长期记忆检索
- 不引入数据库、向量库或其他外部依赖
- 不改变 003 已验收的 `ContextBlock` / `ProtectionLevel` / `TrimCompressionPolicy` 基本语义
- 不新增 server / sdk / channel 的 memory API

## 验收标准

1. Core 中存在可测试的 `MemoryPort` 扩展点，默认行为与当前无 memory 时一致。
2. 至少一个场景证明 memory 注入会影响 prompt 构建，且该证明可以通过现有 `pnpm verify` 路径观察到。
3. `pnpm verify` 通过。

## 验收结果

- **日期**：2026-04-02
- **`pnpm verify`**：已通过
- **实现位置**：
  - `packages/core/src/context.ts`：新增 `MemoryPort`、`NoopMemoryPort`、`InMemoryMemoryPort` 与 memory block 注入顺序
  - `packages/core/src/agent.ts`：允许 `OpenKinAgent` 透传 `SimpleContextManagerOptions`
  - `apps/dev-console/src/scenarios.ts`：新增 `memory_port_injects_summary_before_compression` 场景
  - `docs/ARCHITECTURE.md`：补充第一层记忆边界
  - `docs/QUALITY_SCORE.md`：同步 MemoryPort 与 feedback loop 状态

## 依赖与顺序

- **前置**：[`003`](./003_context_block_model_and_budget_policy.md)
- **后续解锁**：[`008`](./008_openai_compatible_llm_provider.md)
