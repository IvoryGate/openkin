# 002 Quality Gates And Feedback Loops

## 目标

在继续扩大第一层功能之前，先建立防漂移机制，让仓库逐步具备“agent 可稳定主导产出”的基础条件。

## 本轮范围

- 增加文档入口与归档检查
- 增加第一层结构与 contract 检查
- 增加 workspace 结构检查
- 增加统一回归脚本入口
- 增加 Git 版本管理规则文档

## 本轮不做

- 不扩大 service 功能面
- 不新增具体 IM 平台接入
- 不新增完整客户端 UI

## 验收标准

1. 存在 `pnpm lint:docs`
2. 存在 `pnpm lint:architecture`
3. 存在 `pnpm lint:workspace`
4. 存在 `pnpm verify`
5. 文档入口检查能通过
6. 第一层结构 contract 检查能通过
7. workspace 结构检查能通过
8. 场景回路仍然能通过
9. 仓库内有明确的 Git 工作流说明文档

## 后续计划候选

- `003_context_block_model_and_budget_policy.md`
- `004_memory_ports_and_history_boundaries.md`
- `005_service_api_smoke_and_sdk_smoke.md`
