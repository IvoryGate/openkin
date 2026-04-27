# Docs Index

本目录是 `TheWorld` 的记录系统入口。终端 CLI 默认入口为 **`pnpm theworld`**，并提供等价短别名 **`pnpm world`**；运行时与脚本默认使用 **`THEWORLD_*`** 环境变量，详见 [`requirements/PROJECT_CLI.md`](requirements/PROJECT_CLI.md) §0。

如果你要理解项目，不要从聊天记录开始，而是从这里开始。

## 推荐阅读顺序

1. [`architecture-docs-for-agent/ARCHITECTURE.md`](architecture-docs-for-agent/ARCHITECTURE.md)
2. [`architecture-docs-for-agent/LAYER_TAXONOMY.md`](architecture-docs-for-agent/LAYER_TAXONOMY.md)
3. [`architecture-docs-for-agent/first-layer/SDK.md`](architecture-docs-for-agent/first-layer/SDK.md)
4. [`architecture-docs-for-agent/first-layer/CHANNELS.md`](architecture-docs-for-agent/first-layer/CHANNELS.md)
5. [`architecture-docs-for-agent/fourth-layer/CHANNEL_ADAPTER_COVERAGE.md`](architecture-docs-for-agent/fourth-layer/CHANNEL_ADAPTER_COVERAGE.md)
6. [`architecture-docs-for-agent/fourth-layer/L4_PRODUCT_SHELL_MAP.md`](architecture-docs-for-agent/fourth-layer/L4_PRODUCT_SHELL_MAP.md)（第四层 L4 产品 surface 与 CLI 命令映射，099 冻结）
7. [`architecture-docs-for-agent/fourth-layer/L4_ONBOARDING.md`](architecture-docs-for-agent/fourth-layer/L4_ONBOARDING.md)（第四层 首次使用与空态引导，100）
8. [`architecture-docs-for-agent/fourth-layer/L4_CONTEXT_ENGINEERING.md`](architecture-docs-for-agent/fourth-layer/L4_CONTEXT_ENGINEERING.md)（第四层 上下文可解释，101）
9. [`architecture-docs-for-agent/fourth-layer/L4_LAYERED_MEMORY.md`](architecture-docs-for-agent/fourth-layer/L4_LAYERED_MEMORY.md)（第四层 分层记忆词表与 inspect memory，102）
10. [`architecture-docs-for-agent/fourth-layer/L4_APPROVAL_PRODUCT_FLOW.md`](architecture-docs-for-agent/fourth-layer/L4_APPROVAL_PRODUCT_FLOW.md)（第四层 审批与风险展示，103）
11. [`architecture-docs-for-agent/fourth-layer/L4_BACKGROUND_RESUME.md`](architecture-docs-for-agent/fourth-layer/L4_BACKGROUND_RESUME.md)（第四层 run 连续性与恢复提示，104）
12. [`architecture-docs-for-agent/fourth-layer/L4_PLAN_REVIEW_EXECUTE.md`](architecture-docs-for-agent/fourth-layer/L4_PLAN_REVIEW_EXECUTE.md)（第四层 单 agent plan / review / execute，105）
13. [`architecture-docs-for-agent/fourth-layer/L4_TERMINAL_POLISH.md`](architecture-docs-for-agent/fourth-layer/L4_TERMINAL_POLISH.md)（第四层 terminal 产品壳体验收口，106）
14. [`architecture-docs-for-agent/fifth-layer/CLIENT_AND_CONTROL_PLANE.md`](architecture-docs-for-agent/fifth-layer/CLIENT_AND_CONTROL_PLANE.md)
15. [`architecture-docs-for-agent/sixth-layer/APP_AND_ORCHESTRATION.md`](architecture-docs-for-agent/sixth-layer/APP_AND_ORCHESTRATION.md)
16. [`governance/QUALITY_SCORE.md`](governance/QUALITY_SCORE.md)
17. [`governance/RELIABILITY.md`](governance/RELIABILITY.md)
18. [`governance/SECURITY.md`](governance/SECURITY.md)
19. [`governance/MODEL_OPERATING_MODES.md`](governance/MODEL_OPERATING_MODES.md)
20. [`governance/MODEL_PROMPT_CHEATSHEET.md`](governance/MODEL_PROMPT_CHEATSHEET.md)
21. [`archive/README.md`](archive/README.md)

