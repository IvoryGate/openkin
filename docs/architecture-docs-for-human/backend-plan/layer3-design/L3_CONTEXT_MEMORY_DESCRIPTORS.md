# L3 · Context and memory descriptors（094）

本文件说明第三层如何暴露 **prompt 组块（blocks）**、**压缩（trim）前后** 与 **MemoryPort 贡献** 的可解释描述符，供第四层做 context engineering 与记忆产品面，**不**规定完整 layered memory 写入/召回终态。

## 与第一层的关系

- 第一层 `SimpleContextManager` 将上下文拆为 `ContextBlock`：`system` / `memory` / `history` / `recent`（见 `packages/core` `context.ts`），压缩策略为 `TrimCompressionPolicy`（可压缩块为 `history`）。
- 094 在**不**改写上述算法的前提下，通过 `describePromptBuild` 输出与 contract 一致的 **DTO 快照**。

## Contract DTO

| 类型 | 作用 |
|------|------|
| `ContextBlockDescriptorDto` | 每个逻辑块 `id`、层、保护级、条数、≈token、是否进入当步 prompt |
| `ContextCompactDescriptorDto` | `maxPromptTokens`、压缩前后总估算 token、被丢块 id 与丢掉的 token 和 |
| `MemoryContributionDescriptorDto` | `sourceKind`（`session` 等预留枚举）、由 MemoryPort 汇总的条数与 token；当前实现固定 `sourceKind: 'session'`、label `MemoryPort` |
| `ContextBuildReportDto` | 单步 LLM 前组装结果：`stepIndex`、各类块、`memoryContributions`、`assembledMessageCount` 等 |
| `GetRunContextResponseBody` | `{ steps: ContextBuildReportDto[] }` — 多步时一步一条 |

`MemorySourceKindDto` 预留 `workspace` / `persona` / `skill` 等，供后续专用端口或策略接入，不在本单写死产品行为。

## 运行时钩子

- 第一层 `onPromptAssembled(state, messages)` 在 `buildSnapshot` 之后、各 `onBeforeLLMCall` 变形 **之前** 调用，只读、不得破坏主路径。
- 服务层在 `onPromptAssembled` 中调用 `SimpleContextManager.describePromptBuild` 并写入进程内表。

## API

- **`GET /v1/runs/:traceId/context`**：返回当次 trace 在**当前进程**内已采集的 `steps`；重启后为空。不替代 `GET /v1/runs/:traceId` 的 trace 持久化体。
- **`POST /v1/runs`** 请求体可选 **`maxPromptTokens`**（与 `RunState.maxPromptTokens` 一致），用于压测/验收压缩是否丢弃 `history` 块。

## 验收

- `pnpm test:context-descriptors`：多轮 run 后校验 `context` 中含 `system`/`memory`/`history`/`recent` 与 `memoryContributions[0].sourceKind === 'session'`。

父单 `089` 下一子单：**095 Multimodal contract**（以 `089` 队列为准）。
