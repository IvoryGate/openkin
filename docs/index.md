# Docs Index

本目录是 `openkin` 的记录系统入口。

如果你要理解项目，不要从聊天记录开始，而是从这里开始。

## 推荐阅读顺序

1. `ARCHITECTURE.md`
2. `SDK.md`
3. `CHANNELS.md`
4. `QUALITY_SCORE.md`
5. `RELIABILITY.md`
6. `SECURITY.md`
7. `MODEL_OPERATING_MODES.md`
8. `MODEL_PROMPT_CHEATSHEET.md`
9. `archive/README.md`

## 核心文档

### 总体架构

- `ARCHITECTURE.md`
- `SDK.md`
- `CHANNELS.md`
- `DEMO_FIRST_LAYER.md`（第一层 mock / 真实 LLM：交互 `pnpm dev:first-layer`，单次验收 `pnpm test:first-layer-real` 等）
- `FIRST_LAYER_COVERAGE.md`（第一层 Mock 审计 / 真实 API 审计 / scenarios 分工）
- `apps/dev-console/tests/README.md`（dev-console 测试目录说明；第一层 scenarios / audit 源码位置）

### 当前治理与约束

- `QUALITY_SCORE.md`
- `RELIABILITY.md`
- `SECURITY.md`
- `GIT_WORKFLOW.md`
- `MODEL_OPERATING_MODES.md`
- `MODEL_PROMPT_CHEATSHEET.md`

### 历史基线设计

- `archive/README.md`
- `archive/backend-plan/AI_Agent_Backend_Tech_Plan.md`
- `archive/backend-plan/layer1-design/重构版方案/00_第一层技术方案总览.md`

## 执行计划

- 进行中的计划：`exec-plans/active/README.md`
- 已完成的计划：`exec-plans/completed/README.md`

## 当前探索重点

当前探索分支优先解决这些问题：

1. 如何把后端第一层方案升级成全栈可演进架构
2. 如何先建立共享 contract，再承接服务、SDK 与通道适配
3. 如何把文档、计划、约束、验证统一成一套 harness

第一层 harness 与文档化验收（`007`–`012`）已收口，见 `QUALITY_SCORE.md` 中「第一层首期完成态」；后续增量主要在服务深化、客户端与通道落地等，而非重写第一层 contract。
