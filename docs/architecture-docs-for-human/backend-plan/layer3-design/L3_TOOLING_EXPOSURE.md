# L3 工具暴露与可观测性（096）

## `GET /v1/tools`

每个条目为 `ToolEntryDto`：

- **name / description / source / providerId / parameters** — 与历史行为一致。
- **riskClass**（可选）— 取值为 `RiskClassDto`（与 093 审批语义对齐的观察面）；由第一层工具在 `metadata.riskClass` 声明，服务层校验后下传。
- **category**（可选）— `ToolSurfaceCategoryDto`：`utility` | `filesystem` | `shell` | `skill` | `logs` | `workspace` | `mcp` | `other`；由 `metadata.surfaceCategory` 声明，**MCP 工具**在未声明时默认 `mcp`。

## Core

内置工具在 `packages/core` 的 `ToolDefinition.metadata` 中设置 `surfaceCategory` 与需要时的 `riskClass`；L3 不要求覆盖每一个工具，但关键路径（`run_command`、`write_file`、`run_script` 等）应标注以便运维与 L4 消费。

## 自动化

`pnpm test:introspection` 会断言 `run_command` 与 `write_file` 的暴露字段与 093/096 一致。
