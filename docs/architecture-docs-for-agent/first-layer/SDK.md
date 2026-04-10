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

### 首期已实现（`packages/sdk/client`，exec-plan 005 + 019/020）

- `createTheWorldClient({ baseUrl, apiKey? })` 工厂（`apiKey` 对应服务端 `THEWORLD_API_KEY` 时的 Bearer 鉴权）
- `createSession(request?)` → `POST /v1/sessions`
- `getSession(sessionId)` → `GET /v1/sessions/:sessionId`
- `listSessions(params?)` → `GET /v1/sessions`（limit/offset）
- `deleteSession(sessionId)` → `DELETE /v1/sessions/:sessionId`
- `getMessages(sessionId, params?)` → `GET /v1/sessions/:id/messages`（limit/before）
- `getHealth()` → `GET /health`
- `run(request)` → `POST /v1/runs`（仅提交 run，返回 `traceId` / `sessionId`）
- `streamRun(request, listener)` → `POST /v1/runs` 后 `GET /v1/runs/:traceId/stream`，按块解析 SSE，`listener` 收到每条 `StreamEvent`
- REST 错误通过服务端 `ApiEnvelope` 的 `error` 抛出（`RunError` 形状）；网络失败为 `RUN_INTERNAL_ERROR` 语义
- 验收入口：根目录 `pnpm test:sdk`（启动真实 `packages/server` 子进程后跑 E2E）；会话/消息列表：`pnpm test:session-message`

### 首期明确延后

- `cancelRun()`、浏览器构建与 CORS 专项验收
- 重连、断点续传、复杂退避与高级状态管理
- 单独导出的 `onMessage` / `onToolCall` 等细粒度回调（流式事件仍可通过 `streamRun` 的 `StreamEvent` 消费）

### Session API（路线图）

- `createSession()` — 已实现
- `getSession()` — 已实现
- `listSessions()` — 已实现
- `deleteSession()` — 已实现
- `getMessages()` — 已实现

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

## 服务面边界（冻结）

`packages/sdk/client` 继续定位为普通客户端调用入口，而不是运维或管理入口。

因此它允许覆盖的能力面是：

- session 创建、读取、列表、历史、删除等用户会话能力
- run 提交、stream 消费、标准错误处理
- 基础健康检查（如 `GET /health`）
- 对已存在 `agentId` 的选择性使用；这仍然属于一次 run 的输入

它不应默认覆盖的能力面是：

- trace 查询与完整推理轨迹读取
- metrics、系统日志、内部管理端点
- Agent 定义 CRUD、定时任务等 operator 能力
- `/_internal/*` 之类的内部入口

如果后续确实需要 operator 侧 SDK，应新增独立 surface（如单独 admin SDK），而不是继续扩张 `packages/sdk/client`。

## 客户端壳层解耦（冻结）

为了同时服务 CLI、GUI、Web、桌面端和其他本地客户端，后续客户端侧默认按三段拆分：

1. `shared contracts`
   - 只负责 DTO、路由、事件 schema 与错误形状
2. `sdk/client` / `sdk/operator-client`
   - 只负责把 service surface 封装成稳定调用接口
   - 不负责命令名、终端颜色、GUI 组件结构、页面状态树
3. `shells`
   - CLI、Web Console、桌面端、本地 GUI 等
   - 只负责交互形态、输入输出、展示与本地壳特有体验

冻结规则：

- 不让 CLI 反向定义共享接口
- 不让 Web / GUI 直接绕过 SDK 去重复拼 HTTP 细节
- 不把某个壳层特有概念直接塞进 `packages/sdk/client`
- 如果某能力要同时被多个壳层消费，优先新增共享 interface / 独立 SDK surface，而不是在单个壳层私下实现

这意味着：

- `packages/sdk/client` 继续只承接 `client surface`
- 如需管理与观测能力，应新增单独的 `operator-client`（或同级命名的独立 surface）
- CLI 计划、Web 计划、GUI 计划都应依赖这些共享接口，而不是各自定义一套产品 contract

## 面向未来编排与实时信号的预留

共享客户端接口在后续设计时，必须显式考虑以下未来对接点：

- **多 Agent 编排**
  - 未来可能需要 orchestration-facing interface，用于查询 execution、subtask、聚合 trace，而不是让 CLI / GUI / Web 各自拼装
- **plan mode**
  - 未来可能存在 plan → execute 两段式交互；其共享接口应位于上层 orchestration surface，而不是塞进 `packages/sdk/client` 的基础会话能力
- **定时任务**
  - 当前 `cron` / `once` / `interval` 已属于 operator 能力；共享接口应允许不同壳层一致消费，不允许每个壳层定义各自的任务 DTO 变体
- **heartbeat / 事件订阅**
  - 未来 CLI、GUI、Web、Desktop 都可能订阅任务事件、心跳、长运行状态变化；应优先抽象独立的 event subscription interface，而不是把 SSE 处理逻辑散落在各壳层

冻结规则：

- 不让多 Agent / plan mode 语义提前污染 `client surface` 的基础 Session/Run contract
- 不让任务系统或 heartbeat 订阅只在某一个壳层私有实现
- 若某接口同时服务交互壳层与编排层，应先声明属于哪一个 surface，再决定落在何处

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
