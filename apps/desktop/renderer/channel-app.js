/**
 * channel-app.js — Channel/频道 feature module
 *
 * Extracted from app.js to reduce file size and avoid apply model interference.
 * This is a plain script (not module), loaded after app.js.
 * Dependencies on app.js internals are accessed via window.
 */

const CHANNEL_STORAGE_KEY = "theworld_channel_conversations_v1"
const AGENT_COLORS = ["#6b9e78", "#5b8ec9", "#9b7fb8", "#d4845a", "#c76b6b", "#4da89a", "#7b6bb5", "#c97a5a"]

let channelInitialized = false
let channelConversations = []
let activeChannelConversationId = null

function getAgentColor(agentId) {
  let hash = 0
  for (const ch of agentId) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length]
}

function loadChannelConversations() {
  try {
    const raw = localStorage.getItem(CHANNEL_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function persistChannelConversations() {
  try {
    localStorage.setItem(CHANNEL_STORAGE_KEY, JSON.stringify(channelConversations))
  } catch { /* quota exceeded */ }
}

async function initChannelView() {
  if (channelInitialized) return
  channelInitialized = true
  channelConversations = loadChannelConversations()
  await refreshChannelContacts()
  renderChannelContactList()
}

async function refreshChannelContacts() {
  if (!desktopBridge?.agent?.listAgents) return
  try {
    const agents = await desktopBridge.agent.listAgents(activeBaseUrl, apiKey)
    if (!Array.isArray(agents)) return

    // Merge: update existing DMs, create new DMs for agents not yet in the list
    const existingAgentIds = new Set(channelConversations.filter(c => c.type === 'dm').map(c => c.agentIds?.[0]).filter(Boolean))

    for (const agent of agents) {
      if (!existingAgentIds.has(agent.id)) {
        channelConversations.push({
          id: `dm_${agent.id}`,
          type: 'dm',
          name: agent.name || agent.displayName || agent.id,
          avatarUrl: agent.avatarUrl || agent.avatar || agent.iconUrl || agent.imageUrl || null,
          avatarColor: getAgentColor(agent.id),
          agentIds: [agent.id],
          agentName: agent.name || agent.displayName || agent.id,
          agentOnline: agent.enabled !== false,
          sessionId: null,
          lastMessage: null,
          unreadCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      } else {
        // Update online status and name
        const conv = channelConversations.find(c => c.type === 'dm' && c.agentIds?.[0] === agent.id)
        if (conv) {
          conv.agentOnline = agent.enabled !== false
          conv.name = agent.name || agent.displayName || agent.id
          conv.avatarUrl = agent.avatarUrl || agent.avatar || agent.iconUrl || agent.imageUrl || null
        }
      }
    }

    // Sort: groups first, then by updatedAt
    channelConversations.sort((a, b) => {
      if (a.type === 'group' && b.type !== 'group') return -1
      if (a.type !== 'group' && b.type === 'group') return 1
      return (b.updatedAt || 0) - (a.updatedAt || 0)
    })

    persistChannelConversations()
  } catch (e) {
    console.error("refreshChannelContacts failed:", e)
  }
}

function renderChannelContactList() {
  const listEl = document.getElementById("channel-contact-list")
  if (!listEl) return

  const filter = (document.getElementById("channel-search-input")?.value || "").toLowerCase()
  const filterFn = (c) => !filter || (c.name || "").toLowerCase().includes(filter)

  const onlineDms = channelConversations.filter(c => c.type === 'dm' && c.agentOnline !== false)
  const groups = channelConversations.filter(c => c.type === 'group')
  const offlineDms = channelConversations.filter(c => c.type === 'dm' && c.agentOnline === false)

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

  listEl.querySelectorAll(".channel-contact-item").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-conversation-id")
      selectChannelConversation(id)
    })
  })
}

function renderContactItem(conv) {
  const isActive = conv.id === activeChannelConversationId
  const isGroup = conv.type === "group"

  // Group composite avatar or DM avatar
  const avatarContent = isGroup
    ? renderGroupCompositeAvatar(conv)
    : (conv.avatarUrl
        ? `<img src="${escapeHtml(conv.avatarUrl)}" alt="" />`
        : escapeHtml(conv.name?.charAt(0) || "?"))

  const avatarBg = isGroup ? "var(--bg-muted, #eeede8)" : (conv.avatarColor || "#6b9e78")
  const statusClass = conv.type === 'dm' ? (conv.agentOnline !== false ? "is-online" : "is-offline") : ""
  const preview = conv.lastMessage?.content
    ? escapeHtml(conv.lastMessage.content.slice(0, 30))
    : (conv.type === 'group' ? `${conv.agentIds.length} 个成员` : "")
  const time = conv.lastMessage?.timestamp
    ? formatRelativeTime(conv.lastMessage.timestamp)
    : ""
  const unread = conv.unreadCount > 0
    ? `<span class="channel-unread-badge">${conv.unreadCount > 99 ? '99+' : conv.unreadCount}</span>`
    : ""

  return `
    <div class="channel-contact-item ${isActive ? 'is-active' : ''}" data-conversation-id="${escapeHtml(conv.id)}">
      <div class="channel-contact-avatar" style="background:${avatarBg}">
        ${avatarContent}
        ${statusClass ? `<span class="channel-contact-status-dot ${statusClass}"></span>` : ""}
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

async function selectChannelConversation(convId) {
  activeChannelConversationId = convId
  renderChannelContactList()

  const conv = channelConversations.find(c => c.id === convId)
  if (!conv) return

  // Update chat header
  const titleEl = document.getElementById("channel-chat-title")
  if (titleEl) titleEl.textContent = conv.name

  // Show composer
  const composer = document.getElementById("channel-composer")
  if (composer) composer.classList.remove("is-hidden")

  // Show info panel for DM
  const infoPanel = document.getElementById("channel-info-panel")
  if (infoPanel) infoPanel.classList.remove("is-hidden")
  const infoTitle = document.getElementById("channel-info-title")
  if (infoTitle) infoTitle.textContent = conv.type === 'dm' ? '联系人详情' : '群组详情'

  // Render info content
  const infoContent = document.getElementById("channel-info-content")
  if (infoContent) {
    if (conv.type === 'dm') {
      infoContent.innerHTML = `
        <div style="text-align:center;margin-bottom:16px">
          <div class="channel-contact-avatar" style="background:${conv.avatarColor || '#6b9e78'};width:64px;height:64px;font-size:24px;margin:0 auto">
            ${conv.avatarUrl ? `<img src="${escapeHtml(conv.avatarUrl)}" alt="" />` : escapeHtml(conv.name?.charAt(0) || '?')}
          </div>
          <h4 style="margin:8px 0 4px">${escapeHtml(conv.name)}</h4>
          <p style="color:var(--text-tertiary);font-size:12px">${conv.agentOnline !== false ? '在线' : '离线'}</p>
        </div>
      `
    } else {
      const memberList = (conv.agentIds || []).map(aid => {
        const agent = channelConversations.find(c => c.type === 'dm' && c.agentIds?.[0] === aid)
        const avatarBg = agent?.avatarColor || getAgentColor(aid)
        const avatarLabel = agent?.name?.charAt(0) || "?"
        const avatarImg = agent?.avatarUrl
          ? `<img src="${escapeHtml(agent.avatarUrl)}" alt="" />`
          : escapeHtml(avatarLabel)
        return `<div class="channel-member-row">
          <div class="channel-msg-avatar" style="background:${avatarBg};width:28px;height:28px;font-size:12px">${avatarImg}</div>
          <span style="font-size:12px">${escapeHtml(agent?.name || aid)}</span>
        </div>`
      }).join("")
      infoContent.innerHTML = `
        <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:8px">群成员 (${conv.agentIds.length + 1})</p>
        <div class="channel-member-row">
          <div class="channel-msg-avatar" style="background:#7986cb;width:28px;height:28px;font-size:12px">我</div>
          <span style="font-size:12px">我（用户）</span>
        </div>
        ${memberList}
      `
    }
  }

  // Clear unread
  conv.unreadCount = 0
  persistChannelConversations()

  // Load messages from local store
  channelMessages = loadChannelMessages()
  renderChannelMessages(convId)
}

function formatRelativeTime(ts) {
  if (!ts) return ""
  const now = Date.now()
  const diff = now - ts
  if (diff < 60000) return "刚刚"
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${Math.floor(diff / 86400000)} 天前`
}

// Search filter
document.getElementById("channel-search-input")?.addEventListener("input", () => {
  renderChannelContactList()
})

// ── Channel Message Store & Rendering ───────────────────────────────────

const CHANNEL_MESSAGES_KEY = "theworld_channel_messages_v1"
let channelMessages = {} // { conversationId: [ { id, role, senderId, senderName, content, timestamp, avatarColor } ] }
let channelStreaming = {} // { conversationId: { traceId, agentId, buffer } }  active streaming state (DM)
let channelGroupStreaming = {} // { conversationId: { [agentId]: { traceId, buffer, status: 'streaming'|'done'|'skipped' } } } (Group)
let _groupRenderRaf = null // RAF throttle for group streaming renders

function loadChannelMessages() {
  try {
    const raw = localStorage.getItem(CHANNEL_MESSAGES_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function persistChannelMessages() {
  try {
    localStorage.setItem(CHANNEL_MESSAGES_KEY, JSON.stringify(channelMessages))
  } catch { /* quota */ }
}

function getChannelMsgId() {
  return `chmsg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function formatChatTime(ts) {
  if (!ts) return ""
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${hh}:${mm}`
}

function shouldShowTimeDivider(msgs, idx) {
  if (idx === 0) return true
  const prev = msgs[idx - 1]
  const curr = msgs[idx]
  if (!prev || !curr) return false
  // Show divider if > 5 min gap
  return (curr.timestamp - prev.timestamp) > 300000
}

function formatDividerTime(ts) {
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  if (isToday) return time
  if (isYesterday) return `昨天 ${time}`
  return `${d.getMonth() + 1}/${d.getDate()} ${time}`
}

function renderChannelMessages(convId) {
  const listEl = document.getElementById("channel-message-list")
  if (!listEl) return

  const msgs = channelMessages[convId] || []
  const conv = channelConversations.find(c => c.id === convId)

  if (msgs.length === 0) {
    listEl.innerHTML = '<div class="channel-empty-state"><h3>开始对话</h3><p>发送第一条消息吧</p></div>'
    return
  }

  let html = ""
  for (let i = 0; i < msgs.length; i++) {
    const msg = msgs[i]
    const isUser = msg.role === "user"
    const isAgent = msg.role === "assistant"

    // Time divider
    if (shouldShowTimeDivider(msgs, i)) {
      html += `<div class="channel-time-divider"><span>${formatDividerTime(msg.timestamp)}</span></div>`
    }

    const avatarBg = msg.avatarColor || (isUser ? "#7986cb" : "#6b9e78")
    const avatarLabel = isUser ? "我" : (msg.senderName?.charAt(0) || "?")
    const avatarImg = msg.avatarUrl
      ? `<img src="${escapeHtml(msg.avatarUrl)}" alt="" />`
      : escapeHtml(avatarLabel)

    // For group chats, show agent color bar
    const isGroup = conv?.type === "group"
    const agentColorStyle = isGroup && isAgent ? `--agent-color:${avatarBg}` : ""
    const hasAgentColorClass = isGroup && isAgent ? " has-agent-color" : ""

    html += `
      <div class="channel-msg-row ${isUser ? 'is-user' : 'is-agent'}" ${agentColorStyle ? `style="${agentColorStyle}"` : ""}>
        <div class="channel-msg-avatar" style="background:${avatarBg}">
          ${avatarImg}
        </div>
        <div class="channel-msg-body">
          <span class="channel-msg-sender${hasAgentColorClass}" ${agentColorStyle ? `style="--agent-color:${avatarBg}"` : ""}>${escapeHtml(isUser ? "我" : (msg.senderName || "Agent"))}</span>
          <div class="channel-msg-bubble${hasAgentColorClass}" ${agentColorStyle ? `style="--agent-color:${avatarBg}"` : ""}>${renderBubbleContent(msg.content, convId)}</div>
          <span class="channel-msg-time">${formatChatTime(msg.timestamp)}</span>
        </div>
      </div>
    `
  }

  // Streaming indicator — DM (single agent)
  const streaming = channelStreaming[convId]
  if (streaming) {
    const conv2 = channelConversations.find(c => c.id === convId)
    const agentInfo = conv2?.type === "dm"
      ? conv2
      : channelConversations.find(c => c.type === "dm" && c.agentIds?.[0] === streaming.agentId)
    const avatarBg = agentInfo?.avatarColor || "#6b9e78"
    const avatarLabel = agentInfo?.name?.charAt(0) || "?"
    html += `
      <div class="channel-msg-row is-agent channel-msg-streaming">
        <div class="channel-msg-avatar" style="background:${avatarBg}">${escapeHtml(avatarLabel)}</div>
        <div class="channel-msg-body">
          <span class="channel-msg-sender">${escapeHtml(agentInfo?.name || "Agent")}</span>
          <div class="channel-msg-bubble">
            ${streaming.buffer ? renderBubbleContent(streaming.buffer, convId) : '<div class="channel-typing-indicator"><span></span><span></span><span></span></div>'}
          </div>
        </div>
      </div>
    `
  }

  // Streaming indicators — Group (multiple agents streaming in parallel)
  const groupStreaming = channelGroupStreaming[convId]
  if (groupStreaming && conv?.type === "group") {
    const streamingAgentIds = Object.keys(groupStreaming)
    for (const agentId of streamingAgentIds) {
      const agentState = groupStreaming[agentId]
      if (agentState.status === 'skipped') continue

      const agentConv = channelConversations.find(c => c.type === 'dm' && c.agentIds?.[0] === agentId)
      const avatarBg = agentConv?.avatarColor || getAgentColor(agentId)
      const avatarLabel = agentConv?.name?.charAt(0) || "?"
      const agentName = agentConv?.name || agentId
      const agentColorStyle = `--agent-color:${avatarBg}`

      html += `
        <div class="channel-msg-row is-agent channel-msg-streaming" style="${agentColorStyle}">
          <div class="channel-msg-avatar" style="background:${avatarBg}">${escapeHtml(avatarLabel)}</div>
          <div class="channel-msg-body">
            <span class="channel-msg-sender has-agent-color" style="${agentColorStyle}">${escapeHtml(agentName)}</span>
            <div class="channel-msg-bubble has-agent-color" style="${agentColorStyle}">
              ${agentState.buffer ? renderBubbleContent(agentState.buffer, convId) : '<div class="channel-typing-indicator"><span></span><span></span><span></span></div>'}
            </div>
          </div>
        </div>
      `
    }
  }

  listEl.innerHTML = html

  // Scroll to bottom
  requestAnimationFrame(() => {
    listEl.scrollTop = listEl.scrollHeight
  })
}

// ── Channel DM Send ─────────────────────────────────────────────────────

async function sendChannelDmMessage(convId, text) {
  const conv = channelConversations.find(c => c.id === convId)
  if (!conv || conv.type !== "dm") return

  // Add user message to local store
  if (!channelMessages[convId]) channelMessages[convId] = []
  const userMsg = {
    id: getChannelMsgId(),
    role: "user",
    senderId: "user",
    senderName: "我",
    content: text,
    timestamp: Date.now(),
    avatarColor: "#7986cb",
  }
  channelMessages[convId].push(userMsg)
  conv.lastMessage = { content: text, timestamp: userMsg.timestamp }
  conv.updatedAt = userMsg.timestamp
  persistChannelMessages()
  persistChannelConversations()
  renderChannelMessages(convId)
  renderChannelContactList()

  // Ensure session exists
  if (!conv.sessionId) {
    try {
      if (!desktopBridge?.session?.createSession) {
        showToast("error", "无法创建会话：接口不可用")
        return
      }
      const created = await desktopBridge.session.createSession(activeBaseUrl, apiKey)
      conv.sessionId = created.id
      persistChannelConversations()
    } catch (e) {
      showToast("error", `创建会话失败：${e instanceof Error ? e.message : String(e)}`)
      return
    }
  }

  // Send run
  try {
    const agentId = conv.agentIds?.[0] || ""
    const runOpts = agentId ? { agentId } : {}
    const { traceId } = await desktopBridge.session.createRun(
      activeBaseUrl, conv.sessionId, text, apiKey, runOpts
    )

    // Start streaming
    channelStreaming[convId] = { traceId, agentId, buffer: "" }
    renderChannelMessages(convId)

    await desktopBridge.session.streamRunUntilTerminal(
      activeBaseUrl, traceId, apiKey,
      (ev) => {
        const streaming = channelStreaming[convId]
        if (!streaming || streaming.traceId !== traceId) return
    if (ev.type === "text_delta" && ev.payload) {
        // SSE text_delta payload is { delta: "..." }
        const delta = typeof ev.payload === "string" ? ev.payload : ev.payload.delta || ""
        if (delta) {
          streaming.buffer += delta
          renderChannelMessages(convId)
        }
      }
      }
    )

    // Finalize: add agent message
    const streaming = channelStreaming[convId]
    if (streaming && streaming.buffer) {
      const agentMsg = {
        id: getChannelMsgId(),
        role: "assistant",
        senderId: conv.agentIds?.[0] || "agent",
        senderName: conv.name || "Agent",
        content: streaming.buffer,
        timestamp: Date.now(),
        avatarColor: conv.avatarColor || "#6b9e78",
        avatarUrl: conv.avatarUrl || null,
      }
      channelMessages[convId].push(agentMsg)
      conv.lastMessage = { content: streaming.buffer, timestamp: agentMsg.timestamp }
      conv.updatedAt = agentMsg.timestamp
    }
    delete channelStreaming[convId]
    persistChannelMessages()
    persistChannelConversations()
    renderChannelMessages(convId)
    renderChannelContactList()
  } catch (e) {
    delete channelStreaming[convId]
    showToast("error", `发送失败：${e instanceof Error ? e.message : String(e)}`)
    renderChannelMessages(convId)
  }
}

// ── Channel Group Send (Agent Self-Judge Routing) — STREAMING ──────────
//
// When a user sends a message in a group, we send it to EVERY agent in the group
// in parallel. Each agent streams its reply in real-time.
// - Each agent's "typing indicator" and streaming text appears immediately
// - Agents that reply [SKIP] have their indicator removed
// - Each agent that completes with real content gets added as a permanent message

/** Throttled render for group streaming — avoids excessive DOM updates */
function scheduleGroupStreamingRender(convId) {
  if (_groupRenderRaf) return // already scheduled
  _groupRenderRaf = requestAnimationFrame(() => {
    _groupRenderRaf = null
    renderChannelMessages(convId)
  })
}

async function sendChannelGroupMessage(convId, text) {
  const conv = channelConversations.find(c => c.id === convId)
  if (!conv || conv.type !== "group") return

  // Add user message
  if (!channelMessages[convId]) channelMessages[convId] = []
  const userMsg = {
    id: getChannelMsgId(),
    role: "user",
    senderId: "user",
    senderName: "我",
    content: text,
    timestamp: Date.now(),
    avatarColor: "#7986cb",
  }
  channelMessages[convId].push(userMsg)
  conv.lastMessage = { content: text, timestamp: userMsg.timestamp }
  conv.updatedAt = userMsg.timestamp
  persistChannelMessages()
  persistChannelConversations()
  renderChannelMessages(convId)
  renderChannelContactList()

  const agentIds = conv.agentIds || []
  if (agentIds.length === 0) {
    showToast("warn", "群聊中没有 Agent")
    return
  }

  // Parse @mentions — mentioned agents must reply, unmentioned may skip
  const mentionedAgentIds = parseAtMentions(text, convId)

  // Build recent history for systemSuffix injection
  const recentMsgs = (channelMessages[convId] || []).slice(-20)
  const historyLines = recentMsgs.map(m =>
    `${m.role === 'user' ? '用户' : m.senderName || 'Agent'}: ${m.content}`
  ).join("\n")

  // Build member list
  const memberNames = agentIds.map(aid => {
    const dm = channelConversations.find(c => c.type === 'dm' && c.agentIds?.[0] === aid)
    return dm?.name || aid
  })

  // Initialize group streaming state — show "typing" for all agents
  channelGroupStreaming[convId] = {}
  for (const agentId of agentIds) {
    channelGroupStreaming[convId][agentId] = {
      traceId: null,
      buffer: "",
      status: "streaming",
    }
  }
  renderChannelMessages(convId)

  // Helper: check if a response is a skip signal
  function isSkipResponse(content) {
    const trimmed = (content || "").trim()
    if (!trimmed) return true
    const skipPatterns = ["[SKIP]", "[skip]", "[不回复]", "[无需回复]"]
    return skipPatterns.some(p => trimmed === p || trimmed === `${p}.` || trimmed === `${p}。`) || trimmed.startsWith("[SKIP]")
  }

  // Send to each agent in parallel — each streams independently
  const agentPromises = agentIds.map(async (agentId) => {
    const agentConv = channelConversations.find(c => c.type === 'dm' && c.agentIds?.[0] === agentId)
    const agentName = agentConv?.name || agentId

    // Ensure agent has a session
    let sessionId = agentConv?.sessionId
    if (!sessionId) {
      try {
        const created = await desktopBridge.session.createSession(activeBaseUrl, apiKey)
        sessionId = created.id
        if (agentConv) {
          agentConv.sessionId = sessionId
          persistChannelConversations()
        }
      } catch (e) {
        console.error(`Failed to create session for agent ${agentId}:`, e)
        // Mark this agent as skipped (failed)
        if (channelGroupStreaming[convId]?.[agentId]) {
          channelGroupStreaming[convId][agentId].status = "skipped"
          scheduleGroupStreamingRender(convId)
        }
        return
      }
    }

    // Build group context injection for this agent
    const isMentioned = mentionedAgentIds.includes(agentId)
    const mentionRule = isMentioned
      ? `- 用户在消息中@了你，你必须回复，不能回复[SKIP]`
      : `- 如果这条消息不是在问你，或者你没有什么有用的信息可以补充，请只回复：[SKIP]
- 如果这条消息与你相关、或在问你、或你有必要补充信息，请正常回复`
    const groupContextSuffix = `
[群聊上下文]
你在群聊「${conv.name || "未命名群组"}」中，你的名字是「${agentName}」。
群成员：${["用户(我)", ...memberNames].join("、 ")}
${isMentioned ? `用户@了你（@${agentName}），你必须回复。` : ""}
最近聊天记录：
${historyLines}
用户最新消息：${text}

[回复规则]
${mentionRule}
- 不要打招呼、不要寒暄、直接回答内容
- 不要说"我来回答"之类的话，直接给出答案`.trim()

    try {
      const runOpts = { agentId }
      const enrichedText = `${groupContextSuffix}\n\n${text}`

      const { traceId } = await desktopBridge.session.createRun(
        activeBaseUrl, sessionId, enrichedText, apiKey, runOpts
      )

      // Store traceId in streaming state
      if (channelGroupStreaming[convId]?.[agentId]) {
        channelGroupStreaming[convId][agentId].traceId = traceId
      }

      // Stream this agent's response — update buffer in real-time
      await desktopBridge.session.streamRunUntilTerminal(
        activeBaseUrl, traceId, apiKey,
        (ev) => {
          if (ev.type === "text_delta" && ev.payload) {
            const delta = typeof ev.payload === "string" ? ev.payload : ev.payload.delta || ""
            if (delta && channelGroupStreaming[convId]?.[agentId]) {
              channelGroupStreaming[convId][agentId].buffer += delta
              scheduleGroupStreamingRender(convId)
            }
          }
        }
      )

      // Stream finished — check if this was a skip
      const agentState = channelGroupStreaming[convId]?.[agentId]
      if (!agentState) return

      if (isSkipResponse(agentState.buffer)) {
        // Mark as skipped — streaming indicator will be removed on next render
        agentState.status = "skipped"
      } else {
        // Real response — add as permanent message
        agentState.status = "done"
        const agentMsg = {
          id: getChannelMsgId(),
          role: "assistant",
          senderId: agentId,
          senderName: agentName,
          content: agentState.buffer,
          timestamp: Date.now(),
          avatarColor: agentConv?.avatarColor || getAgentColor(agentId),
          avatarUrl: agentConv?.avatarUrl || null,
        }
        channelMessages[convId].push(agentMsg)
      }

      // Remove this agent from streaming state
      delete channelGroupStreaming[convId]?.[agentId]

      // If all agents are done, clean up the group streaming object
      if (channelGroupStreaming[convId] && Object.keys(channelGroupStreaming[convId]).length === 0) {
        delete channelGroupStreaming[convId]
      }

      // Update conversation metadata
      const hasMessages = channelMessages[convId]?.some(m => m.role === "assistant")
      if (hasMessages) {
        conv.lastMessage = { content: "多条回复", timestamp: Date.now() }
        conv.updatedAt = Date.now()
      }

      persistChannelMessages()
      persistChannelConversations()
      renderChannelMessages(convId)
      renderChannelContactList()

    } catch (e) {
      console.error(`Agent ${agentId} run failed:`, e)
      // Mark as skipped on error
      if (channelGroupStreaming[convId]?.[agentId]) {
        channelGroupStreaming[convId][agentId].status = "skipped"
        delete channelGroupStreaming[convId][agentId]
      }
      if (channelGroupStreaming[convId] && Object.keys(channelGroupStreaming[convId]).length === 0) {
        delete channelGroupStreaming[convId]
      }
      scheduleGroupStreamingRender(convId)
    }
  })

  // Wait for all agents to finish
  await Promise.allSettled(agentPromises)

  // Final cleanup
  delete channelGroupStreaming[convId]
  persistChannelMessages()
  persistChannelConversations()
  renderChannelMessages(convId)
  renderChannelContactList()
}

// ── Channel Send Dispatch ───────────────────────────────────────────────

async function sendChannelMessage(convId, text) {
  const conv = channelConversations.find(c => c.id === convId)
  if (!conv) return

  if (conv.type === "dm") {
    await sendChannelDmMessage(convId, text)
  } else if (conv.type === "group") {
    await sendChannelGroupMessage(convId, text)
  }
}

// ── @ Mention Popup ─────────────────────────────────────────────────────
//
// When the user types @ in the group chat composer, show a popup to select
// an agent. Selected agents get @AgentName inserted and are marked as "must reply".

let _atPopupHidden = true
let _atPopupItems = [] // [{ agentId, agentName, avatarBg }]
let _atPopupActiveIdx = -1
let _atQueryStart = -1 // cursor position where @ was typed

const _atPopupEl = document.getElementById("channel-at-popup")
const _atPopupListEl = document.getElementById("channel-at-popup-list")

function openAtPopup(cursorPos, filter) {
  // Only works in group chats
  const conv = channelConversations.find(c => c.id === activeChannelConversationId)
  if (!conv || conv.type !== "group") { closeAtPopup(); return }

  _atQueryStart = cursorPos
  _atPopupItems = (conv.agentIds || []).map(aid => {
    const dm = channelConversations.find(c => c.type === 'dm' && c.agentIds?.[0] === aid)
    return {
      agentId: aid,
      agentName: dm?.name || aid,
      avatarBg: dm?.avatarColor || getAgentColor(aid),
    }
  }).filter(item => !filter || item.agentName.toLowerCase().includes(filter.toLowerCase()))

  if (_atPopupItems.length === 0) { closeAtPopup(); return }
  _atPopupActiveIdx = 0
  _atPopupHidden = false
  renderAtPopupList(filter)
  if (_atPopupEl) _atPopupEl.classList.remove("is-hidden")
}

function renderAtPopupList(filter) {
  if (!_atPopupListEl) return
  _atPopupListEl.innerHTML = _atPopupItems.map((item, idx) => {
    const isActive = idx === _atPopupActiveIdx
    const label = filter
      ? item.agentName.replace(new RegExp(`(${escapeRegex(filter)})`, "gi"), "<em>$1</em>")
      : escapeHtml(item.agentName)
    return `<div class="channel-at-popup-item ${isActive ? 'is-active' : ''}" data-at-idx="${idx}">
      <div class="at-mini-avatar" style="background:${item.avatarBg}">${escapeHtml(item.agentName.charAt(0))}</div>
      <span class="at-name">${label}</span>
    </div>`
  }).join("")

  _atPopupListEl.querySelectorAll(".channel-at-popup-item").forEach(el => {
    el.addEventListener("click", () => {
      const idx = Number(el.getAttribute("data-at-idx"))
      selectAtPopupItem(idx)
    })
    el.addEventListener("mouseenter", () => {
      _atPopupActiveIdx = Number(el.getAttribute("data-at-idx"))
      renderAtPopupActive()
    })
  })
}

function renderAtPopupActive() {
  if (!_atPopupListEl) return
  _atPopupListEl.querySelectorAll(".channel-at-popup-item").forEach((el, idx) => {
    el.classList.toggle("is-active", idx === _atPopupActiveIdx)
  })
  // Scroll active item into view
  const activeEl = _atPopupListEl.querySelector(".channel-at-popup-item.is-active")
  activeEl?.scrollIntoView({ block: "nearest" })
}

function selectAtPopupItem(idx) {
  const item = _atPopupItems[idx]
  if (!item) return
  const input = document.getElementById("channel-composer-input")
  if (!input) return

  // Replace from @ to cursor with @AgentName
  const before = input.value.slice(0, _atQueryStart)
  const after = input.value.slice(input.selectionEnd || input.value.length)
  const insert = `@${item.agentName} `
  input.value = before + insert + after
  input.focus()
  const newPos = before.length + insert.length
  input.setSelectionRange(newPos, newPos)
  input.style.height = "auto"
  input.style.height = Math.min(input.scrollHeight, 120) + "px"

  closeAtPopup()
}

function closeAtPopup() {
  _atPopupHidden = true
  _atPopupItems = []
  _atPopupActiveIdx = -1
  _atQueryStart = -1
  if (_atPopupEl) _atPopupEl.classList.add("is-hidden")
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Parse @mentions from message text, returns array of agentIds */
function parseAtMentions(text, convId) {
  const conv = channelConversations.find(c => c.id === convId)
  if (!conv || conv.type !== "group") return []
  const agentIds = conv.agentIds || []
  const mentioned = []
  for (const aid of agentIds) {
    const dm = channelConversations.find(c => c.type === 'dm' && c.agentIds?.[0] === aid)
    const name = dm?.name || aid
    if (text.includes(`@${name}`)) {
      mentioned.push(aid)
    }
  }
  return mentioned
}

/** Lightweight Markdown renderer for channel message bubbles.
 *  Supports: code blocks, inline code, bold, italic, links, lists, headings, line breaks.
 *  Output is safe HTML (XSS-protected). */
function renderMarkdown(text) {
  if (!text) return ""

  // Phase 1: Extract fenced code blocks to protect them from other processing
  const codeBlocks = []
  let processed = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length
    codeBlocks.push({ lang: lang || "", code: code.replace(/\n$/, "") })
    return `\x00CODEBLOCK${idx}\x00`
  })

  // Phase 2: Escape HTML for safety (but preserve our placeholders)
  processed = processed.split(/(\x00CODEBLOCK\d+\x00)/).map(segment => {
    if (/^\x00CODEBLOCK\d+\x00$/.test(segment)) return segment
    return escapeHtml(segment)
  }).join("")

  // Phase 3: Inline code
  const inlineCodes = []
  processed = processed.replace(/`([^`\n]+)`/g, (_, code) => {
    const idx = inlineCodes.length
    inlineCodes.push(code)
    return `\x00INLINECODE${idx}\x00`
  })

  // Phase 4: Bold, italic, links (on the escaped text)
  processed = processed
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')

  // Phase 5: Line-by-line processing for block elements
  const lines = processed.split("\n")
  const resultLines = []
  let inList = false

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]

    // Code block placeholder — pass through
    if (/^\x00CODEBLOCK\d+\x00$/.test(line)) {
      if (inList) { resultLines.push("</ul>"); inList = false }
      resultLines.push(line)
      continue
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      if (inList) { resultLines.push("</ul>"); inList = false }
      const level = headingMatch[1].length
      resultLines.push(`<h${level + 3} class="md-heading">${headingMatch[2]}</h${level + 3}>`)
      continue
    }

    // Unordered list
    const listMatch = line.match(/^[\-\*]\s+(.+)$/)
    if (listMatch) {
      if (!inList) { resultLines.push('<ul class="md-list">'); inList = true }
      resultLines.push(`<li>${listMatch[1]}</li>`)
      continue
    }

    // Ordered list
    const olMatch = line.match(/^\d+\.\s+(.+)$/)
    if (olMatch) {
      if (!inList) { resultLines.push('<ol class="md-list">'); inList = true }
      resultLines.push(`<li>${olMatch[1]}</li>`)
      continue
    }

    // Close list if we hit a non-list line
    if (inList) {
      resultLines.push(lines[i - 1]?.match(/^<ol/) ? "</ol>" : "</ul>")
      inList = false
    }

    // Empty line → paragraph break
    if (line.trim() === "") {
      resultLines.push('<div class="md-spacer"></div>')
      continue
    }

    // Regular line
    resultLines.push(`<p class="md-para">${line}</p>`)
  }

  if (inList) resultLines.push("</ul>")

  let result = resultLines.join("")

  // Phase 6: Restore code blocks
  result = result.replace(/\x00CODEBLOCK(\d+)\x00/g, (_, idx) => {
    const block = codeBlocks[Number(idx)]
    const langAttr = block.lang ? ` class="language-${escapeHtml(block.lang)}"` : ""
    return `<pre class="md-code-block"><code${langAttr}>${escapeHtml(block.code)}</code></pre>`
  })

  // Phase 7: Restore inline codes
  result = result.replace(/\x00INLINECODE(\d+)\x00/g, (_, idx) => {
    return `<code class="md-inline-code">${inlineCodes[Number(idx)]}</code>`
  })

  return result
}

/** Render message content with Markdown + @mentions highlighted */
function renderBubbleContent(text, convId) {
  if (!text) return ""

  // First, render Markdown
  let result = renderMarkdown(text)

  // Then, highlight @mentions for group chats
  const conv = channelConversations.find(c => c.id === convId)
  if (conv?.type === "group") {
    const agentIds = conv.agentIds || []
    for (const aid of agentIds) {
      const dm = channelConversations.find(c => c.type === 'dm' && c.agentIds?.[0] === aid)
      const name = dm?.name || aid
      // We need to find @name in the HTML output — search in text nodes only
      const escaped = escapeHtml(`@${name}`)
      // Use a regex that avoids matching inside HTML tags
      result = result.replace(
        new RegExp(`(?<![<\\w/])${escapeRegex(escaped)}`, "g"),
        `<span class="channel-at-highlight">${escaped}</span>`
      )
    }
  }

  return result
}

// Input listener for @ detection
document.getElementById("channel-composer-input")?.addEventListener("input", function () {
  // Auto-resize
  this.style.height = "auto"
  this.style.height = Math.min(this.scrollHeight, 120) + "px"

  const val = this.value
  const cursorPos = this.selectionEnd

  // Find the @ before cursor
  let atPos = -1
  for (let i = cursorPos - 1; i >= 0; i--) {
    if (val[i] === '@') {
      atPos = i
      break
    }
    if (val[i] === ' ' || val[i] === '\n') break
  }

  if (atPos >= 0) {
    const query = val.slice(atPos + 1, cursorPos)
    // Only open if query doesn't contain spaces (still typing the name)
    if (!query.includes(' ') && !query.includes('\n')) {
      openAtPopup(atPos, query)
      return
    }
  }

  closeAtPopup()
})

// Close @ popup on click outside
document.addEventListener("click", (e) => {
  if (!_atPopupHidden && !e.target.closest(".channel-at-popup") && !e.target.closest("#channel-composer-input")) {
    closeAtPopup()
  }
})

// Channel send button
document.getElementById("channel-send-btn")?.addEventListener("click", async () => {
  const input = document.getElementById("channel-composer-input")
  if (!input || !activeChannelConversationId) return
  const text = input.value.trim()
  if (!text) return
  input.value = ""
  input.style.height = "auto"
  closeAtPopup()
  await sendChannelMessage(activeChannelConversationId, text)
})

// Channel composer Enter to send
document.getElementById("channel-composer-input")?.addEventListener("keydown", (e) => {
  // If @ popup is visible, handle navigation
  if (!_atPopupHidden && _atPopupItems.length > 0) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      _atPopupActiveIdx = Math.min(_atPopupActiveIdx + 1, _atPopupItems.length - 1)
      renderAtPopupActive()
      return
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      _atPopupActiveIdx = Math.max(_atPopupActiveIdx - 1, 0)
      renderAtPopupActive()
      return
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault()
      selectAtPopupItem(_atPopupActiveIdx)
      return
    }
    if (e.key === "Escape") {
      e.preventDefault()
      closeAtPopup()
      return
    }
  }
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault()
    document.getElementById("channel-send-btn")?.click()
  }
})

// Auto-resize channel composer textarea
document.getElementById("channel-composer-input")?.addEventListener("input", function () {
  this.style.height = "auto"
  this.style.height = Math.min(this.scrollHeight, 120) + "px"
})

// ── Create Group Modal ──────────────────────────────────────────────────

const createGroupModal = document.getElementById("create-group-modal")
const createGroupCloseBtn = document.getElementById("create-group-close-btn")
const createGroupCancelBtn = document.getElementById("create-group-cancel-btn")
const createGroupConfirmBtn = document.getElementById("create-group-confirm-btn")
const createGroupNameInput = document.getElementById("create-group-name")
const createGroupAgentList = document.getElementById("create-group-agent-list")
const createGroupError = document.getElementById("create-group-error")

let createGroupSelectedAgentIds = new Set()

function openCreateGroupModal() {
  createGroupSelectedAgentIds = new Set()
  if (createGroupNameInput) createGroupNameInput.value = ""
  if (createGroupError) createGroupError.textContent = ""
  renderCreateGroupAgentPicker()
  createGroupModal?.classList.remove("is-hidden")
}

function closeCreateGroupModal() {
  createGroupModal?.classList.add("is-hidden")
  createGroupSelectedAgentIds = new Set()
}

function renderCreateGroupAgentPicker() {
  if (!createGroupAgentList) return

  // Get all DM agents (they represent the available agents)
  const dmAgents = channelConversations.filter(c => c.type === "dm")

  if (dmAgents.length === 0) {
    createGroupAgentList.innerHTML = '<p style="padding:12px;color:var(--text-tertiary);font-size:12px">暂无可用 Agent</p>'
    return
  }

  createGroupAgentList.innerHTML = dmAgents.map(agent => {
    const isSelected = createGroupSelectedAgentIds.has(agent.agentIds?.[0])
    const avatarBg = agent.avatarColor || getAgentColor(agent.agentIds?.[0] || "")
    const avatarLabel = agent.name?.charAt(0) || "?"
    const avatarImg = agent.avatarUrl
      ? `<img src="${escapeHtml(agent.avatarUrl)}" alt="" />`
      : ""
    const statusDot = agent.agentOnline !== false ? "is-online" : "is-offline"

    return `
      <div class="create-group-agent-item ${isSelected ? 'is-selected' : ''}" data-agent-id="${escapeHtml(agent.agentIds?.[0] || '')}">
        <span class="agent-check">✓</span>
        <div class="agent-mini-avatar" style="background:${avatarBg}">${avatarImg || escapeHtml(avatarLabel)}</div>
        <span class="agent-label">${escapeHtml(agent.name)}</span>
        <span class="agent-status-dot ${statusDot}"></span>
      </div>
    `
  }).join("")

  // Bind click handlers
  createGroupAgentList.querySelectorAll(".create-group-agent-item").forEach(item => {
    item.addEventListener("click", () => {
      const agentId = item.getAttribute("data-agent-id")
      if (!agentId) return
      if (createGroupSelectedAgentIds.has(agentId)) {
        createGroupSelectedAgentIds.delete(agentId)
        item.classList.remove("is-selected")
      } else {
        createGroupSelectedAgentIds.add(agentId)
        item.classList.add("is-selected")
      }
    })
  })
}

createGroupCloseBtn?.addEventListener("click", closeCreateGroupModal)
createGroupCancelBtn?.addEventListener("click", closeCreateGroupModal)
createGroupModal?.querySelector(".channel-modal-overlay")?.addEventListener("click", closeCreateGroupModal)

createGroupConfirmBtn?.addEventListener("click", () => {
  const name = createGroupNameInput?.value?.trim() || ""
  const agentIds = Array.from(createGroupSelectedAgentIds)

  if (agentIds.length < 1) {
    if (createGroupError) createGroupError.textContent = "请至少选择 1 个 Agent"
    return
  }

  // Generate group conversation
  const groupId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const groupName = name || agentIds.map(aid => {
    const dm = channelConversations.find(c => c.type === "dm" && c.agentIds?.[0] === aid)
    return dm?.name || aid
  }).slice(0, 3).join("、") + (agentIds.length > 3 ? "…" : "")

  const newGroup = {
    id: groupId,
    type: "group",
    name: groupName,
    avatarUrl: null,
    avatarColor: null,
    agentIds: agentIds,
    sessionId: null,
    lastMessage: null,
    unreadCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  channelConversations.unshift(newGroup)
  persistChannelConversations()
  renderChannelContactList()

  // Close modal and select the new group
  closeCreateGroupModal()
  selectChannelConversation(groupId)

  showToast("success", `群聊「${groupName}」已创建`)
})

// Bind "New Group" button
document.getElementById("channel-new-group-btn")?.addEventListener("click", openCreateGroupModal)

// ── Group Composite Avatar ──────────────────────────────────────────────
//
// Renders a 2x2 mini-grid of agent colors for group avatars

function renderGroupCompositeAvatar(conv) {
  const agentIds = conv.agentIds || []
  if (agentIds.length === 0) return escapeHtml(conv.name?.charAt(0) || "群")

  // Take up to 4 agents for the composite
  const displayAgents = agentIds.slice(0, 4)
  const cells = displayAgents.map(aid => {
    const dm = channelConversations.find(c => c.type === "dm" && c.agentIds?.[0] === aid)
    const bg = dm?.avatarColor || getAgentColor(aid)
    const label = dm?.name?.charAt(0) || "?"
    const img = dm?.avatarUrl
      ? `<img src="${escapeHtml(dm.avatarUrl)}" alt="" />`
      : escapeHtml(label)
    return `<div class="gca-cell" style="background:${bg}">${img}</div>`
  }).join("")

  return `<div class="group-composite-avatar">${cells}</div>`
}

// ── Group Info Panel (with settings) ────────────────────────────────────
//
// When a group is selected, the info panel shows:
//  - Group composite avatar + name
//  - "Settings" button to toggle inline settings
//  - Member list with remove buttons
//  - Settings: rename, add member, dissolve

let groupSettingsVisible = false

function renderGroupInfoPanel(conv) {
  const infoContent = document.getElementById("channel-info-content")
  if (!infoContent) return

  const memberList = (conv.agentIds || []).map(aid => {
    const agent = channelConversations.find(c => c.type === 'dm' && c.agentIds?.[0] === aid)
    const avatarBg = agent?.avatarColor || getAgentColor(aid)
    const avatarLabel = agent?.name?.charAt(0) || "?"
    const avatarImg = agent?.avatarUrl
      ? `<img src="${escapeHtml(agent.avatarUrl)}" alt="" />`
      : escapeHtml(avatarLabel)
    return `<div class="channel-member-row">
      <div class="channel-msg-avatar" style="background:${avatarBg};width:28px;height:28px;font-size:12px">${avatarImg}</div>
      <span style="font-size:12px">${escapeHtml(agent?.name || aid)}</span>
    </div>`
  }).join("")

  const settingsHtml = groupSettingsVisible ? renderGroupSettingsContent(conv) : ""

  infoContent.innerHTML = `
    <div style="text-align:center;margin-bottom:12px">
      <div class="channel-contact-avatar" style="background:var(--bg-muted,#eeede8);width:64px;height:64px;font-size:24px;margin:0 auto">
        ${renderGroupCompositeAvatar(conv)}
      </div>
      <h4 style="margin:8px 0 4px">${escapeHtml(conv.name)}</h4>
      <p style="color:var(--text-tertiary);font-size:12px">${conv.agentIds.length + 1} 个成员</p>
    </div>
    <div class="channel-info-actions" style="justify-content:center">
      <button id="channel-toggle-settings-btn" class="ghost-btn" type="button">${groupSettingsVisible ? '收起设置' : '群聊设置'}</button>
    </div>
    ${settingsHtml}
    <div style="margin-top:12px">
      <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:8px">群成员 (${conv.agentIds.length + 1})</p>
      <div class="channel-member-row">
        <div class="channel-msg-avatar" style="background:#7986cb;width:28px;height:28px;font-size:12px">我</div>
        <span style="font-size:12px">我（用户）</span>
      </div>
      ${memberList}
    </div>
  `

  // Bind settings toggle
  document.getElementById("channel-toggle-settings-btn")?.addEventListener("click", () => {
    groupSettingsVisible = !groupSettingsVisible
    renderGroupInfoPanel(conv)
  })

  // If settings visible, bind settings actions
  if (groupSettingsVisible) {
    bindGroupSettingsActions(conv)
  }
}

function renderGroupSettingsContent(conv) {
  return `
    <div class="group-settings-section">
      <div class="form-group">
        <label for="gs-group-name">群名称</label>
        <input id="gs-group-name" type="text" maxlength="30" value="${escapeHtml(conv.name)}" />
        <button id="gs-rename-btn" class="ghost-btn" type="button" style="margin-top:4px;font-size:11px">保存</button>
      </div>
      <div class="form-group" style="margin-top:12px">
        <label>添加成员</label>
        <div id="gs-add-agent-list" class="create-group-agent-list"></div>
      </div>
      <div class="form-group" style="margin-top:12px">
        <label>当前成员</label>
        <div id="gs-member-list" class="gs-member-list"></div>
      </div>
      <button id="gs-dissolve-btn" class="ghost-btn" type="button" style="margin-top:16px;color:var(--toast-error-text,#c62828);border-color:var(--toast-error-border,#ef9a9a);width:100%">解散群聊</button>
    </div>
  `
}

function bindGroupSettingsActions(conv) {
  // Rename
  document.getElementById("gs-rename-btn")?.addEventListener("click", () => {
    const input = document.getElementById("gs-group-name")
    const newName = input?.value?.trim()
    if (!newName) {
      showToast("error", "群名称不能为空")
      return
    }
    conv.name = newName
    persistChannelConversations()
    renderChannelContactList()
    // Update chat header
    const titleEl = document.getElementById("channel-chat-title")
    if (titleEl) titleEl.textContent = newName
    showToast("success", "群名称已更新")
  })

  // Add member picker — show agents NOT in the group
  const addAgentList = document.getElementById("gs-add-agent-list")
  if (addAgentList) {
    const existingIds = new Set(conv.agentIds)
    const availableDms = channelConversations.filter(c => c.type === "dm" && !existingIds.has(c.agentIds?.[0]))

    if (availableDms.length === 0) {
      addAgentList.innerHTML = '<p style="padding:8px;font-size:11px;color:var(--text-tertiary)">所有 Agent 已在群中</p>'
    } else {
      addAgentList.innerHTML = availableDms.map(dm => {
        const avatarBg = dm.avatarColor || getAgentColor(dm.agentIds?.[0] || "")
        const avatarLabel = dm.name?.charAt(0) || "?"
        const avatarImg = dm.avatarUrl
          ? `<img src="${escapeHtml(dm.avatarUrl)}" alt="" />`
          : ""
        return `
          <div class="create-group-agent-item" data-add-agent-id="${escapeHtml(dm.agentIds?.[0] || '')}">
            <div class="agent-mini-avatar" style="background:${avatarBg}">${avatarImg || escapeHtml(avatarLabel)}</div>
            <span class="agent-label">${escapeHtml(dm.name)}</span>
            <span style="font-size:11px;color:var(--bg-accent,#4a6741)">添加</span>
          </div>
        `
      }).join("")

      addAgentList.querySelectorAll(".create-group-agent-item").forEach(item => {
        item.addEventListener("click", () => {
          const agentId = item.getAttribute("data-add-agent-id")
          if (!agentId || conv.agentIds.includes(agentId)) return
          conv.agentIds.push(agentId)
          conv.updatedAt = Date.now()
          persistChannelConversations()
          renderGroupInfoPanel(conv)
          renderChannelContactList()
          const dm = channelConversations.find(c => c.type === "dm" && c.agentIds?.[0] === agentId)
          showToast("success", `已添加 ${dm?.name || agentId}`)
        })
      })
    }
  }

  // Member list with remove buttons
  const memberList = document.getElementById("gs-member-list")
  if (memberList) {
    // User (self) — can't be removed
    let html = `
      <div class="gs-member-item">
        <div class="gs-member-avatar" style="background:#7986cb">我</div>
        <span class="gs-member-name">我（用户）</span>
        <span class="gs-member-you">群主</span>
      </div>
    `
    html += (conv.agentIds || []).map(aid => {
      const dm = channelConversations.find(c => c.type === "dm" && c.agentIds?.[0] === aid)
      const avatarBg = dm?.avatarColor || getAgentColor(aid)
      const avatarLabel = dm?.name?.charAt(0) || "?"
      const avatarImg = dm?.avatarUrl
        ? `<img src="${escapeHtml(dm.avatarUrl)}" alt="" />`
        : ""
      return `
        <div class="gs-member-item" data-remove-agent-id="${escapeHtml(aid)}">
          <div class="gs-member-avatar" style="background:${avatarBg}">${avatarImg || escapeHtml(avatarLabel)}</div>
          <span class="gs-member-name">${escapeHtml(dm?.name || aid)}</span>
          <button class="gs-remove-btn" type="button" title="移除">✕</button>
        </div>
      `
    }).join("")

    memberList.innerHTML = html

    memberList.querySelectorAll(".gs-remove-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation()
        const item = btn.closest(".gs-member-item")
        const aid = item?.getAttribute("data-remove-agent-id")
        if (!aid) return
        conv.agentIds = conv.agentIds.filter(id => id !== aid)
        conv.updatedAt = Date.now()
        persistChannelConversations()
        renderGroupInfoPanel(conv)
        renderChannelContactList()
        const dm = channelConversations.find(c => c.type === "dm" && c.agentIds?.[0] === aid)
        showToast("info", `已移除 ${dm?.name || aid}`)
      })
    })
  }

  // Dissolve group
  document.getElementById("gs-dissolve-btn")?.addEventListener("click", () => {
    if (!window.confirm(`确定要解散群聊「${conv.name}」吗？此操作不可撤销。`)) return

    // Remove from conversations
    const idx = channelConversations.findIndex(c => c.id === conv.id)
    if (idx !== -1) channelConversations.splice(idx, 1)

    // Remove messages
    delete channelMessages[conv.id]
    persistChannelConversations()
    persistChannelMessages()

    // Clear active conversation
    activeChannelConversationId = null
    groupSettingsVisible = false

    // Reset UI
    const titleEl = document.getElementById("channel-chat-title")
    if (titleEl) titleEl.textContent = "选择一个联系人开始聊天"
    const composer = document.getElementById("channel-composer")
    if (composer) composer.classList.add("is-hidden")
    const infoPanel = document.getElementById("channel-info-panel")
    if (infoPanel) infoPanel.classList.add("is-hidden")
    const msgList = document.getElementById("channel-message-list")
    if (msgList) msgList.innerHTML = '<div class="channel-empty-state"><h3>欢迎使用频道</h3><p>从左侧选择一个联系人开始聊天</p></div>'

    renderChannelContactList()
    showToast("info", `群聊「${conv.name}」已解散`)
  })
}

// ── Patch selectChannelConversation to use enhanced group info panel ────

// The original selectChannelConversation renders group info inline.
// We need to replace its group info rendering with our new renderGroupInfoPanel.
// Since selectChannelConversation is a function declaration, we'll patch it
// by re-declaring the key part. The simplest approach: override the info
// panel rendering inside selectChannelConversation.

// We hook into the existing selectChannelConversation by observing when
// a group conversation is selected and re-rendering the info panel.

// Patch: after the original selectChannelConversation renders, if it's a group,
// re-render the info panel with our enhanced version.
const _origSelectChannelConversation = selectChannelConversation

function selectChannelConversationPatched(convId) {
  _origSelectChannelConversation(convId)

  const conv = channelConversations.find(c => c.id === convId)
  if (conv?.type === "group") {
    groupSettingsVisible = false
    renderGroupInfoPanel(conv)
  }
}

// Override selectChannelConversation
selectChannelConversation = selectChannelConversationPatched

// ── Expose channel globals for discussion-engine.js ────────────────────
Object.assign(window, { channelConversations, channelMessages, channelStreaming, channelGroupStreaming, _groupRenderRaf, desktopBridge, activeBaseUrl, apiKey, getAgentColor, getChannelMsgId, parseAtMentions, renderChannelMessages, persistChannelMessages, persistChannelConversations, scheduleGroupStreamingRender, renderChannelContactList, showToast, escapeHtml, formatChatTime, formatDividerTime, shouldShowTimeDivider, renderBubbleContent, renderMarkdown, isSkipResponse, sendChannelGroupMessage })

// ── Expose channel globals for discussion-engine.js ────────────────────
Object.assign(window, { channelConversations, channelMessages, channelStreaming, channelGroupStreaming, _groupRenderRaf, getAgentColor, getChannelMsgId, parseAtMentions, renderChannelMessages, persistChannelMessages, persistChannelConversations, scheduleGroupStreamingRender, renderChannelContactList, escapeHtml: window.escapeHtml, showToast: window.showToast, formatChatTime, formatDividerTime, shouldShowTimeDivider, renderBubbleContent, renderMarkdown, isSkipResponse, sendChannelGroupMessage })
