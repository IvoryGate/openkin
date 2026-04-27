const sessionGroupsEl = document.getElementById("session-groups")
const sessionFetchStatusEl = document.getElementById("session-fetch-status")
const messageListEl = document.getElementById("message-list")
const heroTitleEl = document.getElementById("hero-title")
const heroSubtitleEl = document.getElementById("hero-subtitle")
const composerInputEl = document.getElementById("composer-input")
const sendBtnEl = document.getElementById("send-btn")
const statusTextEl = document.getElementById("status-text")
const backendTextEl = document.getElementById("backend-text")
const newSessionBtnEl = document.getElementById("new-session-btn")
const modelSelectTriggerEl = document.getElementById("model-select-trigger")
const modelSelectLabelEl = document.getElementById("model-select-label")
const modelSelectMenuEl = document.getElementById("model-select-menu")
const toggleNetworkEl = document.getElementById("toggle-network")
const uploadAttachmentEl = document.getElementById("upload-attachment")
const uploadImageEl = document.getElementById("upload-image")
const toggleFullControlEl = document.getElementById("toggle-full-control")
const toggleContextPanelEl = document.getElementById("toggle-context-panel")
const contextModelValueEl = document.getElementById("context-model-value")
const contextNetworkValueEl = document.getElementById("context-network-value")
const contextAttachmentValueEl = document.getElementById("context-attachment-value")
const contextImageValueEl = document.getElementById("context-image-value")
const contextControlValueEl = document.getElementById("context-control-value")
const contextPanelEl = document.getElementById("context-panel")
const contextRingEl = document.getElementById("context-ring")
const desktopShellEl = document.querySelector(".desktop-shell")
const allSessionsViewEl = document.getElementById("all-sessions-view")
const allSessionsListEl = document.getElementById("all-sessions-list")
const backFromAllSessionsBtn = document.getElementById("back-from-all-sessions")
const paneLeftEl = document.getElementById("pane-left")
const paneRightEl = document.getElementById("pane-right")
const resizerLeftEl = document.getElementById("resizer-left")
const resizerRightEl = document.getElementById("resizer-right")
const desktopBridge = window.theworldDesktop || window.openkinDesktop
const defaultBaseUrl = "http://127.0.0.1:3333"
const localBaseUrl = localStorage.getItem("theworld_console_base_url")
const baseUrlCandidates = Array.from(new Set([localBaseUrl, defaultBaseUrl].filter(Boolean)))
let activeBaseUrl = baseUrlCandidates[0] || defaultBaseUrl
const apiKey = localStorage.getItem("theworld_console_api_key") || ""
const agentDirectory = new Map()

const sessions = [
  { id: "s1", group: "今天", title: "UI 重构讨论", subtitle: "壳层结构评审", time: "10:20" },
  { id: "s2", group: "今天", title: "界面布局评审", subtitle: "三栏设计同步", time: "08:15" },
  { id: "s3", group: "昨天", title: "项目进度同步", subtitle: "WO 拆解确认", time: "昨天" },
  { id: "s4", group: "本周", title: "架构设计阶段", subtitle: "contract 收口", time: "周三" },
]

const messagesBySession = {
  s1: [
    { role: "assistant", content: "已完成壳层布局骨架，准备接入会话数据源。" },
    { role: "assistant", content: "下一步建议先做会话列表，再接输入态。" },
  ],
  s2: [{ role: "assistant", content: "三栏比例已冻结为 260 / 860 / 320。" }],
  s3: [{ role: "assistant", content: "WO-1 已通过，准备进入 WO-2。" }],
  s4: [{ role: "assistant", content: "先冻结边界，再推进实现。" }],
}

let activeSessionId = "s1"
let isBusy = false
let runPollingTimer = null
const pendingRunBySession = new Map()
const composerSettings = {
  model: "deepseek-v3",
  networkEnabled: true,
  hasAttachment: false,
  hasImage: false,
  fullControlEnabled: false,
}
const MAX_LEFT_ITEMS = 8
const DEFAULT_PANE_WIDTH = 300
const MIN_PANE_WIDTH = 220
const MAX_PANE_WIDTH = 520
const MODEL_LABELS = {
  "deepseek-v3": "DeepSeek-V3",
  "theworld-fast": "theworld-Fast",
  "theworld-pro": "theworld-Pro",
}

