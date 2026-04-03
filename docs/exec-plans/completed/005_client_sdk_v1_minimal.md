# 005 Client SDK v1 Minimal

## 目标

交付 **Client SDK** 的首个可验收版本，并把 SDK 的首期能力面收紧为弱模型可直接实现的 Node-only 子集。

本计划默认建立在 `[004](../completed/004_service_api_and_streaming_contract.md)` 已完成的前提上，不允许 SDK 反向定义服务协议。

## 已冻结决策

### 运行时

- 首期只支持 **Node**
- 默认使用 Node 可用的 `fetch` / stream 能力
- 浏览器支持、bundle、CORS 兼容性全部后置

### SDK 对外能力面

首期只允许交付以下最小 surface：

1. `createSession()`
2. `getSession(sessionId)`
3. `run(request)`
4. `streamRun(request, listener)`

以下能力明确延后：

- `listSessions()`
- `cancelRun()`
- 浏览器专用 API
- 重连、断点续传、复杂退避

### 测试路径

- 默认使用 **真实本地 server 子进程**
- 不以 mock HTTP server 作为主验收路径
- SDK 验收脚本必须自行启动或管理本地 server 生命周期

## 影响范围


| 层级                          | 影响                                             |
| --------------------------- | ---------------------------------------------- |
| `packages/shared/contracts` | 仅依赖 004 已冻结的共享 contract；不得反向要求 server 改字段      |
| `packages/sdk/client`       | 实现 Node-only HTTP / SSE 客户端与公开 API             |
| `packages/server`           | 只允许兼容性修复；不得在本计划扩大服务功能面                         |
| 文档                          | 更新 `docs/architecture/SDK.md`，明确 implemented / deferred 能力面 |


## 允许修改的目录

- `packages/sdk/client/`
- `docs/architecture/SDK.md`
- `docs/exec-plans/active/`
- `package.json`
- `scripts/`

## 禁止修改的目录

- `packages/core/`
- `packages/channel-core/`
- `apps/dev-console/`
- `packages/server/` 中与 SDK 兼容性无关的功能扩展

## 本轮范围

- 在 `packages/sdk/client` 中实现真实 HTTP / SSE 客户端
- 让 SDK 跑通「创建 session -> run -> streamRun -> 收到 terminal event」
- 统一网络错误与服务端 `RunError` 的暴露方式
- 为 SDK 引入独立 `test:sdk` 或等价 e2e 命令
- 更新 `docs/architecture/SDK.md`，把首期能力划分为 `implemented` 与 `deferred`

## 本轮不做

- 不发布 npm 包
- 不做浏览器构建与兼容性验收
- 不新增 SDK 高级状态管理或多会话 UI 抽象
- 不改 004 已冻结的 server 路由、DTO 与 SSE 约定

## 验收标准

1. SDK 能对 004 的真实 server 跑通「创建 session -> run -> streamRun -> terminal event」。
2. `docs/architecture/SDK.md` 与实际实现一致，并明确列出 deferred 能力。
3. `pnpm verify` 通过。
4. `pnpm test:sdk` 通过。

## 必跑命令

实现本计划时，默认必须运行：

1. `pnpm verify`
2. `pnpm test:sdk`

## 升级条件

命中以下任一情况时，弱模型必须立即停止并升级到 high-capability mode 或人工：

- 需要改 004 已冻结的路由、DTO 或 SSE 语义
- 需要新增浏览器优先 API 或改变 SDK 首期 surface
- 需要让 SDK 直接依赖 server 内部实现
- 连续两轮无法让 `pnpm verify` 与 `pnpm test:sdk` 同时通过

## 依赖与顺序

- **前置**：`[004](./004_service_api_and_streaming_contract.md)`
- **解锁**：[`006`](./006_channel_adapter_framework_contract.md)

## 验收结果

- **日期**：2026-04-02
- **实现**：`packages/sdk/client`（`createOpenKinClient`、`parseSseStreamEvents`）；`scripts/test-sdk.mjs` + `scripts/run-sdk-smoke.ts`（真实 server 子进程 + E2E）；`docs/architecture/SDK.md` 已区分已实现/延后。
- `**pnpm verify`**：已包含 `test:sdk`（根 `package.json` 的 `verify` 脚本链）。

