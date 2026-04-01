# Reliability

## 目标

本文件记录 `openkin` 在探索过程中必须长期保持的可靠性边界。

这些边界不应只存在于讨论里，后续应逐步转化为：

- contract
- tests
- lint
- runtime guard

## Core Runtime 可靠性要求

1. 每次 `run()` 都必须有唯一 `traceId`
2. `RunState` 只能进入一个终态
3. `cancelled`、`budget_exhausted`、`failed` 必须明确区分
4. `systemPrompt` 与关键约束不得被压缩策略稀释
5. 工具调用失败必须标准化，不允许全部折叠成一种错误

## Service 层可靠性要求

1. 流式协议必须可恢复理解
2. 客户端取消请求必须可传播到运行时
3. 服务端错误返回必须映射到统一错误模型

## Channel 层可靠性要求

1. 每个账号都应有独立生命周期
2. adapter 崩溃不应污染其他账号实例
3. 入站消息标准化失败必须可观测
4. 出站发送失败必须能回传标准错误

## 首期要尽快机械化的规则

- `RunState.status` 状态流转约束
- `AbortSignal` 传播链路
- `maxSteps` / `timeoutMs` / `maxToolCalls` 的统一处理
- channel account 状态机约束

### 第一层已部分机械化（探索分支）

| 边界 | 机制 |
|------|------|
| 单次 `run` 单一终态、`finish` 不重复 | `assertRunNotYetFinished`（`packages/core/src/run-guards.ts`），架构 lint 要求 `run-engine` 引用 |
| `maxSteps` / `timeoutMs` / `maxToolCalls` | `ReActRunEngine` 主循环；scenarios：`budget_exhausted`、`failed_timeout`、`max_tool_calls_budget_exceeded` |
| `AbortSignal` | scenarios：`cancelled` |
| LLM 抛出结构化 `RunError`（如限流）可观测 | scenarios：`llm_rate_limit_surfaces_as_failed` |
