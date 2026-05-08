# 153-A2 — 联系人列表渲染（Agent 列表 + 搜索）

> **状态**：待执行
> **前置**：153-A1
> **预估**：1d

---

## 目标

在频道左栏渲染所有 Agent 作为联系人，支持搜索过滤，点击选中进入聊天。

---

## 具体工作

### 1. 联系人项样式

```css
.channel-contact-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.channel-contact-item:hover {
  background: var(--channel-item-hover, var(--bg-muted, #eeede8));
}

.channel-contact-item.is-active {
  background: var(--channel-item-active, rgba(74, 103, 65, 0.12));
}

.channel-contact-avatar {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  overflow: hidden;
}

.channel-contact-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.channel-contact-status-dot {
  position: absolute;
  bottom: 1px;
  right: 1px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--bg-surface);
}

.channel-contact-status-dot.is-online {
  background: var(--channel-online-dot, #4caf50);
}

.channel-contact-status-dot.is-offline {
  background: var(--channel-offline-dot, #a8a59d);
}

.channel-contact-main {
  flex: 1;
  min-width: 0;
}

.channel-contact-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.channel-contact-preview {
  font-size: 11px;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}

.channel-contact-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

.channel-contact-time {
  font-size: 10px;
  color: var(--text-tertiary);
}

.channel-unread-badge {
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  background: var(--channel-unread-bg, #e04040);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
}

/* 分组标题 */
.channel-group-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  padding: 8px 12px 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

### 2. 联系人列表渲染逻辑

```js
async function refreshChannelContacts() {
  // 加载 Agent 列表
  const agents = await desktopBridge.agent.listAgents(activeBaseUrl, apiKey)
  // 合并已有会话数据
  channelConversations = mergeAgentsWithConversations(agents || [], channelConversations)
  persistChannelConversations()
}

function renderChannelContactList() {
  const filter = (document.getElementById("channel-search-input")?.value || "").toLowerCase()
  const listEl = document.getElementById("channel-contact-list")

  // 分组：在线(私聊) / 群组 / 离线
  const onlineDms = channelConversations.filter(c => c.type === 'dm' && c.agentOnline !== false)
  const groups = channelConversations.filter(c => c.type === 'group')
  const offlineDms = channelConversations.filter(c => c.type === 'dm' && c.agentOnline === false)

  // 应用搜索过滤
  const filterFn = (c) => !filter || c.name.toLowerCase().includes(filter)

  let html = ""

  if (onlineDms.filter(filterFn).length > 0) {
    html += `<div class="channel-group-title">在线</div>`
    html += onlineDms.filter(filterFn).map(renderContactItem).join("")
  }

  if (groups.filter(filterFn).length > 0) {
    html += `<div class="channel-group-title">群组</div>`
    html += groups.filter(filterFn).map(renderContactItem).join("")
  }

  if (offlineDms.filter(filterFn).length > 0) {
    html += `<div class="channel-group-title">离线</div>`
    html += offlineDms.filter(filterFn).map(renderContactItem).join("")
  }

  if (!html) {
    html = `<div class="channel-empty-state"><p>暂无联系人</p></div>`
  }

  listEl.innerHTML = html

  // 绑定点击事件
  listEl.querySelectorAll(".channel-contact-item").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-conversation-id")
      selectChannelConversation(id)
    })
  })
}

function renderContactItem(conv) {
  const isActive = conv.id === activeChannelConversationId
  const avatarBg = conv.avatarColor || "#4a6741"
  const avatarLabel = conv.name?.charAt(0) || "?"
  const avatarImg = conv.avatarUrl
    ? `<img src="${escapeHtml(conv.avatarUrl)}" alt="" />`
    : avatarLabel
  const statusClass = conv.agentOnline !== false ? "is-online" : "is-offline"
  const preview = conv.lastMessage?.content
    ? escapeHtml(conv.lastMessage.content.slice(0, 30))
    : ""
  const time = conv.lastMessage?.timestamp
    ? formatRelativeTime(conv.lastMessage.timestamp)
    : ""
  const unread = conv.unreadCount > 0
    ? `<span class="channel-unread-badge">${conv.unreadCount > 99 ? '99+' : conv.unreadCount}</span>`
    : ""

  return `
    <div class="channel-contact-item ${isActive ? 'is-active' : ''}" data-conversation-id="${escapeHtml(conv.id)}">
      <div class="channel-contact-avatar" style="background:${avatarBg};color:#fff">
        ${avatarImg}
        <span class="channel-contact-status-dot ${statusClass}"></span>
      </div>
      <div class="channel-contact-main">
        <p class="channel-contact-name">${escapeHtml(conv.name)}</p>
        <p class="channel-contact-preview">${preview}</p>
      </div>
      <div class="channel-contact-meta">
        <span class="channel-contact-time">${time}</span>
        ${unread}
      </div>
    </div>
  `
}
```

### 3. 选中联系人 → 进入聊天

```js
let activeChannelConversationId = null

async function selectChannelConversation(convId) {
  activeChannelConversationId = convId
  renderChannelContactList()

  const conv = channelConversations.find(c => c.id === convId)
  if (!conv) return

  // 更新聊天头部
  const titleEl = document.getElementById("channel-chat-title")
  if (titleEl) titleEl.textContent = conv.name

  // 显示输入框
  const composer = document.getElementById("channel-composer")
  if (composer) composer.classList.remove("is-hidden")

  // 清除未读
  conv.unreadCount = 0
  persistChannelConversations()

  // 加载消息（后续工单实现）
  await loadChannelMessages(conv)
}
```

### 4. 搜索过滤

```js
document.getElementById("channel-search-input")?.addEventListener("input", () => {
  renderChannelContactList()
})
```

---

## 验收标准

1. ✅ 频道左栏显示所有 Agent 为联系人（带头像、名称、在线状态点）
2. ✅ 在线 Agent 和离线 Agent 分组显示
3. ✅ 搜索框输入可实时过滤联系人
4. ✅ 点击联系人后高亮选中，中栏标题更新为联系人名称
5. ✅ 未读红点/数字正确显示（初始为 0）
6. ✅ Agent 启用/禁用后刷新联系人列表状态点变化

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `apps/desktop/renderer/styles.css` | 新增联系人列表样式 |
| `apps/desktop/renderer/app.js` | 新增联系人渲染、搜索、选中逻辑 |