## 核心文档

### 架构与分层设计

- [`architecture-docs-for-agent/ARCHITECTURE.md`](architecture-docs-for-agent/ARCHITECTURE.md) — 总体架构：分层职责、演进原则、各层当前状态与优先实施顺序
- [`architecture-docs-for-agent/LAYER_TAXONOMY.md`](architecture-docs-for-agent/LAYER_TAXONOMY.md) — 层级编号映射：解决旧 5 层与当前 6 层的口径漂移
- [`architecture-docs-for-agent/first-layer/SDK.md`](architecture-docs-for-agent/first-layer/SDK.md) — 客户端 SDK：职责边界、首期已实现/延后能力面、与服务层依赖关系
- [`architecture-docs-for-agent/first-layer/CHANNELS.md`](architecture-docs-for-agent/first-layer/CHANNELS.md) — 通道适配框架：统一 adapter contract、账号生命周期、平台接入边界
- [`architecture-docs-for-agent/fourth-layer/CHANNEL_ADAPTER_COVERAGE.md`](architecture-docs-for-agent/fourth-layer/CHANNEL_ADAPTER_COVERAGE.md) — 第四层覆盖矩阵：terminal-first 工程产品层、single-agent 完整能力、context/memory/approval/background 产品化
- [`architecture-docs-for-agent/fourth-layer/L4_PRODUCT_SHELL_MAP.md`](architecture-docs-for-agent/fourth-layer/L4_PRODUCT_SHELL_MAP.md) — L4 产品 surface 与 CLI 命令映射（099）
- [`architecture-docs-for-agent/fourth-layer/L4_ONBOARDING.md`](architecture-docs-for-agent/fourth-layer/L4_ONBOARDING.md) — L4 首次使用、空态与错误恢复（100）
- [`architecture-docs-for-agent/fourth-layer/L4_CONTEXT_ENGINEERING.md`](architecture-docs-for-agent/fourth-layer/L4_CONTEXT_ENGINEERING.md) — L4 上下文可解释与 inspect context（101）
- [`architecture-docs-for-agent/fourth-layer/L4_LAYERED_MEMORY.md`](architecture-docs-for-agent/fourth-layer/L4_LAYERED_MEMORY.md) — L4 分层记忆词表、inspect memory（102）
- [`architecture-docs-for-agent/fourth-layer/L4_APPROVAL_PRODUCT_FLOW.md`](architecture-docs-for-agent/fourth-layer/L4_APPROVAL_PRODUCT_FLOW.md) — L4 审批/风险与 inspect approvals（103）
- [`architecture-docs-for-agent/fourth-layer/L4_BACKGROUND_RESUME.md`](architecture-docs-for-agent/fourth-layer/L4_BACKGROUND_RESUME.md) — L4 背景/恢复词表、session runs、inspect resume、/runs（104）
- [`architecture-docs-for-agent/fourth-layer/L4_PLAN_REVIEW_EXECUTE.md`](architecture-docs-for-agent/fourth-layer/L4_PLAN_REVIEW_EXECUTE.md) — L4 本地 plan 工件与 `theworld plan`（105）
- [`architecture-docs-for-agent/fourth-layer/L4_TERMINAL_POLISH.md`](architecture-docs-for-agent/fourth-layer/L4_TERMINAL_POLISH.md) — L4 help / onboarding / home hints 一致性与 `test:l4-polish`（106）
- [`architecture-docs-for-agent/fifth-layer/CLIENT_AND_CONTROL_PLANE.md`](architecture-docs-for-agent/fifth-layer/CLIENT_AND_CONTROL_PLANE.md) — 第五层设计：external surfaces、channel access、multi-surface continuity、remote control plane
- [`architecture-docs-for-agent/sixth-layer/APP_AND_ORCHESTRATION.md`](architecture-docs-for-agent/sixth-layer/APP_AND_ORCHESTRATION.md) — 第六层设计：team/workflow/business app 与高层编排