function getAgentName(session) {
  if (session?.agentId && agentDirectory.has(session.agentId)) {
    return agentDirectory.get(session.agentId).name
  }
  if (session?.agentName?.trim()) {
    return session.agentName.trim()
  }
  if (session?.agentId?.trim()) {
    return session.agentId.trim()
  }
  return "theworld"
}

function getAgentAvatarUrl(session) {
  if (session?.agentId && agentDirectory.has(session.agentId)) {
    return agentDirectory.get(session.agentId).avatarUrl || ""
  }
  return session?.agentAvatarUrl || ""
}

function getAvatarLabel(agentName) {
  const text = (agentName || "theworld").trim()
  if (!text) {
    return "T"
  }
  return text.slice(0, 1).toUpperCase()
}

function hashText(text) {
  let h = 0
  for (let i = 0; i < text.length; i += 1) {
    h = (h << 5) - h + text.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function getAvatarTheme(agentName) {
  const palette = [
    { bg: "#f1e7de", fg: "#8b5947", border: "#ddc9bc" },
    { bg: "#e6edf6", fg: "#40608d", border: "#c7d6eb" },
    { bg: "#e8f0e7", fg: "#4c7650", border: "#cfe0cd" },
    { bg: "#efe9f4", fg: "#6b4f85", border: "#dccfe8" },
    { bg: "#f4ece1", fg: "#7d6341", border: "#e5d6c2" },
  ]
  return palette[hashText(agentName) % palette.length]
}

function toSummaryText(content, maxLen = 38) {
  const normalized = (content || "").replace(/\s+/g, " ").trim()
  if (!normalized) {
    return "暂无摘要"
  }
  return normalized.length > maxLen ? `${normalized.slice(0, maxLen)}...` : normalized
}

function getActiveSession() {
  return sessions.find((item) => item.id === activeSessionId) || null
}

function renderHeroHeader(hasMessages) {
  const active = getActiveSession()
  const agentName = getAgentName(active)
  heroTitleEl.textContent = agentName

  if (isBusy) {
    heroSubtitleEl.textContent = "对方正在输入中..."
    return
  }
  if (hasMessages) {
    heroSubtitleEl.textContent = "在线"
    return
  }
  heroSubtitleEl.textContent = "你可以继续输入内容，我会延续当前上下文。"
}

function renderMathInContainer(element) {
  if (!element || typeof window.renderMathInElement !== "function") {
    return
  }
  try {
    window.renderMathInElement(element, {
      throwOnError: false,
      strict: "ignore",
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false },
      ],
    })
  } catch (_error) {
    // Keep original markdown text when formula rendering fails.
  }
}

async function copyTextWithFeedback(buttonEl, text) {
  if (!buttonEl || !text) {
    return
  }
  const original = buttonEl.textContent || "复制"
  try {
    await navigator.clipboard.writeText(text)
    buttonEl.textContent = "已复制"
  } catch (_error) {
    buttonEl.textContent = "复制失败"
  }
  window.setTimeout(() => {
    buttonEl.textContent = original
  }, 1200)
}

function enhanceCopyInteractions(container) {
  if (!container) {
    return
  }

  function renderCodeWithLineNumbers(codeEl, rawCode) {
    if (!codeEl) {
      return
    }
    const lines = rawCode.split("\n")
    codeEl.innerHTML = lines
      .map((line, index) => {
        const safeLine = line.length > 0 ? escapeHtml(line) : "&nbsp;"
        return `<span class="code-line"><span class="line-no" aria-hidden="true">${index + 1}</span><span class="line-content">${safeLine}</span></span>`
      })
      .join("")
  }

  container.querySelectorAll(".md-pre").forEach((pre) => {
    if (pre.querySelector(".md-copy-btn")) {
      return
    }
    const codeEl = pre.querySelector("code")
    const codeText = codeEl?.textContent || ""
    pre.setAttribute("data-raw-code", codeText)
    renderCodeWithLineNumbers(codeEl, codeText)
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "md-copy-btn"
    btn.textContent = "复制"
    btn.addEventListener("click", () => {
      void copyTextWithFeedback(btn, pre.getAttribute("data-raw-code") || "")
    })
    pre.appendChild(btn)
  })

  container.querySelectorAll(".katex-display").forEach((display) => {
    if (display.querySelector(".math-copy-btn")) {
      return
    }
    const tex = display.querySelector("annotation")?.textContent?.trim() || ""
    if (!tex) {
      return
    }
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "math-copy-btn"
    btn.textContent = "复制公式"
    btn.addEventListener("click", () => {
      void copyTextWithFeedback(btn, tex)
    })
    display.appendChild(btn)
  })
}

