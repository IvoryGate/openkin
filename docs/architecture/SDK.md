# SDK

## 目标

客户端首期不优先做完整 UI 应用，而是先做一套稳定的客户端 SDK。

这样做的原因：

1. Web、桌面端、移动端最终都需要同一套核心调用能力
2. 先做 SDK 可以提前冻结服务协议与事件模型
3. 可以避免某个具体客户端实现反向定义服务端 contract

## SDK 的职责

SDK 应负责：

- 创建会话
- 发起一次 run
- 消费流式响应
- 订阅运行事件
- 查询 trace 或状态
- 统一错误处理

SDK 不应负责：

- Core Runtime 的实现
- 具体 IM 平台适配
- 复杂业务工作流编排

## 建议能力面

### 首期执行约束

为了让弱模型能够按计划推进，SDK 首期实现默认冻结为：

- Node-first
- 依赖 `004` 已冻结的 REST + SSE 协议
- 不通过 SDK 反向设计 server contract
- 先做最小能力，再补浏览器与高级能力

### 首期已实现（`packages/sdk/client`，exec-plan 005）

- `createOpenKinClient({ baseUrl })` 工厂
- `createSession(request?)` → `POST /v1/sessions`
- `getSession(sessionId)` → `GET /v1/sessions/:sessionId`
- `run(request)` → `POST /v1/runs`（仅提交 run，返回 `traceId` / `sessionId`）
- `streamRun(request, listener)` → `POST /v1/runs` 后 `GET /v1/runs/:traceId/stream`，按块解析 SSE，`listener` 收到每条 `StreamEvent`
- REST 错误通过服务端 `ApiEnvelope` 的 `error` 抛出（`RunError` 形状）；网络失败为 `RUN_INTERNAL_ERROR` 语义
- 验收入口：根目录 `pnpm test:sdk`（启动真实 `packages/server` 子进程后跑 E2E）

### 首期明确延后

- `listSessions()`、`cancelRun()`、浏览器构建与 CORS 专项验收
- 重连、断点续传、复杂退避与高级状态管理
- 单独导出的 `onMessage` / `onToolCall` 等细粒度回调（流式事件仍可通过 `streamRun` 的 `StreamEvent` 消费）

### Session API（路线图）

- `createSession()` — 已实现
- `getSession()` — 已实现
- `listSessions()` — 延后

### Run API（路线图）

- `run` / `streamRun` — 已实现（见上）
- `cancelRun(traceId)` — 延后

### Event API（路线图）

- 细粒度事件回调 — 延后；terminal 成功/失败由 `streamRun` 中的 `run_completed` / `run_failed` 覆盖

## 建议依赖关系

SDK 只能依赖：

- shared contracts
- service API contract

SDK 不应直接依赖：

- core runtime 内部实现
- channel adapter 实现
- server 私有模块

## 首期验收标准

首期 SDK 不需要功能很多，但至少应能：

1. 创建一个 session
2. 查询一个 session
3. 发起一次非流式 run
4. 发起一次流式 run
5. 接收标准化错误
6. 与 traceId、sessionId 对齐
7. 在 Node 环境下通过真实本地 server 完成端到端验证

## 后续扩展方向

- 浏览器 SDK
- Node.js SDK
- 桌面端共享 SDK
- 移动端桥接 SDK
