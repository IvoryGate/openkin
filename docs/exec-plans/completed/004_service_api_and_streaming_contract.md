# 004 Service API And Streaming Contract

## 目标

把 **Service And Protocol Layer** 从占位推进到可验收的最小闭环，并为后续 SDK 与 channel 层冻结唯一服务锚点。

本计划不是“先做一个大概 server”，而是明确首期唯一允许的协议路径：

- 同步 API 使用 **REST**
- 流式输出使用 **SSE**
- `packages/shared/contracts` 是唯一共享协议来源
- `apps/dev-console` 继续保持 **in-process core** 演示，不改成双模式客户端

## 已冻结决策

### 协议与路由

首期只允许实现以下路由：

1. `POST /v1/sessions`
2. `GET /v1/sessions/:sessionId`
3. `POST /v1/runs`
4. `GET /v1/runs/:traceId/stream`

### DTO 与事件

首期共享 contract 只允许新增以下服务层 DTO 与常量：

- session 创建请求/响应 DTO
- session 查询响应 DTO
- run 提交请求/响应 DTO
- 路由常量
- SSE 事件序列化约定

SSE 必须采用以下固定格式：

- `event` 字段等于 `StreamEvent.type`
- `data` 字段等于完整 `StreamEvent` JSON
- terminal event 只允许是 `run_completed` 或 `run_failed`
- 发送 terminal event 后立即关闭流

### 错误策略

- 同步 REST 响应统一使用 `ApiEnvelope<T>`
- 流式错误统一映射到 `run_failed`
- 不新增第二套 server 私有错误 envelope

## 影响范围

| 层级 | 影响 |
|------|------|
| `packages/shared/contracts` | 增加服务层 DTO、路由常量、SSE 约定；不得重复定义 core 内部语义 |
| `packages/server` | 实现最小 HTTP + SSE 入口，编排 `packages/core` 的 RunEngine |
| `packages/core` | 只允许为 server 增加薄适配或导出；不得重写 RunEngine / Context / Tool Runtime 语义 |
| `apps/dev-console` | 保持现状；如需 server smoke，新增独立脚本或测试入口，不改现有场景主路径 |
| 文档 | 如事实变化，更新 `docs/architecture-docs-for-agent/ARCHITECTURE.md` 中 Service 层当前状态 |

## 允许修改的目录

- `packages/shared/contracts/`
- `packages/server/`
- `docs/architecture-docs-for-agent/ARCHITECTURE.md`
- `docs/exec-plans/active/`
- `package.json`
- `scripts/`

## 禁止修改的目录

- `packages/sdk/`
- `packages/channel-core/`
- `apps/dev-console/src/index.ts`
- 与服务协议无关的 UI 或平台接入目录

## 本轮范围

- 在 `packages/shared/contracts` 中冻结 session / run 的最小 DTO、路由常量与 SSE 约定
- 在 `packages/server` 中实现最小 REST + SSE server
- 跑通「创建 session -> 提交 run -> 订阅 SSE -> 收到 terminal event」
- 为本计划引入独立 `test:server` 或等价 smoke 命令
- 在计划完成时，把最终命令写回仓库文档

## 本轮不做

- 不实现 WebSocket、chunked JSON lines 或其他可替代流式协议
- 不实现鉴权、多租户、限流、生产级 observability
- 不接 channel、不实现真实 LLM 供应商路由
- 不把 dev-console 改造成 server client
- 不以完整 OpenAPI 文档作为首期验收门槛

## 验收标准

1. `packages/server` 可以稳定跑通 `POST /v1/sessions`、`POST /v1/runs`、`GET /v1/runs/:traceId/stream` 的最小闭环。
2. SSE 中的 `event` 与 `data` 序列化符合本计划冻结的 `StreamEvent` 约定。
3. 运行结果至少能产生一个 terminal event，并与 `RunError` / `RunFinalStatus` 语义对齐。
4. `pnpm verify` 通过。
5. 额外验收命令 `pnpm test:server` 通过。

## 必跑命令

实现本计划时，默认必须运行：

1. `pnpm verify`
2. `pnpm test:server`

在 `test:server` 尚未落地前，不允许宣称本计划完成。

## 升级条件

命中以下任一情况时，弱模型必须立即停止并升级到 high-capability mode 或人工：

- 需要改 `StreamEvent` 总体模型而不是只补服务层字段
- 需要新增第二套 envelope 或重写 `RunError` 语义
- 需要改 `docs/architecture-docs-for-agent/ARCHITECTURE.md` 的总体分层方向
- 需要把 `apps/dev-console` 改成正式 server client
- 连续两轮无法让 `pnpm verify` 与 `pnpm test:server` 同时通过

## 依赖与顺序

- **前置**：[`003`](./003_context_block_model_and_budget_policy.md)
- **解锁**：[`005`](./005_client_sdk_v1_minimal.md)

## 验收结果

- **日期**：2026-04-02
- **实现**：`packages/shared/contracts`（v1 DTO、`apiPath*` 路由辅助、`formatSseEvent`）；`packages/server`（`createOpenKinHttpServer`、`TraceStreamHub`、SSE hook、`packages/server/src/cli.ts`）；`packages/core`（`RunOptions.traceId`、`OpenKinAgent.createSession` / `getSession`）；`scripts/test-server.mjs`。
- **`pnpm verify`**：已包含 `test:server`（根 `package.json` 的 `verify` 脚本链）。
- **说明**：`GET /v1/sessions/:sessionId` 已按计划实现；冒烟脚本覆盖 session → run → SSE terminal。
