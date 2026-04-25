# L4 Context Engineering Surface（101）

## 目标

在 **不** 改第一层压缩算法的前提下，使 L3 `ContextBuildReportDto` / `GET /v1/runs/:traceId/context` 在本地 **CLI** 与 **TUI** 可读、可对比、可自动化验收。

## 用户入口

| 入口 | 行为 |
|------|------|
| `theworld inspect context <traceId> [--json]` | 多步 **文本** 报告（`l4-context-view.ts`） |
| 行模式 `chat` 每轮结束后 | 灰字提示可执行 `theworld inspect context <traceId>`（`runChatStreamWithSink` 返回 `traceId`） |
| TUI 输入条上方 **Context rail** | 最近一轮跑完后拉取同 GET，**一行** 摘要（`formatContextHintOneLine`） |
| 聊天内 `/context` | 本会话**最近完成**的 run（`listSessionRuns` + `getRunContext`）整段报告 |

## 与 L3 的契约

- 权威 DTO 与路径仍以 **094 / THIRD_LAYER** 为准；无报告时 CLI 必须提示「当前进程无快照 / 老 trace / 需新跑一轮」等降级语义，见 `formatGetRunContextHuman`。

## 实现索引

- `packages/cli/src/l4-context-view.ts` — 共享格式化（CLI 全文 / TUI 单行）
- `packages/sdk/operator-client` — `getRunContext`
- `packages/cli/src/l4-product-map.ts` — `inspect:context`
- `pnpm test:l4-context` — 同 `test:context-descriptors` 的烟测 + CLI 子进程

## 变更流程

- 增删 L4 展示字段时，先核对 L3 DTO 再改 `l4-context-view` 与 `test:l4-context` 断言。

## 相关：分层记忆（102）

记忆向摘要与词表见 [`L4_LAYERED_MEMORY.md`](./L4_LAYERED_MEMORY.md)（同一 L3 GET；`l4-layered-memory.ts` 与 TUI rail 的 mem 段）。
