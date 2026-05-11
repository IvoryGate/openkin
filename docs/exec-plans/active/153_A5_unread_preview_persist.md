# 153-A5 — 未读消息数 + 最近消息预览 + 持久化

> **状态**：待执行
> **前置**：153-A4
> **预估**：1d

---

## 目标

完善频道会话的元数据管理：未读消息计数、最近消息预览、本地持久化、SSE 实时推送更新。

---

## 具体工作

### 1. 未读消息计数

- 当用户不在某个私聊页面时，收到该私聊的新消息，累加 `unreadCount`
- 当用户切换到该私聊时，清零 `unreadCount`
- 联系人列表显示红点/数字

### 2. 最近消息预览

- 每次收到新消息后更新 `conv.lastMessage`
- 联系人列表显示截断的消息预览 + 相对时间

### 3. 持久化

- 所有 `ChannelConversation` 数据存入 `localStorage`
- 包括：sessionId、agentIds、name、avatarUrl、lastMessage、unreadCount、pinnedAt、muted

### 4. SSE 实时更新

- 复用 Task SSE 订阅机制，扩展为监听所有 Session 的新消息事件
- 当收到消息事件时：
  - 如果是当前打开的私聊 → 直接追加消息
  - 如果是其他私聊 → 增加未读数 + 更新预览 + Toast 通知
- 简单方案：基于 `refreshSystemStatus` 轮询周期，定期检查活跃频道的消息变化

### 5. 初始化同步

- 进入频道视图时，遍历所有已有 `ChannelConversation`，拉取每个 Session 的最新消息
- 更新 `lastMessage` 和 `unreadCount`（对比上次已读位置）

---

## 验收标准

1. ✅ 退出私聊后收到新消息，联系人列表显示未读红点
2. ✅ 进入私聊后未读数清零
3. ✅ 联系人列表实时更新最近消息预览
4. ✅ 刷新页面后未读数和预览信息保留
5. ✅ 新消息到达时，当前打开的私聊实时追加消息

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `apps/desktop/renderer/app.js` | 新增未读计数、预览更新、持久化逻辑 |
