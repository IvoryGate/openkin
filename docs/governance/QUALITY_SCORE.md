# Quality Score

## 目标

这个文档用来跟踪 `openkin` 在探索分支上的工程成熟度。

目的不是打漂亮分，而是让人和智能体都知道：

- 当前哪些部分已经有稳定 contract
- 哪些部分还只是方向
- 哪些部分已经具备可验证闭环

## 当前评分维度

### 1. 文档地图

- 状态：已启动
- 要求：入口、架构、执行计划、质量基线文档齐备

### 2. Core Runtime Contract

- 状态：探索分支下第一层首期 harness 已收口（执行计划 `007`–`012`）
- 要求：第一层类型、错误模型、工具运行时、上下文模型形成代码 contract
- 当前说明：已具备最小 ReAct loop、错误与取消语义、工具运行时视图、`ContextBlock` 与初始预算裁剪策略，并具备最小 `MemoryPort` 边界与注入扩展点；`LLMProvider` 含 `MockLLMProvider` 与 `OpenAiCompatibleChatProvider`（sync `generate`，无 token 流式）；终态 guard 与关键预算 / LLM 错误场景见 `RELIABILITY.md` 与 `apps/dev-console/tests/scenarios.ts`

### 3. Service API Contract

- 状态：第三层首期 contract 已收口（执行计划 `018`–`023`）
- 要求：会话、run、stream、trace、operator surface 管理能力形成共享 schema
- 当前说明：已形成会话 / message / run / SSE / trace 查询、健康检查与 API Key 鉴权、metrics、Agent CRUD、scheduled tasks 等首期 service contract，并明确冻结 `client surface` / `operator surface` / `internal surface` 分层边界

### 4. Client SDK Contract

- 状态：已形成 Node 首期实现（`packages/sdk/client`，`pnpm test:sdk`）
- 要求：SDK surface 与 service contract 对齐

### 5. Channel Adapter Framework

- 状态：已形成首期 framework 契约与 mock 穿 service 闭环（`packages/channel-core`，`pnpm test:channels`）
- 要求：adapter、account lifecycle、inbound/outbound schema 形成统一 contract

### 6. 自动化约束

- 状态：已形成跨第一层到第三层的闭环（随 `pnpm verify`）
- 要求：至少具备架构依赖检查、文档一致性检查、关键状态机约束
- 当前说明：已具备 docs / architecture / workspace 三类检查；架构 lint 含对 `RunEngine` 终态 guard 等约束；默认 **不** 将真实 LLM 调用并入 `verify`；第三层专属 smoke `test:persistence`、`test:auth-health`、`test:session-message`、`test:observability`、`test:agent-config`、`test:scheduler` 已并入根 `verify`

### 7. 反馈回路

- 状态：已形成第一层到第三层的闭环
- 要求：至少具备 core test、scenario test、trace、demo runner、adapter smoke test
- 当前说明：统一 `pnpm verify` 已覆盖 scenarios、**第一层审计** `test:first-layer-audit`、server / sdk / channels，以及第三层 persistence / auth-health / session-message / observability / agent-config / scheduler smoke；dev-console mock / live demo；非默认真实 provider 验收：`pnpm test:first-layer-real`（见 `../first-layer/DEMO_FIRST_LAYER.md`）

## 第一层首期完成态（探索分支）

在以下意义上，第一层 **harness** 已可交付为后续层的稳定底座：

- 代码与 contract：`packages/core` 与 `packages/shared/contracts` 中与第一层相关的类型与错误模型已落地并在场景中回归。
- 验证：`pnpm verify` 覆盖第一层 scenarios 及跨层 smoke（server / sdk / channel），不含外网真实 LLM。
- 真实 LLM：交互中文 `pnpm dev:first-layer`（`demo-interactive`）；单次跑通 `pnpm test:first-layer-real`（`demo:live`）；全链路真实审计 `pnpm test:first-layer-real-audit`（见 `../first-layer/FIRST_LAYER_COVERAGE.md`，需 env，不进默认 verify）。
- 文档：`../architecture/ARCHITECTURE.md`、`RELIABILITY.md`、`../first-layer/DEMO_FIRST_LAYER.md`、执行计划 `007`–`012` 与事实对齐。

这不表示产品层（多平台 IM、完整客户端 UI 等）已完成，仅表示第一层与文档化验收边界已收口。

## 第三层首期完成态（探索分支）

在以下意义上，第三层 **service and protocol layer** 已可作为上层开发基线：

- 代码与 contract：`packages/server` 与 `packages/shared/contracts` 已落地会话 / run / trace / operator API / scheduled tasks 的首期边界，并与 `SDK.md`、`CHANNELS.md`、`SECURITY.md` 中的 surface 约束对齐。
- 验证：`pnpm verify` 已覆盖 `test:persistence`、`test:auth-health`、`test:session-message`、`test:observability`、`test:agent-config`、`test:scheduler`，可在本地 mock 环境下完成第三层默认验收。
- 调度语义：`task_runs.retry_count` 已按连续失败重试次数持久化，非成功 run 会进入 scheduler failure/retry 路径，而不是只记录状态不推进重试。
- 文档：执行计划 `018`–`023`、`ARCHITECTURE.md`、`QUALITY_SCORE.md` 与当前仓库事实对齐。

这不表示第四层或产品层能力已完成，仅表示第三层首期 contract、验收脚本与默认验证链已经收口。

## 使用方式

后续每推进一个阶段，都应更新本文件：

- 哪一项从“未开始”变为“已启动”
- 哪一项已经形成稳定 contract
- 哪一项已经具备自动化验证
