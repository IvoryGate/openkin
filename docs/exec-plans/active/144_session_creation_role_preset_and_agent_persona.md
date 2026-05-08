# 144 · 会话创建角色预设与 Agent 个性接入

## 任务边界

本单目标：在 Desktop 客户端“新建会话”前增加角色选择（基于 Agent 列表），让用户在会话开始时即可指定“由哪个 Agent 个性来协作”。

范围聚焦：

- 新建会话时展示角色选择入口
- 会话与角色偏好绑定（客户端侧）
- 运行请求按会话偏好携带 `agentId`（若可用）

## 调研结论

- 现有 `GET /v1/agents` 已可读取 Agent 列表（含 `name/systemPrompt/model`）。
- 现有 `POST /v1/sessions` 仅接受 `kind`，服务端当前不从请求体写入 `agentId`。
- 因此本单先走 **L5 客户端偏好绑定方案**：不侵入前四层 contract。

## 实施方案（单一路径）

1. 在新建会话流程增加角色选择弹层（默认选当前主 Agent）。
2. 新建后将 `sessionId -> agentId` 偏好保存到本地存储。
3. 会话切换时优先显示该偏好对应 Agent 身份（名称/头像）。
4. 发送 run 时把会话偏好作为 `agentId` 下发（仅当偏好存在且有效）。

## 允许修改目录

- `apps/desktop/**`
- `docs/exec-plans/active/**`

## 不允许修改目录

- `packages/shared/contracts/**`
- `packages/server/**`
- `packages/sdk/**`

## 验收标准

- 用户点击“新建”可先选角色再创建会话。
- 会话列表能体现所选角色身份（名称/头像）。
- 同一会话发送消息时使用该角色偏好参与运行请求。
- `pnpm --filter @theworld/desktop check` 通过。

## 升级条件（命中即停）

- 仅客户端偏好无法满足角色绑定一致性（需服务端落库）；
- 出现多后端不一致导致角色偏好错配；
- 连续两轮无法通过桌面端类型检查。
