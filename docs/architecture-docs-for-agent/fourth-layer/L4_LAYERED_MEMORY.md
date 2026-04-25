# L4 Layered Memory Surface（102）

## 目标

在 **不** 改 L1 `MemoryPort` 主实现、不引入检索/向量/云端的前提下，把「分层记忆」从名词变成 **可对照 L3 报告** 的本地产品面：词表、状态（implemented / read-only / planned）、`inspect` / 斜杠入口与 TUI 与 101 同一 GET 的摘要。

## 与 101 的关系

- 权威观测仍来自 L3 `GET /v1/runs/:traceId/context`（`ContextBuildReportDto` 中的 `memory` layer 与 `memoryContributions`）。
- 101 负责**完整**上下文工程叙事；本文件负责**记忆分层词表**与以记忆为视图的 CLI/TUI 片段。

## 用户入口

| 入口 | 行为 |
|------|------|
| `theworld inspect memory` | 打印冻结的 L4 taxonomy 表 + 推迟的动词说明（无 L3 调用） |
| `theworld inspect memory <traceId>` | 同 GET，输出**记忆向**（memory blocks + L3 memory contributions） |
| `theworld inspect memory [--json]`（无 traceId） | JSON：`layers: L4_LAYERED_MEMORY_TAXONOMY`（与代码同心） |
| 行模式 `chat` 每轮结束后 | 与 101 并列两条灰字提示：`inspect context` 与 `inspect memory` |
| TUI **Context rail** | 一轮成功后：`formatL4ContextAndMemoryRailLine`（101 的 ctx 行 + 102 mem 行，同一 `getRunContext`） |
| `/memory` | 本会话最近 completed run，输出与 `inspect memory <traceId>` 一致 |

## 实现索引

- `packages/cli/src/l4-layered-memory.ts` — `L4_LAYERED_MEMORY_TAXONOMY`、`formatGetRunContextMemoryHuman`、`formatL4ContextAndMemoryRailLine`
- `packages/cli/src/l4-product-map.ts` — `inspect:memory`、`slash:/memory`
- `pnpm test:l4-memory` — 烟测 + 词表稳定字符串

## 变更流程

- 调整产品词表时同时改 `L4_LAYERED_MEMORY_TAXONOMY` 与 `test:l4-memory`；L3 DTO 变更先走 094/THIRD_LAYER 再改格式器。
