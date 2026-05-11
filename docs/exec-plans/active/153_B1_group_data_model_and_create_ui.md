# 153-B1 — 群组数据模型 + 创建群聊 UI

> **状态**：待执行
> **前置**：153-A5
> **预估**：1d

---

## 目标

建立群聊数据模型，实现"新建群聊"的完整流程：选择 Agent → 输入群名 → 创建群组 → 出现在联系人列表。

---

## 核心设计

### 群聊数据模型

```ts
ChannelConversation (type: 'group') {
  id: string              // 客户端生成 UUID
  type: 'group'
  name: string            // 群名
  avatarUrl?: string      // 群头像（首期用群名首字母）
  agentIds: string[]      // 群内 Agent ID 列表
  sessionId: string       // 对应后端 Session（kind=channel）
  lastMessage?: {...}
  unreadCount: number
  createdAt: number
  updatedAt: number
}
```

### 创建群聊 UI

1. 点击左栏底部"新建群聊"按钮
2. 弹出 Center Flyout：
   - 群名输入框
   - Agent 多选列表（checkbox，显示已选数量）
   - "创建"按钮
3. 创建流程：
   - 生成 UUID
   - 创建 Session（kind=channel）
   - 保存 `ChannelConversation` 到 localStorage
   - 刷新联系人列表

---

## 验收标准

1. ✅ 点击"新建群聊"弹出创建面板
2. ✅ 可输入群名，至少选择 2 个 Agent
3. ✅ 创建后群组出现在联系人列表"群组"分区
4. ✅ 点击群组进入群聊视图
5. ✅ 刷新页面后群组信息保留

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `apps/desktop/renderer/index.html` | 新增群聊创建 Flyout |
| `apps/desktop/renderer/styles.css` | 群聊创建样式 |
| `apps/desktop/renderer/app.js` | 群组数据模型 + 创建逻辑 |
