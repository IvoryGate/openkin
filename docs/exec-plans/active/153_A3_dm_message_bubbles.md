# 153-A3 — 私聊消息气泡样式（左右分列 IM 风格）

> **状态**：待执行
> **前置**：153-A2
> **预估**：1d

---

## 目标

在频道中栏实现 IM 风格的消息气泡：用户消息靠右，Agent 消息靠左，带头像和名称标识。

---

## 具体工作

### 1. 消息气泡样式

```css
/* ── Channel Message Bubbles ───────────────────────────────────── */

.channel-msg-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  max-width: 75%;
}

.channel-msg-row.is-user {
  margin-left: auto;
  flex-direction: row-reverse;
}

.channel-msg-row.is-agent {
  margin-right: auto;
}

.channel-msg-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
}

.channel-msg-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.channel-msg-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.channel-msg-sender {
  font-size: 11px;
  color: var(--text-tertiary);
  font-weight: 500;
}

.channel-msg-row.is-user .channel-msg-sender {
  text-align: right;
}

.channel-msg-bubble {
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
  position: relative;
}

.channel-msg-row.is-user .channel-msg-bubble {
  background: var(--channel-msg-user-bg, var(--bg-accent, #4a6741));
  color: var(--channel-msg-user-text, #fff);
  border-bottom-right-radius: 4px;
}

.channel-msg-row.is-agent .channel-msg-bubble {
  background: var(--channel-msg-agent-bg, var(--bg-input, #fff));
  color: var(--channel-msg-agent-text, var(--text-primary));
  border: 1px solid var(--border-light, #e2e0d8);
  border-bottom-left-radius: 4px;
}

.channel-msg-time {
  font-size: 10px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.channel-msg-row.is-user .channel-msg-time {
  text-align: right;
}

/* 时间戳分隔线 */
.channel-time-divider {
  text-align: center;
  margin: 16px 0;
  position: relative;
}

.channel-time-divider::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  background: var(--border-light, #e2e0d8);
}

.channel-time-divider span {
  position: relative;
  background: var(--bg-base);
  padding: 0 12px;
  font-size: 11px;
  color: var(--text-tertiary);
}

/* 回复中动画 */
.channel-typing-indicator {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
}

.channel-typing-indicator span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-tertiary);
  animation: typing-bounce 1.2s infinite;
}

.channel-typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.channel-typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}
```

### 2. 消息渲染逻辑

```js
async function loadChannelMessages(conv) {
  const listEl = document.getElementById("channel-message-list")
  if (!conv?.sessionId) {
    listEl.innerHTML = '<div class="channel-empty-state"><h3>开始对话</h3><p>发送第一条消息吧</p></div>'
    return
  }

  const messages = await desktopBridge.session.getSessionMessages(activeBaseUrl, conv.sessionId, apiKey)
  if (!Array.isArray(messages) || messages.length === 0) {
    listEl.innerHTML = '<div class="channel-empty-state"><h3>开始对话</h3><p>发送第一条消息吧</p></div>'
    return
  }

  listEl.innerHTML = renderChannelMessages(messages, conv)
  listEl.scrollTop = listEl.scrollHeight
}

function renderChannelMessages(messages, conv) {
  let html = ""
  let lastTimestamp = 0

  for (const msg of messages) {
    // 时间戳分隔（5分钟间隔）
    if (msg.createdAt - lastTimestamp > 5 * 60 * 1000) {
      html += `<div class="channel-time-divider"><span>${formatRelativeTime(msg.createdAt)}</span></div>`
    }
    lastTimestamp = msg.createdAt

    const isUser = msg.role === "user"
    const rowClass = isUser ? "is-user" : "is-agent"

    let avatarInner, senderName
    if (isUser) {
      avatarInner = "我"
      senderName = "我"
    } else {
      // Agent 消息
      const agentName = conv.agentName || "Agent"
      avatarInner = agentName.charAt(0)
      senderName = agentName
    }

    html += `
      <div class="channel-msg-row ${rowClass}">
        <div class="channel-msg-avatar">${avatarInner}</div>
        <div class="channel-msg-body">
          ${!isUser ? `<span class="channel-msg-sender">${escapeHtml(senderName)}</span>` : ""}
          <div class="channel-msg-bubble">${renderMessageContent(msg.content)}</div>
          <span class="channel-msg-time">${formatRelativeTime(msg.createdAt)}</span>
        </div>
      </div>
    `
  }

  return html
}
```

---

## 验收标准

1. ✅ 用户消息靠右、绿色气泡
2. ✅ Agent 消息靠左、白色气泡+边框
3. ✅ Agent 消息左上角显示头像和名称
4. ✅ 超过 5 分钟间隔的消息之间有时间戳分隔线
5. ✅ Markdown / 代码块在气泡内正确渲染
6. ✅ 长消息自动换行、不超过 75% 宽度
7. ✅ 亮色/暗色主题下气泡颜色均协调

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `apps/desktop/renderer/styles.css` | 新增消息气泡样式 |
| `apps/desktop/renderer/app.js` | 新增消息渲染逻辑 |
