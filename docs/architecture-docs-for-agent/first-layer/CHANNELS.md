# Channels

> 历史说明：本文件路径保留在 `first-layer/` 目录中，但按当前层级口径，channel / account / pairing / presence / delivery / external entry 已归入 **L5 External Surfaces And Channel Access**。本文件继续作为 channel contract 的历史权威入口，不再表示“当前第四层归属”。

## 目标

即时通讯接入首期不优先打透某一个平台，而是先建立统一的通道适配框架。

这样做的原因：

1. 平台会不断增加
2. 每个平台的认证、消息格式、媒体能力都不同
3. 如果没有统一 adapter contract，后续每接一个平台都会侵入核心服务层

## 核心思想

> 平台差异属于 adapter 层，账号生命周期和统一消息模型属于 channel core。

首期 framework 的正式验收链路必须经过 service 层，不允许把 channel 直接接到 core 作为长期方案。

## 建议的核心对象

### ChannelAdapter

负责某一平台的具体接入实现。

### ChannelManager

负责统一管理多个 adapter 和多个账号实例。

### ChannelAccount

表示某个平台下的一个登录账号，应具备独立生命周期与状态。

### InboundEvent

表示从平台进入系统的标准化消息或事件。

### OutboundMessage

表示系统向平台发送的标准化消息。

## 账号生命周期

建议首期统一定义这些状态：

- `created`
- `authenticating`
- `active`
- `degraded`
- `stopped`
- `logged_out`
- `error`

在 framework 首期收口阶段，不应自行新增、删除或重命名这些状态；如需调整，必须升级到更高模式重新定稿。

## Adapter 最小能力

每个 adapter 首期至少要回答这些问题：

1. 如何登录
2. 如何探测账号状态
3. 如何启动监听
4. 如何停止监听
5. 如何发送文本消息
6. 如何把平台事件转换成 `InboundEvent`

## 与核心运行时的关系

通道层不应直接操作 `ContextManager`、`RunState` 或 `RunEngine` 的内部细节。

正式实现与验收时，通道层也不应绕过 service 层直接调用 `@openkin/core`；那只允许作为探索期临时验证，不允许进入冻结后的执行计划。

推荐链路：

```text
InboundEvent
  -> ChannelAdapter / ChannelManager
  -> Service Gateway (HTTP v1，见 shared-contracts + packages/server)
  -> Session / Run Routing
  -> Core Runtime
  -> AgentResult / StreamEvent
  -> OutboundMessage
  -> ChannelAdapter
```

## Service Gateway 边界（冻结）

Channel framework 通过 service 层接入时，默认只允许依赖最小入站到出站闭环：

- `GET /health`
- `POST /v1/sessions`
- `POST /v1/runs`
- `GET /v1/runs/:traceId/stream`

默认不允许把以下能力作为 channel adapter 的正式依赖：

- `GET /v1/sessions`、`DELETE /v1/sessions/:id`、`GET /v1/sessions/:id/messages`
- trace 查询、metrics、Agent CRUD、定时任务 API
- `/_internal/*`

原因是 channel 层的职责是平台事件适配与账号生命周期管理，而不是运维观测或服务管理；否则平台接入会反向绑定 service 的 operator surface。

## Framework 落地（exec-plan 006）

首期已在 `packages/channel-core` 冻结并实现最小可插拔契约（**不**包含任何真实 IM 平台）：

- **`ChannelAdapter`** / **`MockChannelAdapter`**：出站投递；mock 将 `OutboundMessage` 记入内存供验收。
- **`ChannelManager`**：维护 `sessionKey -> sessionId` 映射（每个 `sessionKey` 首次入站时经 service 创建会话），将用户文本经 **`ChannelServiceGateway`** 走 `004` 的 `POST /v1/sessions`、`POST /v1/runs`、`GET /v1/runs/:traceId/stream`，再把助手文本封装为 `OutboundMessage`。
- **`ChannelServiceGateway`**：仅使用 `fetch` + 共享 contract 路由，**禁止**依赖 `@openkin/core`。
- 冒烟：`pnpm test:channels`（启动真实本地 server 子进程后跑 mock 入站闭环）。

具体平台 adapter（企业微信、飞书等）仍属后续执行计划，不在 framework 首期范围内。

## 首期建议

首期先做：

- `channel-core` contract
- `ChannelManager`
- `ChannelAccount` 生命周期
- `mock adapter`
- 一条打通的入站到出站链路
- 通过 service gateway 的最小闭环

首期不做：

- 多平台并行接入
- 复杂媒体能力全覆盖
- 跨平台统一高级能力抽象

## 后续方向

在 adapter framework 稳定之后，再选择一个代表性平台打透，例如：

- 企业微信
- 飞书
- Telegram
- Discord
- OneBot / QQ 类协议