function escapeHtml(raw) {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function applyInlineMarkdown(text) {
  let result = text
  result = result.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>')
  result = result.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  result = result.replace(/\*([^*]+)\*/g, "<em>$1</em>")
  result = result.replace(/`([^`]+)`/g, "<code>$1</code>")
  return result
}

function renderMarkdown(rawContent) {
  const escaped = escapeHtml(rawContent || "")
  const lines = escaped.replace(/\r\n/g, "\n").split("\n")
  const htmlParts = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) {
      i += 1
      continue
    }

    const fenceStart = line.match(/^\s*```([\w-]*)\s*$/)
    if (fenceStart) {
      const language = fenceStart[1] || "text"
      i += 1
      const codeLines = []
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        codeLines.push(lines[i])
        i += 1
      }
      if (i < lines.length && /^\s*```\s*$/.test(lines[i])) {
        i += 1
      }
      htmlParts.push(
        `<pre class="md-pre"><code class="md-code lang-${language}">${codeLines.join("\n")}</code></pre>`,
      )
      continue
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = applyInlineMarkdown(headingMatch[2])
      htmlParts.push(`<h${level} class="md-h${level}">${text}</h${level}>`)
      i += 1
      continue
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""))
        i += 1
      }
      htmlParts.push(`<ul class="md-ul">${items.map((item) => `<li>${applyInlineMarkdown(item)}</li>`).join("")}</ul>`)
      continue
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""))
        i += 1
      }
      htmlParts.push(`<ol class="md-ol">${items.map((item) => `<li>${applyInlineMarkdown(item)}</li>`).join("")}</ol>`)
      continue
    }

    const paragraphLines = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*```/.test(lines[i]) &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paragraphLines.push(lines[i])
      i += 1
    }
    htmlParts.push(`<p class="md-p">${applyInlineMarkdown(paragraphLines.join("<br />"))}</p>`)
  }

  return htmlParts.join("")
}

function computeContextUsageRatio() {
  const inputLength = composerInputEl?.value.trim().length || 0
  const inputFactor = Math.min(0.45, inputLength / 400)
  const featureFactor =
    (composerSettings.networkEnabled ? 0.16 : 0) +
    (composerSettings.hasAttachment ? 0.12 : 0) +
    (composerSettings.hasImage ? 0.13 : 0) +
    (composerSettings.fullControlEnabled ? 0.1 : 0)
  const baseline = 0.14
  return Math.max(0.08, Math.min(0.96, baseline + inputFactor + featureFactor))
}

function renderContextUsage() {
  const usageRatio = computeContextUsageRatio()
  if (contextRingEl) {
    contextRingEl.style.setProperty("--usage", usageRatio.toFixed(3))
  }
  if (toggleContextPanelEl) {
    const percent = Math.round(usageRatio * 100)
    toggleContextPanelEl.setAttribute("aria-label", `上下文使用情况 ${percent}%`)
    toggleContextPanelEl.setAttribute("title", `上下文使用情况 ${percent}%`)
  }
}

function syncComposerSettingsView() {
  if (modelSelectLabelEl) {
    modelSelectLabelEl.textContent = MODEL_LABELS[composerSettings.model] || "Unknown"
  }
  if (toggleNetworkEl) {
    toggleNetworkEl.classList.toggle("is-active", composerSettings.networkEnabled)
  }
  if (toggleFullControlEl) {
    toggleFullControlEl.classList.toggle("is-active", composerSettings.fullControlEnabled)
  }
  if (uploadAttachmentEl) {
    uploadAttachmentEl.classList.toggle("is-active", composerSettings.hasAttachment)
  }
  if (uploadImageEl) {
    uploadImageEl.classList.toggle("is-active", composerSettings.hasImage)
  }
  if (contextModelValueEl) {
    contextModelValueEl.textContent = MODEL_LABELS[composerSettings.model] || "未知"
  }
  if (contextNetworkValueEl) {
    contextNetworkValueEl.textContent = composerSettings.networkEnabled ? "开启" : "关闭"
  }
  if (contextAttachmentValueEl) {
    contextAttachmentValueEl.textContent = composerSettings.hasAttachment ? "已添加" : "未添加"
  }
  if (contextImageValueEl) {
    contextImageValueEl.textContent = composerSettings.hasImage ? "已添加" : "未添加"
  }
  if (contextControlValueEl) {
    contextControlValueEl.textContent = composerSettings.fullControlEnabled ? "开启" : "关闭"
  }
  renderContextUsage()
}

