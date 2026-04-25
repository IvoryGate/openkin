# L3 -> L4 Engineering Product Capabilities

## 目标

本文件用于记录从 `L3 Service And Protocol` 过渡到 `L4 Engineering Product Shell` 时，必须显式设计、不能只停留在聊天里的能力清单。

它不是某一张线性工单，也不是单次实现说明，而是后续拆分 `L3` 工单与 `L4` 产品工单的上游能力登记表。

## 为什么需要单独登记

当前仓库已经有：

- service API
- task API
- logs / introspection API
- CLI / TUI 基础壳

但这些不等于“完整工程产品”已经成立。

用户明确指出的很多能力，虽然有些已有接口、已有预留、已有 demo 形态，但仍未达到可依赖的产品完成态。例如：

- 定时任务存在，但一次 `once` 调度未必可靠
- 上下文会压缩，但上下文工程并未成为产品能力
- `MemoryPort` 已存在，但多层记忆系统尚未真正成型
- 有工具系统，但远未达到强 agent 产品的工具强度
- 有 TUI，但还没有完整 onboarding / approval / recover / multimodal 产品流

因此这些能力必须先被明确记录，再拆工单实现。

## 术语说明

### Event Plane

这里的 `event plane` 不是简单换名字，也不只是某一个 SSE endpoint。

它指的是：

> 系统中所有实时状态变化、长任务变化、审批变化、心跳变化，都应通过一套稳定事件模型被订阅和消费。

至少包括：

- run events
- task events
- approval events
- background session events
- heartbeat events
- log events
- memory / compact events
- tool warning events

### Layered Memory

这里的 `layered memory` 也不是“history + summary”的重命名。

它指的是：

> 记忆系统必须分层，而不是只有一张消息历史或一份摘要。

后续至少要支持：

- working memory
- session memory
- session summary memory
- persona memory
- skill memory
- workspace memory
- long-term factual memory
- retrieval memory

L4 本地**词表与状态**（implemented / read-only / planned）与 `inspect memory` 入口已登记在 [`L4_LAYERED_MEMORY.md`](./L4_LAYERED_MEMORY.md)（**102**）；仍以 L3 `ContextBuildReportDto` 为观测根，不冒充已完成向量或云端续跑。

### Context Engineering

这里指的不是“底层会自动裁剪上下文”，而是：

> 上下文如何被构建、压缩、解释、恢复，必须成为可观察、可调试、可被产品表达的系统能力。

## A. L3 必须补齐的 substrate 能力

这些能力本质上还是 `L3` 基建，但其目标是支撑 `L4` 产品闭环。

### A1. Unified Event Plane

必须提供统一、稳定、可订阅的事件基础：

- run started / streaming / completed / failed / cancelled
- task scheduled / triggered / running / retrying / failed / completed
- approval requested / approved / denied / expired
- background session attached / detached / resumed / interrupted
- heartbeat emitted / missed / degraded
- log events
- memory updated / compacted
- dangerous tool / command warning events

### A2. Reliable Scheduler / Cron / Once / Interval

任务功能必须从“有 API”升级为“可依赖系统能力”：

- `once` 任务可靠执行
- `cron` 任务可靠执行
- `interval` 任务可靠执行
- 服务重启后任务恢复
- missed window 补偿策略
- retry / backoff 策略
- 最大并发策略
- 失败原因持久化
- task run history
- task state events

### A3. Heartbeat

系统必须有正式 heartbeat 能力：

- agent heartbeat
- scheduler heartbeat
- background session heartbeat
- degraded / stale detection
- 心跳丢失后的恢复或告警

### A4. Active / Background Run Identity

为了 attach / resume / recover，必须有更清晰的运行对象：

- foreground run
- background run
- resumable run
- attached session
- detached session
- blocked-by-approval run
- failed-but-recoverable run

### A5. Approval / Danger Protocol

必须建立危险操作与审批的基础协议：

- tool call risk classification
- command risk classification
- file mutation risk classification
- network / shell / destructive action classification
- approval request payload
- approval response payload
- deny / timeout / resume semantics

### A6. Context / Compact / Memory Descriptors

必须为产品层提供基础 descriptors：

- 当前上下文使用量
- token budget 估算
- compact 发生边界
- compact 结果摘要
- memory 注入来源
- system / persona / workspace / skill / history 占比

### A7. Multimodal Contract

多模态不能只停留在预留接口：

- image input message
- attachment message
- multimodal run request
- multimodal stream event
- multimodal tool input / output schema
- attachment persistence / reference model

### A8. Stronger Built-in Tooling

工具系统必须进入“产品可工作”水位，而不是只够 demo：

- 文件读写编辑
- 搜索与语义检索
- shell 与命令执行
- 进程与任务观察
- web fetch / search
- workspace / project introspection
- memory 操作
- config / provider / account 操作
- multimodal 相关工具
- background / resume / plan / task 相关工具

## B. L4 必须完成的产品能力

这些能力定义的是：只靠 `CLI/TUI + 本地服务 + 本地工作区`，系统是否已经是完整工程产品。

### B1. Terminal-First Product Shell

必须形成完整工作界面，而不是单一聊天窗口：

- home shell
- conversation shell
- session / thread surface
- inspect surface
- tasks surface
- logs surface
- help / command surface
- settings / config surface

### B2. Onboarding / Setup / Discoverability

