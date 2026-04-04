# Docs Index

本目录是 `openkin` 的记录系统入口。

如果你要理解项目，不要从聊天记录开始，而是从这里开始。

## 推荐阅读顺序

1. [`architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md)
2. [`architecture/first-layer/SDK.md`](architecture/first-layer/SDK.md)
3. [`architecture/first-layer/CHANNELS.md`](architecture/first-layer/CHANNELS.md)
4. [`governance/QUALITY_SCORE.md`](governance/QUALITY_SCORE.md)
5. [`governance/RELIABILITY.md`](governance/RELIABILITY.md)
6. [`governance/SECURITY.md`](governance/SECURITY.md)
7. [`governance/MODEL_OPERATING_MODES.md`](governance/MODEL_OPERATING_MODES.md)
8. [`governance/MODEL_PROMPT_CHEATSHEET.md`](governance/MODEL_PROMPT_CHEATSHEET.md)
9. [`archive/README.md`](archive/README.md)

## 核心文档

### 架构与分层设计

- [`architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md) — 总体架构：分层职责、演进原则、各层当前状态与优先实施顺序
- [`architecture/first-layer/SDK.md`](architecture/first-layer/SDK.md) — 客户端 SDK：职责边界、首期已实现/延后能力面、与服务层依赖关系
- [`architecture/first-layer/CHANNELS.md`](architecture/first-layer/CHANNELS.md) — 通道适配框架：统一 adapter contract、账号生命周期、平台接入边界

### 第一层参考

- [`architecture/first-layer/DEMO_FIRST_LAYER.md`](architecture/first-layer/DEMO_FIRST_LAYER.md) — 第一层 demo 运行指南：mock / 真实 LLM 入口命令、环境变量配置、交互与单次验收方式
- [`architecture/first-layer/FIRST_LAYER_COVERAGE.md`](architecture/first-layer/FIRST_LAYER_COVERAGE.md) — 第一层覆盖矩阵：Mock 审计、真实 API 审计、scenarios 各自验什么，为何不能全部默认跑在 CI
- `apps/dev-console/tests/README.md` — dev-console 测试目录说明：第一层 scenarios / audit 源码位置

### 第二层参考

- [`architecture/second-layer/DEMO_SECOND_LAYER.md`](architecture/second-layer/DEMO_SECOND_LAYER.md) — 第二层 demo 运行指南：内置工具、MCP、Skill 三条 smoke 入口命令、Skill 文件夹约定、MCP 动态更新说明
- [`architecture/second-layer/SECOND_LAYER_COVERAGE.md`](architecture/second-layer/SECOND_LAYER_COVERAGE.md) — 第二层覆盖矩阵：三个 smoke 各自验什么、哪些并入 verify、真实 LLM 验证路径规划

### 当前治理与约束

- [`governance/QUALITY_SCORE.md`](governance/QUALITY_SCORE.md) — 工程成熟度追踪：各维度（文档、contract、验证）的当前状态与推进记录
- [`governance/RELIABILITY.md`](governance/RELIABILITY.md) — 可靠性边界：Core / Service / Channel 各层必须长期保持的可靠性要求
- [`governance/SECURITY.md`](governance/SECURITY.md) — 安全边界：工具权限、会话隔离、Prompt 保护、接入凭证等安全约束
- [`governance/GIT_WORKFLOW.md`](governance/GIT_WORKFLOW.md) — Git 工作流：分支原则、提交节奏、提交前默认动作、agent 产出原则
- [`governance/MODEL_OPERATING_MODES.md`](governance/MODEL_OPERATING_MODES.md) — 模型工作模式定义：high-capability / budget / maintenance 三种模式的职责与规则
- [`governance/MODEL_PROMPT_CHEATSHEET.md`](governance/MODEL_PROMPT_CHEATSHEET.md) — 提示词速查表：切换模型时直接复制的三种模式提示词模板

### 历史基线设计

- [`archive/README.md`](archive/README.md) — 归档索引：历史方案文档的导航入口
- `archive/backend-plan/AI_Agent_Backend_Tech_Plan.md` — 早期后端技术方案：第一层详细设计的原始基线
- `archive/backend-plan/layer1-design/重构版方案/00_第一层技术方案总览.md` — 重构版方案总览：运行时、上下文、工具、错误模型的完整设计

## 执行计划

- 进行中的计划：[`exec-plans/active/README.md`](exec-plans/active/README.md)
- 已完成的计划：[`exec-plans/completed/README.md`](exec-plans/completed/README.md)

## 当前探索重点

当前探索分支优先解决这些问题：

1. 如何把后端第一层方案升级成全栈可演进架构
2. 如何先建立共享 contract，再承接服务、SDK 与通道适配
3. 如何把文档、计划、约束、验证统一成一套 harness

第一层 harness 与文档化验收（`007`–`012`）已收口，见 [`governance/QUALITY_SCORE.md`](governance/QUALITY_SCORE.md) 中「第一层首期完成态」；后续增量主要在服务深化、客户端与通道落地等，而非重写第一层 contract。