function bindComposerToolbar() {
  function closeModelMenu() {
    modelSelectMenuEl?.classList.add("is-hidden")
    modelSelectTriggerEl?.classList.remove("is-open")
    modelSelectTriggerEl?.setAttribute("aria-expanded", "false")
  }

  modelSelectTriggerEl?.addEventListener("click", (event) => {
    event.stopPropagation()
    const willOpen = modelSelectMenuEl?.classList.contains("is-hidden")
    if (willOpen) {
      modelSelectMenuEl?.classList.remove("is-hidden")
      modelSelectTriggerEl.classList.add("is-open")
      modelSelectTriggerEl.setAttribute("aria-expanded", "true")
    } else {
      closeModelMenu()
    }
  })

  modelSelectMenuEl?.querySelectorAll("[data-model-value]").forEach((node) => {
    node.addEventListener("click", (event) => {
      event.stopPropagation()
      const value = node.getAttribute("data-model-value")
      if (!value) {
        return
      }
      composerSettings.model = value
      modelSelectMenuEl
        ?.querySelectorAll(".model-option")
        .forEach((item) => item.classList.toggle("is-active", item === node))
      modelSelectMenuEl
        ?.querySelectorAll(".model-option")
        .forEach((item) => item.setAttribute("aria-selected", String(item === node)))
      syncComposerSettingsView()
      closeModelMenu()
    })
  })

  window.addEventListener("click", () => {
    closeModelMenu()
  })

  toggleNetworkEl?.addEventListener("click", () => {
    composerSettings.networkEnabled = !composerSettings.networkEnabled
    syncComposerSettingsView()
  })

  uploadAttachmentEl?.addEventListener("click", () => {
    composerSettings.hasAttachment = !composerSettings.hasAttachment
    syncComposerSettingsView()
  })

  uploadImageEl?.addEventListener("click", () => {
    composerSettings.hasImage = !composerSettings.hasImage
    syncComposerSettingsView()
  })

  toggleFullControlEl?.addEventListener("click", () => {
    composerSettings.fullControlEnabled = !composerSettings.fullControlEnabled
    syncComposerSettingsView()
  })

  toggleContextPanelEl?.addEventListener("click", () => {
    if (!contextPanelEl) {
      return
    }
    contextPanelEl.scrollIntoView({ behavior: "smooth", block: "start" })
    contextPanelEl.classList.add("is-active")
    window.setTimeout(() => contextPanelEl.classList.remove("is-active"), 1300)
  })

  composerInputEl?.addEventListener("input", () => {
    renderContextUsage()
  })

  syncComposerSettingsView()
}

function applyPaneWidths(left, right) {
  if (!desktopShellEl) {
    return
  }
  const l = Math.max(MIN_PANE_WIDTH, Math.min(MAX_PANE_WIDTH, left))
  const r = Math.max(MIN_PANE_WIDTH, Math.min(MAX_PANE_WIDTH, right))
  desktopShellEl.style.setProperty("--left-pane-width", `${l}px`)
  desktopShellEl.style.setProperty("--right-pane-width", `${r}px`)
  localStorage.setItem("theworld_desktop_left_pane_width", String(l))
  localStorage.setItem("theworld_desktop_right_pane_width", String(r))
}

function initPaneWidths() {
  const left = Number(localStorage.getItem("theworld_desktop_left_pane_width")) || DEFAULT_PANE_WIDTH
  const right = Number(localStorage.getItem("theworld_desktop_right_pane_width")) || DEFAULT_PANE_WIDTH
  applyPaneWidths(left, right)
}

