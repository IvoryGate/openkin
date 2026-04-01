# 003 Context Block Model And Budget Policy

## 目标

把第一层的上下文管理从“简单 history 数组”推进为更接近正式方案的 `ContextBlock` 模型，并补上首期最小预算裁剪策略。

## 本轮范围

- 定义 `ContextLayer` 与 `ProtectionLevel`
- 定义 `ContextBlock`
- 定义首期 `CompressionPolicy`
- 实现最小 `TrimCompressionPolicy`
- 让 `ContextManager` 在构建快照时应用预算裁剪
- 补上下文裁剪场景验证

## 本轮不做

- 不实现 LLM 摘要压缩
- 不实现外置存储与按需恢复
- 不引入长期记忆检索
- 不扩大 service / sdk / channel 功能面

## 验收标准

1. 第一层有正式 `ContextBlock` 模型
2. `ContextManager` 不再只是简单返回 `system + history`
3. 存在最小可运行的 `TrimCompressionPolicy`
4. `pnpm verify` 通过
5. 存在覆盖上下文裁剪的场景输出

## 验收结果

- **日期**：2026-04-02
- **`pnpm verify`**：已通过（`lint:docs`、`lint:architecture`、`lint:workspace`、`pnpm -r check`、`test:scenarios`）
- **实现位置**：`packages/core/src/context.ts`（`ContextBlock`、`TrimCompressionPolicy`、`SimpleContextManager` 与 `buildSnapshot` 预算路径）；`packages/core/src/run-engine.ts`（`RunState.maxPromptTokens`）；dev-console 场景 `context_budget_trim_preserves_system_and_recent`
