# Channels

## 目标

即时通讯接入首期不优先打透某一个平台，而是先建立统一的通道适配框架。

这样做的原因：

1. 平台会不断增加
2. 每个平台的认证、消息格式、媒体能力都不同
3. 如果没有统一 adapter contract，后续每接一个平台都会侵入核心服务层

## 核心思想

> 平台差异属于 adapter 层，账号生命周期和统一消息模型属于 channel core。

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

推荐链路：

```text
InboundEvent
  -> Service Gateway
  -> Session / Run Routing
  -> Core Runtime
  -> AgentResult / StreamEvent
  -> OutboundMessage
  -> ChannelAdapter
```

## 首期建议

首期先做：

- `channel-core` contract
- `ChannelManager`
- `ChannelAccount` 生命周期
- `mock adapter`
- 一条打通的入站到出站链路

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
