# 010 First Layer Reliability Guards

## 目标

把第一层尚未机械化的关键可靠性边界转化为 runtime guard、场景验证或轻量自动化约束，降低真实 provider 接入后的回归风险。

## 已冻结决策

### 可靠性来源

本计划只收口 `docs/RELIABILITY.md` 中已经声明的第一层边界，不新增新的架构目标。

### 优先项

首期只优先覆盖：

1. `RunState.status` 单终态约束
2. `AbortSignal` 传播行为
3. `maxSteps` / `timeoutMs` / `maxToolCalls` 的回归验证
4. 真实 provider 错误映射的可观测性

### 验证方式

- 优先复用现有 scenarios 或小范围 runtime guard
- 不要求引入新的大型测试框架

## 影响范围

| 层级 | 影响 |
|------|------|
| `packages/core` | 增加 guard、补全状态与错误边界 |
| `apps/dev-console` | 补充可靠性相关场景 |
| 脚本/文档 | 如有必要补充约束说明 |

## 允许修改的目录

- `packages/core/`
- `apps/dev-console/src/scenarios.ts`
- `docs/RELIABILITY.md`
- `docs/exec-plans/active/`
- `scripts/`

## 禁止修改的目录

- `packages/server/`
- `packages/sdk/`
- `packages/channel-core/`
- 与第一层可靠性无关的产品入口

## 本轮范围

- 为第一层关键状态与预算语义补 guard 或回归场景
- 明确真实 provider 下的错误映射可观测性
- 把有效的新约束写回文档或脚本

## 本轮不做

- 不处理 service 层取消传播
- 不处理 channel 账号状态机
- 不引入全新的通用测试平台

## 验收标准

1. `docs/RELIABILITY.md` 中列出的首期第一层边界至少有一批被机械化。
2. 新增回归场景或 guard 能覆盖终态、取消或预算中的关键路径。
3. `pnpm verify` 通过。

## 必跑命令

1. `pnpm verify`

## 升级条件

- 需要扩大成 service / SDK / channel 可靠性计划
- 需要重写 `RunEngine` 主循环而不是补 guard
- 连续两轮无法让 `pnpm verify` 通过

## 依赖与顺序

- **前置**：[`008`](./008_openai_compatible_llm_provider.md) 与 [`009`](./009_first_layer_config_and_demo_runner.md)
- **解锁**：[`011`](../active/011_first_layer_real_provider_feedback_loop.md)

## 验收结果

- **`finish` 单终态**：`packages/core/src/run-guards.ts` 中 `assertRunNotYetFinished`，`ReActRunEngine.finish` 首行调用；`scripts/lint-architecture.mjs` 要求 `run-engine.ts` 包含 `assertRunNotYetFinished`。
- **回归场景**（`apps/dev-console/src/scenarios.ts`）：`llm_rate_limit_surfaces_as_failed`（LLM 抛出 `LLM_RATE_LIMIT` 映射为 `failed` + 可观测 `error`）；`max_tool_calls_budget_exceeded`（`maxToolCalls: 1` 与连续工具调用 → `budget_exhausted` / `RUN_MAX_TOOL_CALLS_EXCEEDED`）。既有场景继续覆盖 `cancelled`、`budget_exhausted`、`failed_timeout` 等。
- **文档**：`docs/RELIABILITY.md` 增补「第一层已部分机械化」对照表。
