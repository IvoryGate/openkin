# 153-A4 — 私聊消息收发（复用 Session/Run API）

> **状态**：待执行
> **前置**：153-A3
> **预估**：1d

---

## 目标

在频道私聊中实现完整的消息收发：用户发送消息 → 创建/复用 Session → 创建 Run → 流式接收回复 → 更新消息气泡。

---

## 具体工作

### 1. 私聊 Session 管理

```js
async function ensureChannelSession(conv) {
  if (conv.sessionId) return conv

  // 创建 channel 类型的 Session
  const result = await desktopBridge.session.createSession(activeBaseUrl, apiKey)
  // 注意：当前 bridge 的 createSession 不支持 kind 参数
  // 首期使用默认 kind，后续 149 收敛后传递 kind: 'channel'
  conv.sessionId = result.id
  persistChannelConversations()
  return conv
}
```

### 2. 发送消息

```js
async function sendChannelMessage() {
  const inputEl = document.getElementById("channel-composer-input")
  const text = inputEl?.value?.trim()
  if (!text || !activeChannelConversationId) return

  const conv = channelConversations.find(c => c.id === activeChannelConversationId)
  if (!conv) return

  // 确保 Session 存在
  await ensureChannelSession(conv)

  // 清空输入
  inputEl.value = ""

  // 1. 立即渲染用户消息
  appendChannelMessage({
    role: "user",
    content: text,
    createdAt: Date.now(),
  }, conv)

  // 2. 显示"回复中"指示器
  showChannelTypingIndicator(conv)

  // 3. 发送到后端
  try {
    const { traceId } = await desktopBridge.session.createRun(
      activeBaseUrl,
      conv.sessionId,
      text,
      apiKey,
      { agentId: conv.agentIds?.[0] }
    )

    // 4. 流式接收回复
    await desktopBridge.session.streamRunUntilTerminal(
      activeBaseUrl,
      traceId,
      apiKey,
      (event) => {
        handleChannelStreamEvent(event, conv)
      }
    )

    // 5. 移除"回复中"，加载最终消息
    hideChannelTypingIndicator()
    await loadChannelMessages(conv)

    // 6. 更新会话预览
    conv.lastMessage = { content: text, senderRole: "user", timestamp: Date.now() }
    conv.updatedAt = Date.now()
    persistChannelConversations()
    renderChannelContactList()

  } catch (e) {
    hideChannelTypingIndicator()
    showToast("error", `发送失败：${e instanceof Error ? e.message : String(e)}`)
  }
}
```

### 3. 追加消息到列表

```js
function appendChannelMessage(msg, conv) {
  const listEl = document.getElementById("channel-message-list")
  // 移除空态提示
  const emptyState = listEl.querySelector(".channel-empty-state")
  if (emptyState) emptyState.remove()

  const isUser = msg.role === "user"
  const rowClass = isUser ? "is-user" : "is-agent"
  let avatarInner, senderName
  if (isUser) {
    avatarInner = "我"
  } else {
    senderName = conv.name || "Agent"
    avatarInner = senderName.charAt(0)
  }

  const html = `
    <div class="channel-msg-row ${rowClass}">
      <div class="channel-msg-avatar">${avatarInner}</div>
      <div class="channel-msg-body">
        ${!isUser ? `<span class="channel-msg-sender">${escapeHtml(senderName)}</span>` : ""}
        <div class="channel-msg-bubble">${renderMessageContent(msg.content)}</div>
        <span class="channel-msg-time">${formatRelativeTime(msg.createdAt)}</span>
      </div>
    </div>
  `

  listEl.insertAdjacentHTML("beforeend", html)
  listEl.scrollTop = listEl.scrollHeight
}
```

### 4. 回复中指示器

```js
function showChannelTypingIndicator(conv) {
  const listEl = document.getElementById("channel-message-list")
  const name = conv.name || "Agent"
  const html = `
    <div class="channel-msg-row is-agent" id="channel-typing-row">
      <div class="channel-msg-avatar">${name.charAt(0)}</div>
      <div class="channel-msg-body">
        <span class="channel-msg-sender">${escapeHtml(name)}</span>
        <div class="channel-msg-bubble">
          <div class="channel-typing-indicator"><span></span><span></span><span></span></div>
        </div>
      </div>
    </div>
  `
  listEl.insertAdjacentHTML("beforeend", html)
  listEl.scrollTop = listEl.scrollHeight
}

function hideChannelTypingIndicator() {
  const typingRow = document.getElementById("channel-typing-row")
  if (typingRow) typingRow.remove()
}
```

### 5. 绑定发送事件

```js
// Enter 发送，Shift+Enter 换行
document.getElementById("channel-composer-input")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault()
    sendChannelMessage()
  }
})

document.getElementById("channel-send-btn")?.addEventListener("click", () => {
  sendChannelMessage()
})
```

### 6. 流式事件处理

```js
function handleChannelStreamEvent(event, conv) {
  // 复用现有的 StreamEvent 处理逻辑
  // 如果 event.type 包含 text delta，追加到当前 Agent 气泡
  if (event.type === "text_delta" || event.type === "run_text_delta") {
    // 实时追加文本到最后的 Agent 气泡
    appendChannelStreamText(event.payload?.text || event.payload?.delta || "")
  }
}
```

---

## 验收标准

1. ✅ 选中 Agent → 输入消息 → 按发送 → 用户消息立即出现
2. ✅ Agent 回复中显示打字动画指示器
3. ✅ Agent 回复完成后消息气泡正常显示
4. ✅ 流式文本增量更新（不是等全部完成后才出现）
5. ✅ Enter 发送，Shift+Enter 换行
6. ✅ 发送失败时显示 Toast 错误提示
7. ✅ 会话列表中最近消息预览更新
8. ✅ 首次聊天自动创建 Session，后续聊天复用同一 Session

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `apps/desktop/renderer/app.js` | 新增发送/接收/流式处理逻辑 |
