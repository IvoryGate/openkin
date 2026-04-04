# 001 Repo Harness Foundation

## 目标

把当前仓库从“只有后端方案文档”推进成一套可供人和智能体共同消费的记录系统，为后续全栈演进做准备。

## 本轮范围

本轮只做文档与入口层整理，不进入实现代码：

- 增加仓库级入口地图
- 增加总架构地图
- 增加 SDK 与 Channel 方向文档
- 增加质量、可靠性、安全基线
- 增加执行计划目录

## 本轮不做

- 不落 `packages/` 实现代码
- 不改第一层核心设计内容
- 不接任何具体 IM 平台
- 不做具体客户端 UI

## 验收标准

1. 根目录存在 `AGENTS.md`
2. `docs/index.md` 能作为文档总入口
3. `docs/architecture/ARCHITECTURE.md` 明确全栈演进层次
4. `docs/architecture/first-layer/SDK.md` 与 `docs/architecture/first-layer/CHANNELS.md` 明确新增边界
5. `docs/governance/QUALITY_SCORE.md`、`docs/governance/RELIABILITY.md`、`docs/governance/SECURITY.md` 建立基线
6. `docs/exec-plans/` 具备 active/completed 基础结构

## 后续计划候选

- `002_monorepo_scaffold_and_shared_contracts.md`
- `003_core_runtime_min_loop.md`
- `004_service_api_and_streaming_contracts.md`
- `005_client_sdk_v1.md`
- `006_channel_core_and_mock_adapter.md`

## 验收结果

- **日期**：2026-04-02
- **结论**：上述验收标准在仓库当前状态中均已满足（入口与核心文档存在，`docs/exec-plans/` 具备 active/completed 结构）。
- **说明**：本计划正文中的「后续计划候选」文件名为早期占位；实际演进以 `docs/exec-plans/active/` 与 `completed/` 下现网文件为准（例如已完成的质量门与第一层上下文计划）。
