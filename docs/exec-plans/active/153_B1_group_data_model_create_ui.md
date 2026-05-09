# 153-B1 — 群组数据模型 + 创建群聊 UI

> **状态**：✅ 已实现
> **前置**：153-A5（已完成）
> **预估**：1d

---

## 目标

实现群聊的创建流程：用户点击"新建群聊"按钮，弹出选人弹窗，输入群名，选择 Agent 成员，创建群组会话。

---

## 已实现功能

### 创建群聊弹窗

- 点击左侧栏"新建群聊"按钮打开弹窗
- 弹窗包含：
  - 群名称输入框（可选，留空则自动用前3个Agent名拼接）
  - Agent 多选列表（带勾选框、头像、在线状态点）
  - 取消 / 创建按钮
  - 输入验证（至少选1个Agent）
- 创建后自动选中新群聊、切换到聊天视图

### 群组数据模型

```ts
ChannelConversation (type: "group") {
  id: `grp_${timestamp}_${random}`  // 前端生成
  type: "group"
  name: string                      // 群名
  agentIds: string[]                // Agent ID 列表
  sessionId: null                   // 群聊无单一 session
  lastMessage: null
  unreadCount: 0
  createdAt: number
  updatedAt: number
}
```

持久化在 `localStorage` (`theworld_channel_conversations_v1`)。

### 群聊组合头像

群聊在联系人列表中使用 2×2 组合头像（类似微信群头像）：
- 取前4个 Agent 的头像色块首字母
- 使用 CSS Grid 排列
- 背景色为 `var(--bg-muted)`

---

## 涉及文件

- `apps/desktop/renderer/index.html` — 新增创建群聊弹窗 HTML
- `apps/desktop/renderer/app.js` — 创建群聊逻辑、组合头像渲染
- `apps/desktop/renderer/styles.css` — 弹窗样式、组合头像样式、Agent 选择器样式

---

## 验收标准

1. ✅ 点击"新建群聊"打开弹窗
2. ✅ 弹窗显示所有 Agent，可选择/取消
3. ✅ 创建后群聊出现在"群组"分区
4. ✅ 群聊使用组合头像（非单色首字母）
5. ✅ 群名留空时自动生成
6. ✅ 至少选1个Agent的验证生效
