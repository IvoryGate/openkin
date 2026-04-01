# Security

## 目标

本文件记录当前探索分支上的安全边界，避免后续在服务层、SDK 层、通道层逐步扩展时出现默认开放的问题。

## 当前安全重点

### 1. Tool 权限

- 工具可见性和工具执行权限必须分离
- 高风险工具不应默认暴露
- 通道消息不应直接映射成高权限工具执行

### 2. Session 隔离

- 不同 session 的上下文不得串台
- 不同 channel account 的消息不得混到同一 session

### 3. Prompt 与上下文

- `systemPrompt` 不得被用户输入覆盖
- 外部注入内容必须有明确来源
- 长历史压缩不能破坏系统级约束

### 4. Channel 接入

- adapter 登录态与账号状态必须可控
- 平台 token、cookie、二维码登录材料不能作为普通日志输出
- adapter 不应直接拥有核心系统的无限权限

### 5. SDK 与 API

- SDK 不应暴露服务端内部实现细节
- 对外事件协议不能泄露内部私有字段
- trace 查询权限后续必须纳入鉴权模型

## 后续需要落实为机制的部分

- tool permission guard
- channel account credential handling
- service auth model
- trace access policy