必须让用户能快速上手，而不是先翻文档：

- 首次启动引导
- provider / model 配置引导
- workspace / profile 初始化
- 权限说明
- skill / tool discoverability
- 示例任务入口
- 新用户空态引导
- 失败后的修复引导

### B3. Context Engineering Product Surface

必须让上下文工程成为产品可见能力：

- 当前上下文占用显示
- compact 边界显示
- memory 注入来源显示
- prompt source breakdown
- 当前有效上下文摘要

### B4. Multi-Layer Compression Strategy

必须设计并实现多层压缩策略，而不是只有一种压缩：

- 短上下文裁剪
- turn-level summary
- session summary
- task summary
- persona-preserving compact
- tool-output selective compact
- long-run recovery compact

### B5. Layered Memory System

必须显式设计多层记忆系统：

- working memory
- session memory
- session summary memory
- persona memory
- skill memory
- workspace memory
- long-term factual memory
- retrieval memory

并定义：

- 写入策略
- 读取策略
- 召回优先级
- 生命周期
- persona / identity 隔离
- skill 隔离
- workspace 隔离

### B6. Permission / Approval Product Flow

必须把危险操作提醒和审批做成正式产品流：

- 风险提示
- 危险命令显式提醒
- 当前会话权限态显示
- 待审批状态
- 批准后继续执行
- 拒绝后恢复路径
- 超时处理
- 审批记录可追踪

### B7. Background / Resume / Recover

必须形成成熟工作流：

- 前台转后台
- 后台运行状态
- attach / detach
- resume
- interrupted 后恢复
- failed 后 recover
- approval 卡住后继续
- restart 后恢复

### B8. Single-Agent Plan / Review / Execute

必须承接单 agent 的工程工作流：

- 计划生成
- 计划查看
- 计划修订
- 批准后执行
- 执行中观察
- 执行后审查
- 失败后恢复

### B9. Stronger Tool UX

必须提升工具工作体验：

- 工具调用摘要
- 危险工具高亮
- 工具结果可检查
- 长工具调用状态展示
- 重试与中断
- 工具失败解释
- 工具权限边界可见

### B10. Multimodal Product Entry

多模态必须形成真实产品入口：

- 在 CLI/TUI 中上传或引用附件
- 图片 / 文件输入工作流
- 多模态消息可视化
- 多模态工具调用状态
- 多模态结果展示与失败处理

## C. 当前优先级判断

后续拆工单时，建议按以下顺序：

1. 先补 `A1-A7` 这类 L3 substrate gaps
2. 再补 `B1-B8` 这类 L4 必要产品能力
3. `B9-B10` 可视资源与工具成熟度可并行推进，但不能长期搁置

## D. L4 产品对象与 control plane map（099）

**099** 已冻结本地 terminal-first 产品 **surface** 名、CLI/TUI 命令归属与 `ProductControlPlane` 的 L3 数据来源类别；子单 `100`–`106` 在共享词汇上展开，不另起一名多义。

- 权威表：[L4_PRODUCT_SHELL_MAP.md](./L4_PRODUCT_SHELL_MAP.md)
- 实现索引：`packages/cli/src/l4-product-map.ts` · `pnpm test:l4-shell-map`
- 人类向说明：`docs/architecture-docs-for-human/backend-plan/layer4-design/L4_PRODUCT_CONTROL_PLANE.md`

**100** 已落地本地 **onboarding / 空态 / 错误恢复** 文案与 `test:l4-onboarding`：

- 登记表：[L4_ONBOARDING.md](./L4_ONBOARDING.md)
- 人类向：`docs/architecture-docs-for-human/backend-plan/layer4-design/L4_ONBOARDING.md`

**101** 已把 L3 context 报告接进 **`theworld inspect context`**、行模式提示、TUI rail、`/context` 斜杠；`pnpm test:l4-context`：

- 登记表：[L4_CONTEXT_ENGINEERING.md](./L4_CONTEXT_ENGINEERING.md)
- 人类向：`docs/architecture-docs-for-human/backend-plan/layer4-design/L4_CONTEXT_ENGINEERING.md`

**104** 已把 run 连续性与 recover 提示接进 **`theworld sessions runs`**、`theworld inspect resume`、聊天 `/runs`、TUI `run·N active`；`pnpm test:l4-background`：

- 登记表：[L4_BACKGROUND_RESUME.md](./L4_BACKGROUND_RESUME.md)

**105** 已落地本地 **`.theworld/plan/state.json`** 与 **`theworld plan`**（init / review / execute）；`pnpm test:l4-plan`：

- 登记表：[L4_PLAN_REVIEW_EXECUTE.md](./L4_PLAN_REVIEW_EXECUTE.md)

**106** 已收口 **help / onboarding / home hints** 与 `NO_COLOR` 可发现性一致性；`pnpm test:l4-polish`：

- 登记表：[L4_TERMINAL_POLISH.md](./L4_TERMINAL_POLISH.md)

## E. 当前结论

从现在开始，下列能力不应再只是聊天中的“补充想法”：

- reliable scheduler / cron / heartbeat
- context engineering
- multi-layer compression
- layered memory system
- persona / identity / skill memory
- stronger built-in tooling
- dangerous command warning
- onboarding / setup / discoverability
- multimodal product entry

这些都已经进入仓库内的正式能力登记表，后续应按此拆分 `L3` 工单与 `L4` 产品工单。
