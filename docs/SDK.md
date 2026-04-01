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

### Session API

- `createSession()`
- `getSession()`
- `listSessions()`

### Run API

- `run(input, options)`
- `streamRun(input, options)`
- `cancelRun(traceId)`

### Event API

- `onMessage()`
- `onStepTrace()`
- `onToolCall()`
- `onToolResult()`
- `onRunCompleted()`
- `onRunFailed()`

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
2. 发起一次非流式 run
3. 发起一次流式 run
4. 接收标准化错误
5. 与 traceId、sessionId 对齐

## 后续扩展方向

- 浏览器 SDK
- Node.js SDK
- 桌面端共享 SDK
- 移动端桥接 SDK
