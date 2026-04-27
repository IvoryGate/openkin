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
const desktopShellEl = document.querySelector(".desktop-shell")
const allSessionsViewEl = document.getElementById("all-sessions-view")
const allSessionsListEl = document.getElementById("all-sessions-list")
const backFromAllSessionsBtn = document.getElementById("back-from-all-sessions")
const paneLeftEl = document.getElementById("pane-left")
const paneRightEl = document.getElementById("pane-right")
const resizerLeftEl = document.getElementById("resizer-left")
const resizerRightEl = document.getElementById("resizer-right")
const defaultBaseUrl = "http://127.0.0.1:3333"
const localBaseUrl = localStorage.getItem("theworld_console_base_url")
const baseUrlCandidates = Array.from(new Set([localBaseUrl, defaultBaseUrl].filter(Boolean)))
let activeBaseUrl = baseUrlCandidates[0] || defaultBaseUrl
const apiKey = localStorage.getItem("theworld_console_api_key") || ""

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
const MAX_LEFT_ITEMS = 8
const DEFAULT_PANE_WIDTH = 300
const MIN_PANE_WIDTH = 220
const MAX_PANE_WIDTH = 520

function applyPaneWidths(left, right) {
  if (!desktopShellEl) {
    return
  }
  const l = Math.max(MIN_PANE_WIDTH, Math.min(MAX_PANE_WIDTH, left))
  const r = Math.max(MIN_PANE_WIDTH, Math.min(MAX_PANE_WIDTH, right))
  desktopShellEl.style.setProperty("--left-pane-width", `${l}px`)
  desktopShellEl.style.setProperty("--right-pane-width", `${r}px`)
  localStorage.setItem("openkin_desktop_left_pane_width", String(l))
  localStorage.setItem("openkin_desktop_right_pane_width", String(r))
}

function initPaneWidths() {
  const left = Number(localStorage.getItem("openkin_desktop_left_pane_width")) || DEFAULT_PANE_WIDTH
  const right = Number(localStorage.getItem("openkin_desktop_right_pane_width")) || DEFAULT_PANE_WIDTH
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

  resizerRightEl.addEventListener("mousedown", () => {
    dragging = "right"
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", stopDrag)
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
          return `
          <button class="session-item ${activeClass}" data-session-id="${item.id}" type="button">
            <div class="session-avatar">◌</div>
            <div class="session-main">
              <p class="session-title">OPENKIN</p>
              <p class="session-subtitle">${item.title}</p>
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
    heroTitleEl.textContent = "宁静之地"
    heroSubtitleEl.textContent = "我是 OpenKin，今天我们从哪一个任务开始？"
    return
  }

  heroTitleEl.textContent = sessions.find((item) => item.id === activeSessionId)?.title || "会话"
  heroSubtitleEl.textContent = "你可以继续输入内容，我会延续当前上下文。"

  messageListEl.classList.add("is-visible")
  messageListEl.innerHTML = messages
    .map((message) => `<article class="message-item ${message.role}">${message.content}</article>`)
    .join("")
  messageListEl.scrollTop = messageListEl.scrollHeight
}

async function refreshMessagesForActiveSession() {
  if (!window.openkinDesktop?.session?.getSessionMessages || !activeSessionId) {
    return
  }

  try {
    const remoteMessages = await window.openkinDesktop.session.getSessionMessages(
      activeBaseUrl,
      activeSessionId,
      apiKey,
    )
    messagesBySession[activeSessionId] = remoteMessages.map((item) => ({
      role: item.role === "system" || item.role === "tool" ? "assistant" : item.role,
      content: item.content || "",
    }))
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
      return `
      <button class="session-item ${activeClass}" data-all-session-id="${item.id}" type="button">
        <div class="session-avatar">◌</div>
        <div class="session-main">
          <p class="session-title">OPENKIN</p>
          <p class="session-subtitle">${item.title}</p>
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

function addUserMessage(content) {
  if (!messagesBySession[activeSessionId]) {
    messagesBySession[activeSessionId] = []
  }
  messagesBySession[activeSessionId].push({ role: "user", content })
}

function addAssistantMessage(content) {
  messagesBySession[activeSessionId].push({ role: "assistant", content })
}

sendBtnEl.addEventListener("click", () => {
  const content = composerInputEl.value.trim()
  if (!content || isBusy) {
    return
  }

  const inputText = content
  addUserMessage(inputText)
  composerInputEl.value = ""
  renderMessages()
  setBusyState(true)

  const canRun =
    window.openkinDesktop?.session?.createRun &&
    window.openkinDesktop?.session?.waitRunTerminal
  if (!canRun) {
    window.setTimeout(() => {
      addAssistantMessage("运行接口不可用，已保留本地消息。")
      renderMessages()
      setBusyState(false)
    }, 200)
    return
  }

  void window.openkinDesktop.session
    .createRun(activeBaseUrl, activeSessionId, inputText, apiKey)
    .then(({ traceId }) => window.openkinDesktop.session.waitRunTerminal(activeBaseUrl, traceId, apiKey))
    .then(() => refreshMessagesForActiveSession())
    .catch((error) => {
      const msg = error instanceof Error ? error.message : String(error)
      addAssistantMessage(`运行失败：${msg}`)
      renderMessages()
      statusTextEl.textContent = `当前状态：run_error(${msg})，请检查服务端与地址配置`
    })
    .finally(() => {
      setBusyState(false)
    })
})

composerInputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
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
    subtitle: "等待输入",
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
  if (!window.openkinDesktop?.session?.listSessions) {
    sessionFetchStatusEl.textContent = "会话接口不可用，使用本地占位数据。"
    return
  }

  let lastError = "unknown"
  for (const candidate of baseUrlCandidates) {
    try {
      const remoteSessions = await window.openkinDesktop.session.listSessions(candidate, apiKey)
      activeBaseUrl = candidate
      localStorage.setItem("theworld_console_base_url", candidate)
      backendTextEl.textContent = `后端地址：${activeBaseUrl}`
      sessions.length = 0

      for (const item of remoteSessions) {
        const ts = item.updatedAt ?? item.createdAt ?? null
        sessions.push({
          id: item.id,
          group: inferGroupByTimestamp(ts),
          title: item.displayName || item.id.slice(0, 10),
          subtitle: item.agentId ? `agent: ${item.agentId}` : "会话",
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
void loadSessionsFromSurface()