function getCurrentPaneWidth(key, fallback) {
  const value = Number(
    getComputedStyle(desktopShellEl).getPropertyValue(key).replace("px", "").trim(),
  )
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function bindPaneResizers() {
  if (!desktopShellEl || !resizerLeftEl || !resizerRightEl || !paneLeftEl || !paneRightEl) {
    return
  }

  let dragging = null

  function onMove(event) {
    if (!dragging) {
      return
    }
    const shellRect = desktopShellEl.getBoundingClientRect()
    if (dragging === "left") {
      const leftWidth = event.clientX - shellRect.left
      const rightWidth = getCurrentPaneWidth("--right-pane-width", DEFAULT_PANE_WIDTH)
      applyPaneWidths(leftWidth, rightWidth)
      return
    }
    const rightWidth = shellRect.right - event.clientX
    const leftWidth = getCurrentPaneWidth("--left-pane-width", DEFAULT_PANE_WIDTH)
    applyPaneWidths(leftWidth, rightWidth)
  }

  function stopDrag() {
    dragging = null
    window.removeEventListener("mousemove", onMove)
    window.removeEventListener("mouseup", stopDrag)
  }

  resizerLeftEl.addEventListener("mousedown", () => {
    dragging = "left"
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", stopDrag)
  })
  resizerLeftEl.addEventListener("dblclick", () => {
    const rightWidth = getCurrentPaneWidth("--right-pane-width", DEFAULT_PANE_WIDTH)
    applyPaneWidths(DEFAULT_PANE_WIDTH, rightWidth)
  })

  resizerRightEl.addEventListener("mousedown", () => {
    dragging = "right"
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", stopDrag)
  })
  resizerRightEl.addEventListener("dblclick", () => {
    const leftWidth = getCurrentPaneWidth("--left-pane-width", DEFAULT_PANE_WIDTH)
    applyPaneWidths(leftWidth, DEFAULT_PANE_WIDTH)
  })
}

function inferGroupByTimestamp(ts) {
  if (!ts) {
    return "更早"
  }
  const now = new Date()
  const target = new Date(ts)
  const diffMs = now.getTime() - target.getTime()
  const oneDay = 24 * 60 * 60 * 1000

  if (now.toDateString() === target.toDateString()) {
    return "今天"
  }
  if (diffMs < oneDay * 2) {
    return "昨天"
  }
  if (diffMs < oneDay * 7) {
    return "本周"
  }
  return "更早"
}

function formatTime(ts) {
  if (!ts) {
    return "未知时间"
  }
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${hh}:${mm}`
}

function groupSessions(items) {
  return items.reduce((acc, item) => {
    const key = item.group
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(item)
    return acc
  }, {})
}

function renderSessions() {
  const visible = sessions.slice(0, MAX_LEFT_ITEMS)
  const hasMore = sessions.length > MAX_LEFT_ITEMS
  const groups = groupSessions(visible)
  const html = Object.entries(groups)
    .map(([groupName, items]) => {
      const list = items
        .map((item) => {
          const activeClass = item.id === activeSessionId ? "is-active" : ""
          const agentName = getAgentName(item)
          const avatarUrl = getAgentAvatarUrl(item)
          const avatarLabel = getAvatarLabel(agentName)
          const avatarTheme = getAvatarTheme(agentName)
          return `
          <button class="session-item ${activeClass}" data-session-id="${item.id}" type="button">
            <div class="session-avatar" style="--avatar-bg:${avatarTheme.bg};--avatar-fg:${avatarTheme.fg};--avatar-border:${avatarTheme.border};">
              ${avatarUrl ? `<img class="session-avatar-img" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(agentName)}" loading="lazy" />` : avatarLabel}
            </div>
            <div class="session-main">
              <p class="session-title">${escapeHtml(agentName)}</p>
              <p class="session-subtitle">${escapeHtml(item.subtitle || "暂无摘要")}</p>
            </div>
            <p class="session-time">${item.time}</p>
          </button>
        `
        })
        .join("")
      return `
        <section>
          <h3 class="session-group-title">${groupName}</h3>
          ${list}
        </section>
      `
    })
    .join("")
  sessionGroupsEl.innerHTML = html

  sessionGroupsEl.querySelectorAll("[data-session-id]").forEach((node) => {
    node.addEventListener("click", () => {
      activeSessionId = node.getAttribute("data-session-id") || activeSessionId
      renderSessions()
      renderMessages()
      void refreshMessagesForActiveSession()
    })
  })

  if (hasMore) {
    const moreBtn = document.createElement("button")
    moreBtn.type = "button"
    moreBtn.className = "session-more-card"
    moreBtn.textContent = `还有 ${sessions.length - MAX_LEFT_ITEMS} 个会话，点击查看全部`
    moreBtn.addEventListener("click", () => {
      openAllSessionsView()
    })
    sessionGroupsEl.appendChild(moreBtn)
  }
}

function renderMessages() {
  const messages = messagesBySession[activeSessionId] || []
  if (messages.length === 0) {
    messageListEl.classList.remove("is-visible")
    renderHeroHeader(false)
    return
  }

  renderHeroHeader(true)

  messageListEl.classList.add("is-visible")
  messageListEl.innerHTML = messages
    .map((message) => {
      const normalizedRole =
        message.role === "user" || message.role === "assistant" || message.role === "tool" || message.role === "system"
          ? message.role
          : "assistant"
      const role = normalizedRole
      const avatarText = role === "user" ? "我" : role === "tool" ? "T" : role === "system" ? "S" : "K"
      const roleClass = role === "user" ? "user" : role === "tool" ? "tool" : role === "system" ? "system" : "assistant"
      const bubbleRoleClass = roleClass
      const typingClass = message.__loading ? "is-typing is-loading" : ""
      const rawContent = message.content || ""
      const renderedContent = message.__loading
        ? `<p class="md-p">正在响应<span class="loading-dots"><i></i><i></i><i></i></span></p>`
        : renderMarkdown(rawContent)
      return `
        <article class="message-row ${roleClass}">
          <div class="message-avatar ${roleClass}">${avatarText}</div>
          <div class="message-bubble ${bubbleRoleClass} ${typingClass}">
            ${renderedContent}
          </div>
        </article>
      `
    })
    .join("")
  messageListEl.querySelectorAll(".message-bubble").forEach((node) => {
    renderMathInContainer(node)
    enhanceCopyInteractions(node)
  })
  messageListEl.scrollTop = messageListEl.scrollHeight
}

async function refreshMessagesForActiveSession() {
  if (!desktopBridge?.session?.getSessionMessages || !activeSessionId) {
    return
  }

  try {
    const remoteMessages = await desktopBridge.session.getSessionMessages(
      activeBaseUrl,
      activeSessionId,
      apiKey,
    )
    messagesBySession[activeSessionId] = remoteMessages.map((item) => ({
      id: item.id,
      role: item.role,
      content: item.content || "",
      createdAt: item.createdAt || 0,
    }))
    const pending = pendingRunBySession.get(activeSessionId)
    if (pending) {
      const hasMatchedUser = messagesBySession[activeSessionId].some(
        (m) => m.role === "user" && (m.content || "").trim() === pending.inputText.trim(),
      )
      if (!hasMatchedUser) {
        messagesBySession[activeSessionId].push({
          id: pending.localUserId,
          role: "user",
          content: pending.inputText,
          createdAt: pending.startedAt,
        })
      }
      const hasAssistantReply = messagesBySession[activeSessionId].some(
        (m) => m.role === "assistant" && (m.createdAt || 0) >= pending.startedAt - 1000,
      )
      if (!hasAssistantReply) {
        messagesBySession[activeSessionId].push({
          id: pending.loadingId,
          role: "assistant",
          content: "",
          createdAt: pending.startedAt + 1,
          __loading: true,
        })
      } else {
        pendingRunBySession.delete(activeSessionId)
        stopRunPolling()
        setBusyState(false)
      }
    }
    renderMessages()
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    statusTextEl.textContent = `当前状态：message_error(${msg})，请检查服务端与地址配置`
  }
}

function setBusyState(nextBusy) {
  isBusy = nextBusy
  sendBtnEl.disabled = nextBusy
  composerInputEl.disabled = nextBusy
  statusTextEl.textContent = `当前状态：${nextBusy ? "busy" : "idle"}`
  renderHeroHeader((messagesBySession[activeSessionId] || []).length > 0)
}

function openAllSessionsView() {
  if (!desktopShellEl || !allSessionsViewEl) {
    return
  }
  desktopShellEl.classList.add("is-hidden")
  allSessionsViewEl.classList.remove("is-hidden")
  allSessionsViewEl.setAttribute("aria-hidden", "false")
  renderAllSessions()
}

function closeAllSessionsView() {
  if (!desktopShellEl || !allSessionsViewEl) {
    return
  }
  allSessionsViewEl.classList.add("is-hidden")
  allSessionsViewEl.setAttribute("aria-hidden", "true")
  desktopShellEl.classList.remove("is-hidden")
}

function renderAllSessions() {
  if (!allSessionsListEl) {
    return
  }
  allSessionsListEl.innerHTML = sessions
    .map((item) => {
      const activeClass = item.id === activeSessionId ? "is-active" : ""
      const agentName = getAgentName(item)
      const avatarUrl = getAgentAvatarUrl(item)
      const avatarLabel = getAvatarLabel(agentName)
      const avatarTheme = getAvatarTheme(agentName)
      return `
      <button class="session-item ${activeClass}" data-all-session-id="${item.id}" type="button">
        <div class="session-avatar" style="--avatar-bg:${avatarTheme.bg};--avatar-fg:${avatarTheme.fg};--avatar-border:${avatarTheme.border};">
          ${avatarUrl ? `<img class="session-avatar-img" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(agentName)}" loading="lazy" />` : avatarLabel}
        </div>
        <div class="session-main">
          <p class="session-title">${escapeHtml(agentName)}</p>
          <p class="session-subtitle">${escapeHtml(item.subtitle || "暂无摘要")}</p>
        </div>
        <p class="session-time">${item.time}</p>
      </button>
    `
    })
    .join("")

  allSessionsListEl.querySelectorAll("[data-all-session-id]").forEach((node) => {
    node.addEventListener("click", () => {
      activeSessionId = node.getAttribute("data-all-session-id") || activeSessionId
      closeAllSessionsView()
      renderSessions()
      renderMessages()
      void refreshMessagesForActiveSession()
    })
  })
}

async function loadAgentDirectory() {
  if (!desktopBridge?.agent?.listAgents) {
    return
  }
  try {
    const agents = await desktopBridge.agent.listAgents(activeBaseUrl, apiKey)
    agentDirectory.clear()
    agents.forEach((agent) => {
      const id = (agent.id || "").trim()
      if (!id) {
        return
      }
      const name = (agent.displayName || agent.name || id).trim()
      const avatarUrl = (
        agent.avatarUrl ||
        agent.avatar ||
        agent.iconUrl ||
        agent.imageUrl ||
        ""
      ).trim()
      agentDirectory.set(id, { name, avatarUrl })
    })
  } catch (_error) {
    // keep fallback rendering when agent directory unavailable
  }
}

async function refreshSessionStartSummaries() {
  if (!desktopBridge?.session?.getSessionMessages) {
    return
  }
  const targets = sessions.filter((item) => !item.summaryReady).slice(0, 24)
  if (targets.length === 0) {
    return
  }

  await Promise.all(
    targets.map(async (session) => {
      try {
        const remoteMessages = await desktopBridge.session.getSessionMessages(
          activeBaseUrl,
          session.id,
          apiKey,
        )
        const earliest = [...remoteMessages]
          .filter((msg) => msg.content && msg.content.trim())
          .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))[0]
        session.subtitle = toSummaryText(earliest?.content || "")
        session.summaryReady = true
      } catch (_error) {
        session.summaryReady = true
      }
    }),
  )
  renderSessions()
  if (!allSessionsViewEl.classList.contains("is-hidden")) {
    renderAllSessions()
  }
}

function addUserMessage(content) {
  if (!messagesBySession[activeSessionId]) {
    messagesBySession[activeSessionId] = []
  }
  messagesBySession[activeSessionId].push({ role: "user", content })
}

function addAssistantMessage(content) {
  messagesBySession[activeSessionId].push({ role: "assistant", content })
}

function startRunPolling() {
  stopRunPolling()
  runPollingTimer = window.setInterval(() => {
    void refreshMessagesForActiveSession()
  }, 900)
}

function stopRunPolling() {
  if (runPollingTimer) {
    window.clearInterval(runPollingTimer)
    runPollingTimer = null
  }
}

sendBtnEl.addEventListener("click", () => {
  const content = composerInputEl.value.trim()
  if (!content || isBusy) {
    return
  }

  const inputText = content
  const startedAt = Date.now()
  addUserMessage(inputText)
  const localUserId = `local-user-${startedAt}`
  const loadingId = `local-assistant-loading-${startedAt}`
  const list = messagesBySession[activeSessionId] || []
  if (list.length > 0) {
    const last = list[list.length - 1]
    if (last.role === "user" && last.content === inputText) {
      last.id = localUserId
      last.createdAt = startedAt
    }
  }
  messagesBySession[activeSessionId].push({
    id: loadingId,
    role: "assistant",
    content: "",
    createdAt: startedAt + 1,
    __loading: true,
  })
  pendingRunBySession.set(activeSessionId, { startedAt, inputText, localUserId, loadingId })
  composerInputEl.value = ""
  renderContextUsage()
  renderMessages()
  setBusyState(true)

  const canRun =
    desktopBridge?.session?.createRun &&
    desktopBridge?.session?.waitRunTerminal
  if (!canRun) {
    window.setTimeout(() => {
      const pending = pendingRunBySession.get(activeSessionId)
      if (pending) {
        const listNow = messagesBySession[activeSessionId] || []
        const idx = listNow.findIndex((m) => m.id === pending.loadingId)
        if (idx >= 0) {
          listNow[idx] = {
            ...listNow[idx],
            __loading: false,
            content: "运行接口不可用，已保留本地消息。",
          }
          messagesBySession[activeSessionId] = listNow
        }
        pendingRunBySession.delete(activeSessionId)
      }
      renderMessages()
      setBusyState(false)
    }, 200)
    return
  }

  startRunPolling()
  void desktopBridge.session
    .createRun(activeBaseUrl, activeSessionId, inputText, apiKey)
    .then(({ traceId }) => desktopBridge.session.waitRunTerminal(activeBaseUrl, traceId, apiKey))
    .then(() => refreshMessagesForActiveSession())
    .catch((error) => {
      const msg = error instanceof Error ? error.message : String(error)
      addAssistantMessage(`运行失败：${msg}`)
      renderMessages()
      statusTextEl.textContent = `当前状态：run_error(${msg})，请检查服务端与地址配置`
    })
    .finally(() => {
      stopRunPolling()
      const pending = pendingRunBySession.get(activeSessionId)
      if (pending) {
        const listNow = messagesBySession[activeSessionId] || []
        const idx = listNow.findIndex((m) => m.id === pending.loadingId)
        if (idx >= 0) {
          listNow[idx] = {
            ...listNow[idx],
            __loading: false,
            content: listNow[idx].content || "暂未收到回复，请稍后重试。",
          }
          messagesBySession[activeSessionId] = listNow
        }
        pendingRunBySession.delete(activeSessionId)
      }
      renderMessages()
      setBusyState(false)
    })
})

composerInputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault()
    sendBtnEl.click()
  }
})

newSessionBtnEl.addEventListener("click", () => {
  const id = `s${sessions.length + 1}`
  sessions.unshift({
    id,
    group: "今天",
    title: "新会话",
    subtitle: "等待对话开始...",
    agentName: "theworld",
    summaryReady: true,
    time: "刚刚",
  })
  messagesBySession[id] = []
  activeSessionId = id
  renderSessions()
  renderMessages()
})

backFromAllSessionsBtn?.addEventListener("click", () => {
  closeAllSessionsView()
})

async function loadSessionsFromSurface() {
  if (!desktopBridge?.session?.listSessions) {
    sessionFetchStatusEl.textContent = "会话接口不可用，使用本地占位数据。"
    return
  }

  let lastError = "unknown"
  for (const candidate of baseUrlCandidates) {
    try {
      const remoteSessions = await desktopBridge.session.listSessions(candidate, apiKey)
      activeBaseUrl = candidate
      localStorage.setItem("theworld_console_base_url", candidate)
      backendTextEl.textContent = `后端地址：${activeBaseUrl}`
      sessions.length = 0
      await loadAgentDirectory()

      for (const item of remoteSessions) {
        const ts = item.updatedAt ?? item.createdAt ?? null
        sessions.push({
          id: item.id,
          group: inferGroupByTimestamp(ts),
          title: item.displayName || item.id.slice(0, 10),
          subtitle: "摘要加载中...",
          agentId: item.agentId || null,
          agentName: item.agentId || "theworld",
          agentAvatarUrl: "",
          summaryReady: false,
          time: formatTime(ts),
        })
        if (!messagesBySession[item.id]) {
          messagesBySession[item.id] = []
        }
      }

      if (sessions.length > 0) {
        activeSessionId = sessions[0].id
        sessionFetchStatusEl.textContent = `已加载 ${sessions.length} 个会话`
      } else {
        activeSessionId = "s1"
        sessionFetchStatusEl.textContent = "当前无会话，显示空态。"
      }
      renderSessions()
      renderMessages()
      void refreshMessagesForActiveSession()
      void refreshSessionStartSummaries()
      return
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }

  backendTextEl.textContent = `后端地址：${activeBaseUrl}`
  sessionFetchStatusEl.textContent = `会话加载失败：${lastError}`
}

renderSessions()
renderMessages()
initPaneWidths()
bindPaneResizers()
bindComposerToolbar()
void loadSessionsFromSurface()
