# L4 分层记忆（102）

## 要解决的问题

工程用户需要知道：**哪些记忆层次已经接入**、**哪些仍停留在协议或规划**、**当前一次 run 里记忆如何进 prompt**。

本单不建设独立「记忆服务」，只把 L3 已有 descriptor 与 L4 词表对齐，并在本地 CLI/TUI 可访问。

## 与第三层、101 的边界

- 观测数据仍来自 `GET /v1/runs/:traceId/context`。
- **101** 解释整包上下文；**102** 在同一份数据上强调 memory layer 与 `memoryContributions`。
- `save` / `pin` / `ignore` 等作为**产品动词**的独立闭环推迟；现有 `/compact` 与 L3 报告仍适用。

## 用户入口（摘要）

- 无 `traceId`：`theworld inspect memory` 查看词表与推迟说明。
- 有 `traceId`：查看该次组 prompt 时记忆向摘要。
- 权威技术索引：[`docs/architecture-docs-for-agent/fourth-layer/L4_LAYERED_MEMORY.md`](../../../../architecture-docs-for-agent/fourth-layer/L4_LAYERED_MEMORY.md)。