### 第一层参考

- [`architecture-docs-for-agent/first-layer/DEMO_FIRST_LAYER.md`](architecture-docs-for-agent/first-layer/DEMO_FIRST_LAYER.md) — 第一层 demo 运行指南：mock / 真实 LLM 入口命令、环境变量配置、交互与单次验收方式
- [`architecture-docs-for-agent/first-layer/FIRST_LAYER_COVERAGE.md`](architecture-docs-for-agent/first-layer/FIRST_LAYER_COVERAGE.md) — 第一层覆盖矩阵：Mock 审计、真实 API 审计、scenarios 各自验什么，为何不能全部默认跑在 CI
- `apps/dev-console/tests/README.md` — dev-console 测试目录说明：第一层 scenarios / audit 源码位置

### 第二层参考

- [`architecture-docs-for-agent/second-layer/DEMO_SECOND_LAYER.md`](architecture-docs-for-agent/second-layer/DEMO_SECOND_LAYER.md) — 第二层 demo 运行指南：内置工具、MCP、Skill 三条 smoke 入口命令、Skill 文件夹约定、MCP 动态更新说明
- [`architecture-docs-for-agent/second-layer/SECOND_LAYER_COVERAGE.md`](architecture-docs-for-agent/second-layer/SECOND_LAYER_COVERAGE.md) — 第二层覆盖矩阵：三个 smoke 各自验什么、哪些并入 verify、真实 LLM 验证路径规划

### 第三层参考

- [`architecture-docs-for-agent/third-layer/THIRD_LAYER_COVERAGE.md`](architecture-docs-for-agent/third-layer/THIRD_LAYER_COVERAGE.md) — 第三层覆盖矩阵：018–024、026、027、046 以及 L3 substrate `090`–`096` 的落地状态；Client/Operator/Internal surface 分层
- `architecture-docs-for-human/backend-plan/layer3-design/LAYER3_DESIGN.md` — 第三层详细设计：服务化深化的关键决策、数据模型、架构约束与调试补强背景
- `architecture-docs-for-human/backend-plan/layer3-design/L3_RUN_LIFECYCLE.md` — L3 run identity、foreground/background、attach/interrupt/续跑语义
- `architecture-docs-for-human/backend-plan/layer3-design/L3_EVENT_PLANE.md` — L3 event plane taxonomy 与 run/task/log/approval/heartbeat/memory 归属
- `architecture-docs-for-human/backend-plan/layer3-design/L3_SCHEDULER_RELIABILITY.md` — scheduler tick、once/interval/cron、retry 与 staleness 基础语义
- `architecture-docs-for-human/backend-plan/layer3-design/L3_APPROVAL_DANGER.md` — risk class、approval 状态与 operator 协议
- `architecture-docs-for-human/backend-plan/layer3-design/L3_CONTEXT_MEMORY_DESCRIPTORS.md` — context / compact / memory descriptors 与观察面
- `architecture-docs-for-human/backend-plan/layer3-design/L3_MULTIMODAL.md` — image/file attachment、message persistence 与 LLM 映射边界
- `architecture-docs-for-human/backend-plan/layer3-design/L3_TOOLING_EXPOSURE.md` — tool exposure、risk metadata 与 introspection contract

### 第四到第六层参考

- `architecture-docs-for-human/backend-plan/layer4-design/LAYER4_DESIGN.md` — 第四层详细设计：本地工程产品壳、single-agent 完整能力、context/memory/approval/background
- `architecture-docs-for-human/backend-plan/layer5-design/LAYER5_DESIGN.md` — 第五层详细设计：external surfaces、channel access、remote control plane、multi-surface continuity
- `architecture-docs-for-human/backend-plan/layer6-design/LAYER6_DESIGN.md` — 第六层详细设计：plan/review/execute、subagent/team/workflow、业务应用

### 当前治理与约束

- [`governance/QUALITY_SCORE.md`](governance/QUALITY_SCORE.md) — 工程成熟度追踪：各维度（文档、contract、验证）的当前状态与推进记录
- [`governance/RELIABILITY.md`](governance/RELIABILITY.md) — 可靠性边界：Core / Service / Channel 各层必须长期保持的可靠性要求
- [`governance/SECURITY.md`](governance/SECURITY.md) — 安全边界：工具权限、会话隔离、Prompt 保护、接入凭证等安全约束
- [`governance/RENAME_STRATEGY.md`](governance/RENAME_STRATEGY.md) — 仓库命名最终态：TheWorld 命名、保留的中性 wire contract，以及已完成的 hard-cut 收口
- [`governance/HIGH_RISK_RENAME_DECISIONS.md`](governance/HIGH_RISK_RENAME_DECISIONS.md) — 高风险 rename 冻结结论：wire contract、metrics、DB、workspace、持久化键与 TypeScript symbol 的 keep/compat/defer 决策
- [`governance/GIT_WORKFLOW.md`](governance/GIT_WORKFLOW.md) — Git 工作流：分支原则、提交节奏、提交前默认动作、agent 产出原则
- [`governance/MODEL_OPERATING_MODES.md`](governance/MODEL_OPERATING_MODES.md) — 模型工作模式定义：high-capability / budget / maintenance 三种模式的职责与规则
- [`governance/MODEL_PROMPT_CHEATSHEET.md`](governance/MODEL_PROMPT_CHEATSHEET.md) — 提示词速查表：切换模型时直接复制的三种模式提示词模板

### 历史基线设计

- [`archive/README.md`](archive/README.md) — 归档索引：历史方案文档的导航入口
- `architecture-docs-for-human/backend-plan/AI_Agent_Backend_Tech_Plan.md` — 早期后端技术方案：第一层详细设计的原始基线
- `architecture-docs-for-human/backend-plan/layer1-design/重构版方案/00_第一层技术方案总览.md` — 重构版方案总览：运行时、上下文、工具、错误模型的完整设计

### 需求草案与 CLI 参考

- [`requirements/PROJECT_CLI.md`](requirements/PROJECT_CLI.md) — 项目级 CLI 能力需求草案
- [`requirements/CLI_REFERENCE_SOURCES_INDEX.md`](requirements/CLI_REFERENCE_SOURCES_INDEX.md) — 外参工程（OpenCode、Desktop `src`）CLI 理念：摘要目录
- [`requirements/CLI_REFERENCE_OPENCODE_AND_DESKTOP_SRC_ANALYSIS.md`](requirements/CLI_REFERENCE_OPENCODE_AND_DESKTOP_SRC_ANALYSIS.md) — 同上：分析报告正文（含终端 UI 设计语言：色板、字标、语义 token、动效与降载）
- [`requirements/OPENKIN_DESKTOP_APP_DESIGN_INFORMATION_ARCHITECTURE.md`](requirements/OPENKIN_DESKTOP_APP_DESIGN_INFORMATION_ARCHITECTURE.md) — theworld 桌面端设计资产信息架构（页面/组件/命名/交付清单）
- [`requirements/OPENKIN_DESKTOP_COLOR_AND_DESIGN_LANGUAGE.md`](requirements/OPENKIN_DESKTOP_COLOR_AND_DESIGN_LANGUAGE.md) — theworld 桌面端颜色体系与开发设计语言（token/状态/组件映射）

## 执行计划

- 进行中的计划：[`exec-plans/active/README.md`](exec-plans/active/README.md)
- 已完成的计划：[`exec-plans/completed/README.md`](exec-plans/completed/README.md)

## 当前探索重点

当前探索分支优先解决这些问题：

1. 如何把后端第一层方案升级成全栈可演进架构
2. 如何先建立共享 contract，再承接服务、本地工程产品、外部入口与通道适配
3. 如何把文档、计划、约束、验证统一成一套 harness
4. 如何把 context / memory / permission / approval / background / orchestration 收口成后半层正式设计

第一层 harness 与文档化验收（`007`–`012`）已收口，第三层基础服务 contract（`018`–`024`、`026`、`027`、`046`）与 L3 substrate（`090`–`096`）也已形成稳定底座；当前后续增量重点是第四层本地工程产品闭环、第五层外部入口扩展，以及第六层高层编排，而非重写第一层或第三层 contract。
