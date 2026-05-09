import { mountRightPanel } from "./components/right-panel/RightPanel.js"
import { resolveDesktopBridge } from "./http-desktop-bridge.js"

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
const cronStatusChipEl = document.getElementById("cron-status-chip")
const cronStatusTextEl = document.getElementById("cron-status-text")
const heartbeatStatusChipEl = document.getElementById("heartbeat-status-chip")
const heartbeatStatusTextEl = document.getElementById("heartbeat-status-text")
const desktopShellEl = document.querySelector(".desktop-shell")
const allSessionsViewEl = document.getElementById("all-sessions-view")
const allSessionsListEl = document.getElementById("all-sessions-list")
const backFromAllSessionsBtn = document.getElementById("back-from-all-sessions")
const settingsViewEl = document.getElementById("settings-view")
const openSettingsBtnEl = document.getElementById("open-settings-btn")
const backFromSettingsBtnEl = document.getElementById("back-from-settings")
const settingsTabButtons = document.querySelectorAll("[data-settings-tab]")
const settingsAgentListEl = document.getElementById("settings-agent-list")
const settingsAgentEditorNameEl = document.getElementById("settings-agent-editor-name")
const settingsAgentEditorDescriptionEl = document.getElementById("settings-agent-editor-description")
const settingsAgentEditorModelEl = document.getElementById("settings-agent-editor-model")
const settingsAgentEditorPromptEl = document.getElementById("settings-agent-editor-prompt")
const settingsAgentSaveEl = document.getElementById("settings-agent-save")
const settingsAgentCreateEl = document.getElementById("settings-agent-create")
const settingsAgentDeleteEl = document.getElementById("settings-agent-delete")
const settingsAgentInitPresetsEl = document.getElementById("settings-agent-init-presets")
const settingsAgentEditorStatusEl = document.getElementById("settings-agent-editor-status")
const agentPickerModalEl = document.getElementById("agent-picker-modal")
const agentPickerListEl = document.getElementById("agent-picker-list")
const agentPickerConfirmEl = document.getElementById("agent-picker-confirm")
const agentPickerCancelEl = document.getElementById("agent-picker-cancel")
const agentPickerCancelTopEl = document.getElementById("agent-picker-cancel-top")
const paneLeftEl = document.getElementById("pane-left")
const paneRightEl = document.getElementById("pane-right")
const resizerLeftEl = document.getElementById("resizer-left")
const resizerRightEl = document.getElementById("resizer-right")
const desktopBridge = resolveDesktopBridge(window.theworldDesktop || window.openkinDesktop)
const defaultBaseUrl = "http://127.0.0.1:3333"
const localBaseUrl = localStorage.getItem("theworld_console_base_url")
const baseUrlCandidates = Array.from(new Set([localBaseUrl, defaultBaseUrl].filter(Boolean)))
let activeBaseUrl = baseUrlCandidates[0] || defaultBaseUrl
const apiKey = localStorage.getItem("theworld_console_api_key") || ""
const agentDirectory = new Map()
const agentEditorMap = new Map()
let agentEditorSelectedId = ""

/** Filled from GET /v1/sessions; avoid placeholder ids — runs must use real session UUIDs from the server. */
const sessions = []

const messagesBySession = {}

let activeSessionId = ""
let isBusy = false
let runPollingTimer = null
let systemStatusTimer = null
const pendingRunBySession = new Map()
let approvalPollTimer = null
let activeRunTraceId = null
let cancelRequestedBeforeTrace = false
let rightPanelController = null
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
const MODEL_TO_AGENT_ID = {
  "deepseek-v3": "",
  "theworld-fast": "",
  "theworld-pro": "",
}
let attachmentFile = null
let imageFile = null
let searchQuery = ""
let leftPaneCollapsed = false
let activeTopTab = "chat"
let connectionHealthy = false

// PRESET_SOUL_AGENTS, BUILTIN_LOCKED_AGENT_IDS, BUILTIN_PRESET_PROMPTS_REV, BUILTIN_PRESET_PROMPTS_STORAGE_KEY
// are now defined in agent-presets.js (plain script loaded before this module).
const BUILTIN_PRESET_PROMPTS_REV = window.BUILTIN_PRESET_PROMPTS_REV || 150
const BUILTIN_PRESET_PROMPTS_STORAGE_KEY = window.BUILTIN_PRESET_PROMPTS_STORAGE_KEY || "theworld_builtin_preset_prompts_rev"
const PRESET_SOUL_AGENTS = window.PRESET_SOUL_AGENTS || []
const BUILTIN_LOCKED_AGENT_IDS = window.BUILTIN_LOCKED_AGENT_IDS || new Set()
const PLACEHOLDER_IMAGE_DATA_URL = ""
const SETTINGS_STORAGE_KEY = "theworld_desktop_settings_v1"
const SESSION_AGENT_PREF_KEY = "theworld_desktop_session_agent_pref_v1"
const defaultSettings = {
  conversation: {
    defaultModel: "deepseek-v3",
    contextStrategy: "balanced",
    autoSave: "on",
    enterBehavior: "enter-send",
    replyStyle: "standard",
    filePermission: "ask",
    multiAgent: false,
  },
  general: {
    theme: "light",
    language: "zh-CN",
    notification: "important",
    dataPolicy: "local",
    updateChannel: "stable",
    syncStatus: "connected",
    statusPollInterval: "5000",
  },
  profile: {
    nameMode: "default",
    avatarMode: "auto",
    timezone: "local",
  },
  agents: {
    strategy: "single",
    threshold: "balanced",
  },
  experimental: {
    beta: false,
    newInteraction: false,
    previewCapability: false,
  },
}
const uiSettings = loadUiSettings()
composerSettings.model = uiSettings.conversation.defaultModel
const sessionAgentPreference = loadSessionAgentPreference()
let selectedAgentIdForCreate = ""

function loadUiSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return structuredClone(defaultSettings)
    const parsed = JSON.parse(raw)
    return {
      conversation: { ...defaultSettings.conversation, ...(parsed.conversation || {}) },
      general: { ...defaultSettings.general, ...(parsed.general || {}) },
      profile: { ...defaultSettings.profile, ...(parsed.profile || {}) },
      agents: { ...defaultSettings.agents, ...(parsed.agents || {}) },
      experimental: { ...defaultSettings.experimental, ...(parsed.experimental || {}) },
    }
  } catch {
    return structuredClone(defaultSettings)
  }
}

function persistUiSettings() {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(uiSettings))
}

function loadSessionAgentPreference() {
  try {
    const raw = localStorage.getItem(SESSION_AGENT_PREF_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === "object" && parsed ? parsed : {}
  } catch {
    return {}
  }
}

function persistSessionAgentPreference() {
  localStorage.setItem(SESSION_AGENT_PREF_KEY, JSON.stringify(sessionAgentPreference))
}

/** Per-session message id → run UI snapshot for traceability (survives list refresh & app restart). */
const RUN_ARTIFACTS_STORAGE_KEY = "theworld_desktop_message_run_artifacts_v1"

function readRunArtifactsRoot() {
  try {
    const raw = localStorage.getItem(RUN_ARTIFACTS_STORAGE_KEY)
    if (!raw) return {}
    const p = JSON.parse(raw)
    return typeof p === "object" && p && !Array.isArray(p) ? p : {}
  } catch {
    return {}
  }
}

function writeRunArtifactsRoot(root) {
  try {
    localStorage.setItem(RUN_ARTIFACTS_STORAGE_KEY, JSON.stringify(root))
  } catch {
    /* quota or private mode */
  }
}

function cloneForStorage(value) {
  if (value === undefined || value === null) return value
  try {
    return structuredClone(value)
  } catch {
    return JSON.parse(JSON.stringify(value))
  }
}

function hydrateAssistantRunFields(sessionId, message) {
  if (!sessionId || !message || message.role !== "assistant" || !message.id) {
    return message
  }
  const bucket = readRunArtifactsRoot()[sessionId]
  if (!bucket || typeof bucket !== "object") {
    return message
  }
  const art = bucket[message.id]
  if (!art || typeof art !== "object") {
    return message
  }
  return {
    ...message,
    ...(art.runProcess ? { __runProcess: cloneForStorage(art.runProcess) } : {}),
    ...(art.traceSteps ? { __traceSteps: cloneForStorage(art.traceSteps) } : {}),
    ...(art.traceId ? { __traceId: String(art.traceId) } : {}),
  }
}

function rehydrateSessionMessagesFromDisk(sessionId) {
  const list = messagesBySession[sessionId]
  if (!Array.isArray(list)) {
    return
  }
  messagesBySession[sessionId] = list.map((m) =>
    m.role === "assistant" ? hydrateAssistantRunFields(sessionId, m) : m,
  )
}

function saveMessageRunArtifact(sessionId, message) {
  if (!sessionId || !message || message.role !== "assistant" || !message.id) {
    return
  }
  const root = readRunArtifactsRoot()
  const bucket = { ...(root[sessionId] || {}) }
  const prev = bucket[message.id] || {}
  const next = {
    runProcess:
      message.__runProcess !== undefined ? cloneForStorage(message.__runProcess) : prev.runProcess,
    traceSteps:
      message.__traceSteps !== undefined ? cloneForStorage(message.__traceSteps) : prev.traceSteps,
    traceId: message.__traceId !== undefined && message.__traceId !== "" ? message.__traceId : prev.traceId,
    updatedAt: Date.now(),
  }
  if (!next.runProcess && !next.traceSteps && !next.traceId) {
    delete bucket[message.id]
  } else {
    bucket[message.id] = next
  }
  root[sessionId] = bucket
  writeRunArtifactsRoot(root)
}

function promoteRunArtifactMessageId(sessionId, fromId, toId) {
  if (!sessionId || !fromId || !toId || fromId === toId) {
    return
  }
  const root = readRunArtifactsRoot()
  const bucket = { ...(root[sessionId] || {}) }
  if (!bucket[fromId]) {
    return
  }
  const merged = {
    ...bucket[toId],
    ...bucket[fromId],
    updatedAt: Date.now(),
  }
  bucket[toId] = merged
  delete bucket[fromId]
  root[sessionId] = bucket
  writeRunArtifactsRoot(root)
}

function persistSessionAssistantRunArtifacts(sessionId) {
  const list = messagesBySession[sessionId]
  if (!Array.isArray(list)) {
    return
  }
  for (const m of list) {
    if (m.role === "assistant" && m.id && (m.__runProcess || m.__traceSteps || m.__traceId)) {
      saveMessageRunArtifact(sessionId, m)
    }
  }
}

function getAgentName(session) {
  const preferredAgentId = session?.id ? sessionAgentPreference[session.id] : ""
  const effectiveAgentId = preferredAgentId || session?.agentId
  if (effectiveAgentId && agentDirectory.has(effectiveAgentId)) {
    return agentDirectory.get(effectiveAgentId).name
  }
  if (session?.agentName?.trim()) {
    return session.agentName.trim()
  }
  if (effectiveAgentId?.trim()) {
    return effectiveAgentId.trim()
  }
  return "theworld"
}

function getAgentAvatarUrl(session) {
  const preferredAgentId = session?.id ? sessionAgentPreference[session.id] : ""
  const effectiveAgentId = preferredAgentId || session?.agentId
  if (effectiveAgentId && agentDirectory.has(effectiveAgentId)) {
    return agentDirectory.get(effectiveAgentId).avatarUrl || ""
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

/**
 * Inline SVG icon helper (IconPark-style outlines).
 * Replaces emoji with theme-adaptable vector icons.
 */
function svgIcon(name) {
  const icons = {
    success: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M24 44c11 0 20-9 20-20S35 4 24 4 4 13 4 24s9 20 20 20Z"/><path d="m16 24 6 6 10-12"/></svg>',
    error: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M24 44c11 0 20-9 20-20S35 4 24 4 4 13 4 24s9 20 20 20Z"/><path d="m18 18 12 12M30 18 18 30"/></svg>',
    warn: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M24 44c11 0 20-9 20-20S35 4 24 4 4 13 4 24s9 20 20 20Z"/><path d="M24 16v10M24 32v2"/></svg>',
    info: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M24 44c11 0 20-9 20-20S35 4 24 4 4 13 4 24s9 20 20 20Z"/><path d="M24 22v12M24 14v2"/></svg>',
    robot: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><rect x="10" y="18" width="28" height="20" rx="4"/><path d="M24 10v8M18 10h12M16 26h4M28 26h4"/><circle cx="18" cy="26" r="1" fill="currentColor"/><circle cx="30" cy="26" r="1" fill="currentColor"/></svg>',
    user: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="16" r="8"/><path d="M8 42c0-9 7-16 16-16s16 7 16 16"/></svg>',
  }
  const svg = icons[name] || icons.info
  return `<span class="svg-icon">${svg}</span>`
}

function truncateText(s, max) {
  const t = s || ""
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

function safeJsonForProcess(obj, max = 2000) {
  try {
    return truncateText(JSON.stringify(obj, null, 0), max)
  } catch {
    return String(obj)
  }
}

function formatToolPathLine(name, input) {
  if (!input || typeof input !== "object") return ""
  const path =
    input.path || input.file_path || input.filePath || input.target || input.uri || input.url || input.glob_pattern || ""
  if (path) {
    return `${String(name)} · ${String(path)}`
  }
  return String(name || "tool")
}

function summarizeToolResultPayload(payload) {
  if (!payload || typeof payload !== "object") return truncateText(String(payload), 800)
  const name = payload.name || ""
  const out = payload.output
  if (out && typeof out === "object") {
    const code = out.code
    const msg = out.message
    if (code || msg) {
      return truncateText(`${code ? `${code}: ` : ""}${msg || safeJsonForProcess(out)}`, 1200)
    }
  }
  return truncateText(safeJsonForProcess(out ?? payload), 1200)
}

function clearApprovalPoll() {
  if (approvalPollTimer) {
    window.clearInterval(approvalPollTimer)
    approvalPollTimer = null
  }
}

function applyPendingApprovalsList(traceId, list) {
  const pending = list.filter((a) => a.traceId === traceId && a.status === "pending")
  for (const sid of pendingRunBySession.keys()) {
    const pr = pendingRunBySession.get(sid)
    if (!pr || pr.traceId !== traceId || !pr.loadingId) continue
    const msgs = messagesBySession[sid]
    if (!msgs) continue
    const row = msgs.find((m) => m.id === pr.loadingId)
    if (row?.__runProcess) {
      row.__runProcess.pendingApprovals = pending.map((a) => ({
        id: a.id,
        summary: a.summary,
        toolName: a.toolName,
      }))
      saveMessageRunArtifact(sid, row)
      if (sid === activeSessionId) {
        renderMessages()
      }
    }
  }
}

async function syncApprovalsForTrace(traceId) {
  if (!desktopBridge?.session?.listApprovals || !traceId) {
    return
  }
  try {
    const list = await desktopBridge.session.listApprovals(activeBaseUrl, apiKey)
    applyPendingApprovalsList(traceId, list)
  } catch {
    /* ignore */
  }
}

function startApprovalPollForTrace(traceId) {
  clearApprovalPoll()
  if (!desktopBridge?.session?.listApprovals || !traceId) {
    return
  }
  void syncApprovalsForTrace(traceId)
  approvalPollTimer = window.setInterval(() => {
    void syncApprovalsForTrace(traceId)
  }, 2000)
}

function handleRunStreamEvent(sessionId, event) {
  const pending = pendingRunBySession.get(sessionId)
  if (!pending?.loadingId) return
  const msgs = messagesBySession[sessionId]
  if (!msgs) return
  const row = msgs.find((m) => m.id === pending.loadingId)
  if (!row?.__runProcess) return
  const rp = row.__runProcess
  const { type, payload } = event
  if (type === "text_delta" && payload && typeof payload === "object" && "delta" in payload) {
    rp.streamText = (rp.streamText || "") + String(payload.delta || "")
  } else if (type === "message" && payload && typeof payload === "object") {
    const text = String(payload.text || "").trim()
    if (text) {
      rp.items.push({ kind: "thought", text })
    }
  } else if (type === "tool_call") {
    const list = Array.isArray(payload) ? payload : payload?.toolCalls
    if (Array.isArray(list)) {
      for (const tc of list) {
        if (!tc || typeof tc !== "object") continue
        rp.items.push({
          kind: "tool_call",
          id: tc.id,
          name: tc.name,
          input: tc.input || {},
        })
      }
    }
  } else if (type === "tool_result" && payload && typeof payload === "object") {
    rp.items.push({ kind: "tool_result", payload })
  }
  if (row) {
    saveMessageRunArtifact(sessionId, row)
  }
  if (sessionId === activeSessionId) {
    renderMessages()
  }
}

async function attachTraceToLastAssistant(sessionId, traceId) {
  if (!desktopBridge?.session?.getRunTrace || !traceId) {
    return
  }
  try {
    const dto = await desktopBridge.session.getRunTrace(activeBaseUrl, traceId, apiKey)
    const steps = dto && typeof dto === "object" && Array.isArray(dto.steps) ? dto.steps : null
    if (!steps?.length) {
      return
    }
    const msgs = messagesBySession[sessionId] || []
    for (let i = msgs.length - 1; i >= 0; i -= 1) {
      if (msgs[i].role === "assistant") {
        msgs[i].__traceSteps = steps
        msgs[i].__traceId = traceId
        saveMessageRunArtifact(sessionId, msgs[i])
        break
      }
    }
    if (sessionId === activeSessionId) {
      renderMessages()
    }
  } catch {
    /* ignore */
  }
}

function buildRunProcessPanelHtml(message, traceIdHint) {
  const rp = message.__runProcess
  const traceSteps = message.__traceSteps
  const blocks = []
  const canResolve =
    Boolean(traceIdHint) &&
    (desktopBridge?.session?.approveApproval || desktopBridge?.session?.denyApproval)

  if (rp?.pendingApprovals?.length) {
    const lines = rp.pendingApprovals
      .map((a) => {
        const idAttr = escapeHtml(a.id || "")
        const actions =
          canResolve && a.id
            ? `<div class="run-process-approval-actions"><button type="button" class="run-process-action-btn" data-approval-action="approve">允许</button><button type="button" class="run-process-action-btn run-process-action-btn--deny" data-approval-action="deny">拒绝</button></div>`
            : ""
        return `<div class="run-process-approval" data-approval-id="${idAttr}"><div class="run-process-approval-main"><span class="run-process-badge">权限</span>${escapeHtml(a.summary || "")}${a.toolName ? ` <span class="run-process-muted">(${escapeHtml(a.toolName)})</span>` : ""}</div>${actions}</div>`
      })
      .join("")
    blocks.push(`<div class="run-process-approvals">${lines}</div>`)
  }

  if (rp?.streamText) {
    blocks.push(
      `<div class="run-process-stream"><span class="run-process-label">输出流</span><pre class="run-process-pre">${escapeHtml(truncateText(rp.streamText, 12000))}</pre></div>`,
    )
  }

  if (rp?.items?.length) {
    for (const item of rp.items) {
      if (item.kind === "thought") {
        blocks.push(
          `<div class="run-process-item run-process-thought"><span class="run-process-label">推理</span><div class="run-process-body">${escapeHtml(truncateText(item.text, 8000))}</div></div>`,
        )
      } else if (item.kind === "tool_call") {
        const pathLine = formatToolPathLine(item.name, item.input)
        blocks.push(
          `<div class="run-process-item run-process-tool-call"><span class="run-process-label">调用</span><div class="run-process-body"><strong>${escapeHtml(item.name || "")}</strong>${pathLine ? `<div class="run-process-one-line">${escapeHtml(pathLine)}</div>` : ""}<pre class="run-process-pre run-process-pre--sm">${escapeHtml(safeJsonForProcess(item.input, 1500))}</pre></div></div>`,
        )
      } else if (item.kind === "tool_result") {
        const p = item.payload
        const err = Boolean(p?.isError)
        blocks.push(
          `<div class="run-process-item run-process-tool-result${err ? " is-error" : ""}"><span class="run-process-label">${err ? "结果(失败)" : "结果"}</span><div class="run-process-body"><span class="run-process-muted">${escapeHtml(String(p?.name || ""))}</span><pre class="run-process-pre run-process-pre--sm">${escapeHtml(summarizeToolResultPayload(p))}</pre></div></div>`,
        )
      }
    }
  }

  if (traceSteps?.length) {
    if (blocks.length > 0) {
      blocks.push(
        `<div class="run-process-section-label">服务端回合摘要（steps）</div>`,
      )
    }
    for (const step of traceSteps) {
      const si = step.stepIndex ?? 0
      if (step.thought) {
        blocks.push(
          `<div class="run-process-item run-process-thought"><span class="run-process-label">Step ${si} 推理</span><div class="run-process-body">${escapeHtml(truncateText(step.thought, 6000))}</div></div>`,
        )
      }
      if (step.toolCalls?.length) {
        for (const tc of step.toolCalls) {
          const pathLine = formatToolPathLine(tc.name, tc.input)
          blocks.push(
            `<div class="run-process-item run-process-tool-call"><span class="run-process-label">Step ${si} 调用</span><div class="run-process-body"><strong>${escapeHtml(tc.name || "")}</strong>${pathLine ? `<div class="run-process-one-line">${escapeHtml(pathLine)}</div>` : ""}<pre class="run-process-pre run-process-pre--sm">${escapeHtml(safeJsonForProcess(tc.input, 1500))}</pre></div></div>`,
          )
        }
      }
      if (step.toolResults?.length) {
        for (const tr of step.toolResults) {
          const err = Boolean(tr.isError)
          blocks.push(
            `<div class="run-process-item run-process-tool-result${err ? " is-error" : ""}"><span class="run-process-label">Step ${si} 结果</span><div class="run-process-body"><span class="run-process-muted">${escapeHtml(tr.name || "")}</span><pre class="run-process-pre run-process-pre--sm">${escapeHtml(truncateText(tr.outputSummary || "", 2000))}</pre></div></div>`,
          )
        }
      }
    }
  }

  if (blocks.length === 0) {
    const tid = traceIdHint || message.__traceId || ""
    const traceAttr = tid ? ` data-run-trace-id="${escapeHtml(tid)}"` : ""
    return `<details class="run-process-details run-process-details--placeholder"${traceAttr}><summary class="run-process-summary">运行过程</summary><div class="run-process-inner"><p class="run-process-empty-hint">暂无本机归档。通过本桌面发起并完成的运行，推理与工具过程会保存在此处，刷新或重启应用后仍可展开查看。</p></div></details>`
  }

  const hasLiveDetail =
    Boolean(rp?.items?.length) ||
    Boolean(rp?.streamText) ||
    Boolean(rp?.pendingApprovals?.length)
  const summary = rp
    ? hasLiveDetail
      ? "运行过程（流式 · 工具 / 推理）"
      : "运行过程（等待事件…）"
    : "运行过程（回合摘要）"
  const traceAttr =
    traceIdHint || message.__traceId
      ? ` data-run-trace-id="${escapeHtml(traceIdHint || message.__traceId || "")}"`
      : ""
  return `<details class="run-process-details"${traceAttr}><summary class="run-process-summary">${summary}</summary><div class="run-process-inner">${blocks.join("")}</div></details>`
}

/** Unified Markdown renderer — see the full implementation near end of file.
 *  The canonical `renderMarkdown(text)` is declared below (channel section);
 *  both the chat bubble renderer and the channel bubble renderer use it. */

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
    uploadAttachmentEl.disabled = uiSettings.conversation.filePermission === "deny"
  }
  if (uploadImageEl) {
    uploadImageEl.classList.toggle("is-active", composerSettings.hasImage)
    uploadImageEl.disabled = uiSettings.conversation.filePermission === "deny"
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

function applyThemeSetting() {
  document.documentElement.dataset.theme = uiSettings.general.theme
}

function syncSettingsView() {
  const bindValue = (id, value) => {
    const el = document.getElementById(id)
    if (el) el.value = value
  }
  const bindChecked = (id, value) => {
    const el = document.getElementById(id)
    if (el) el.checked = value
  }

  bindValue("settings-default-model", uiSettings.conversation.defaultModel)
  bindValue("settings-context-strategy", uiSettings.conversation.contextStrategy)
  bindValue("settings-auto-save", uiSettings.conversation.autoSave)
  bindValue("settings-enter-behavior", uiSettings.conversation.enterBehavior)
  bindValue("settings-reply-style", uiSettings.conversation.replyStyle)
  bindValue("settings-file-permission", uiSettings.conversation.filePermission)
  bindChecked("settings-multi-agent", uiSettings.conversation.multiAgent)

  bindValue("settings-theme", uiSettings.general.theme)
  bindValue("settings-language", uiSettings.general.language)
  bindValue("settings-notification", uiSettings.general.notification)
  bindValue("settings-data-policy", uiSettings.general.dataPolicy)
  bindValue("settings-update-channel", uiSettings.general.updateChannel)
  bindValue("settings-sync-status", uiSettings.general.syncStatus)
  bindValue("settings-status-poll-interval", uiSettings.general.statusPollInterval)
  bindValue("settings-profile-name", uiSettings.profile.nameMode)
  bindValue("settings-profile-avatar", uiSettings.profile.avatarMode)
  bindValue("settings-profile-timezone", uiSettings.profile.timezone)
  bindValue("settings-agent-strategy", uiSettings.agents.strategy)
  bindValue("settings-agent-threshold", uiSettings.agents.threshold)

  bindChecked("settings-beta", uiSettings.experimental.beta)
  bindChecked("settings-new-interaction", uiSettings.experimental.newInteraction)
  bindChecked("settings-preview-capability", uiSettings.experimental.previewCapability)

  composerSettings.model = uiSettings.conversation.defaultModel
  applyThemeSetting()
  syncComposerSettingsView()
}

function bindSettingsView() {
  const bindSelect = (id, onChange) => {
    document.getElementById(id)?.addEventListener("change", (event) => {
      onChange(event.target.value)
      persistUiSettings()
      syncSettingsView()
    })
  }
  const bindCheckbox = (id, onChange) => {
    document.getElementById(id)?.addEventListener("change", (event) => {
      onChange(Boolean(event.target.checked))
      persistUiSettings()
      syncSettingsView()
    })
  }

  bindSelect("settings-default-model", (value) => {
    uiSettings.conversation.defaultModel = value
  })
  bindSelect("settings-context-strategy", (value) => {
    uiSettings.conversation.contextStrategy = value
  })
  bindSelect("settings-auto-save", (value) => {
    uiSettings.conversation.autoSave = value
  })
  bindSelect("settings-enter-behavior", (value) => {
    uiSettings.conversation.enterBehavior = value
  })
  bindSelect("settings-reply-style", (value) => {
    uiSettings.conversation.replyStyle = value
  })
  bindSelect("settings-file-permission", (value) => {
    uiSettings.conversation.filePermission = value
    if (value === "deny") {
      composerSettings.hasAttachment = false
      composerSettings.hasImage = false
    }
  })
  bindCheckbox("settings-multi-agent", (value) => {
    uiSettings.conversation.multiAgent = value
  })

  bindSelect("settings-theme", (value) => {
    uiSettings.general.theme = value
  })
  bindSelect("settings-language", (value) => {
    uiSettings.general.language = value
  })
  bindSelect("settings-notification", (value) => {
    uiSettings.general.notification = value
  })
  bindSelect("settings-data-policy", (value) => {
    uiSettings.general.dataPolicy = value
  })
  bindSelect("settings-update-channel", (value) => {
    uiSettings.general.updateChannel = value
  })
  bindSelect("settings-sync-status", (value) => {
    uiSettings.general.syncStatus = value
  })
  bindSelect("settings-status-poll-interval", (value) => {
    uiSettings.general.statusPollInterval = value
    // Apply polling interval change immediately
    applyStatusPollInterval(value)
  })
  bindSelect("settings-profile-name", (value) => {
    uiSettings.profile.nameMode = value
  })
  bindSelect("settings-profile-avatar", (value) => {
    uiSettings.profile.avatarMode = value
  })
  bindSelect("settings-profile-timezone", (value) => {
    uiSettings.profile.timezone = value
  })
  bindSelect("settings-agent-strategy", (value) => {
    uiSettings.agents.strategy = value
  })
  bindSelect("settings-agent-threshold", (value) => {
    uiSettings.agents.threshold = value
  })

  bindCheckbox("settings-beta", (value) => {
    uiSettings.experimental.beta = value
  })
  bindCheckbox("settings-new-interaction", (value) => {
    uiSettings.experimental.newInteraction = value
  })
  bindCheckbox("settings-preview-capability", (value) => {
    uiSettings.experimental.previewCapability = value
  })

  settingsTabButtons.forEach((tabBtn) => {
    tabBtn.addEventListener("click", () => {
      const tab = tabBtn.getAttribute("data-settings-tab")
      if (!tab) return
      switchSettingsTab(tab)
    })
  })

  settingsAgentSaveEl?.addEventListener("click", async () => {
    const canUpdate = desktopBridge?.agent?.updateAgent
    if (!canUpdate || !agentEditorSelectedId) {
      setAgentEditorStatus("更新接口不可用")
      return
    }
    if (BUILTIN_LOCKED_AGENT_IDS.has(agentEditorSelectedId)) {
      setAgentEditorStatus("内置预设角色不允许修改")
      return
    }
    const name = settingsAgentEditorNameEl?.value?.trim() || ""
    const systemPrompt = settingsAgentEditorPromptEl?.value?.trim() || ""
    if (!name || !systemPrompt) {
      setAgentEditorStatus("名称和 systemPrompt 为必填")
      return
    }
    try {
      setAgentEditorStatus("保存中...")
      await desktopBridge.agent.updateAgent(
        activeBaseUrl,
        agentEditorSelectedId,
        {
          name,
          description: settingsAgentEditorDescriptionEl?.value || "",
          model: settingsAgentEditorModelEl?.value || "",
          systemPrompt,
        },
        apiKey,
      )
      await loadAgentDirectory()
      await refreshAgentsForSettings()
      renderSessions()
      setAgentEditorStatus("已保存")
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      setAgentEditorStatus(`保存失败：${msg}`)
    }
  })

  settingsAgentCreateEl?.addEventListener("click", async () => {
    const canCreate = desktopBridge?.agent?.createAgent
    if (!canCreate) {
      setAgentEditorStatus("创建接口不可用")
      return
    }
    const name = settingsAgentEditorNameEl?.value?.trim() || ""
    const systemPrompt = settingsAgentEditorPromptEl?.value?.trim() || ""
    if (!name || !systemPrompt) {
      setAgentEditorStatus("名称和 systemPrompt 为必填")
      return
    }
    try {
      setAgentEditorStatus("创建中...")
      const created = await desktopBridge.agent.createAgent(
        activeBaseUrl,
        {
          name,
          description: settingsAgentEditorDescriptionEl?.value || "",
          model: settingsAgentEditorModelEl?.value || "",
          systemPrompt,
        },
        apiKey,
      )
      agentEditorSelectedId = created.id
      await loadAgentDirectory()
      await refreshAgentsForSettings()
      setAgentEditorStatus("已创建")
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      setAgentEditorStatus(`创建失败：${msg}`)
    }
  })

  settingsAgentDeleteEl?.addEventListener("click", async () => {
    const canDelete = desktopBridge?.agent?.deleteAgent
    if (!canDelete || !agentEditorSelectedId) {
      setAgentEditorStatus("删除接口不可用")
      return
    }
    if (BUILTIN_LOCKED_AGENT_IDS.has(agentEditorSelectedId)) {
      setAgentEditorStatus("内置预设角色不允许删除")
      return
    }
    const selected = agentEditorMap.get(agentEditorSelectedId)
    const ok = window.confirm(`确认删除 Agent「${selected?.name || agentEditorSelectedId}」？`)
    if (!ok) return
    try {
      setAgentEditorStatus("删除中...")
      const deletingId = agentEditorSelectedId
      await desktopBridge.agent.deleteAgent(activeBaseUrl, deletingId, apiKey)
      Object.keys(sessionAgentPreference).forEach((sessionId) => {
        if (sessionAgentPreference[sessionId] === deletingId) {
          delete sessionAgentPreference[sessionId]
        }
      })
      persistSessionAgentPreference()
      await loadAgentDirectory()
      await refreshAgentsForSettings()
      renderSessions()
      setAgentEditorStatus("已删除")
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      setAgentEditorStatus(`删除失败：${msg}`)
    }
  })

  settingsAgentInitPresetsEl?.addEventListener("click", async () => {
    const canCreate = desktopBridge?.agent?.createAgent
    const canUpdate = desktopBridge?.agent?.updateAgent
    if (!canCreate || !canUpdate) {
      setAgentEditorStatus("初始化接口不可用")
      return
    }
    try {
      setAgentEditorStatus("初始化预设中...")
      const current = await desktopBridge.agent.listAgents(activeBaseUrl, apiKey)
      const currentById = new Map(current.map((a) => [a.id, a]))
      for (const preset of PRESET_SOUL_AGENTS) {
        if (currentById.has(preset.id)) {
          continue
        }
        await desktopBridge.agent.createAgent(
          activeBaseUrl,
          {
            id: preset.id,
            name: preset.name,
            description: preset.description,
            systemPrompt: preset.systemPrompt,
          },
          apiKey,
        )
      }
      await loadAgentDirectory()
      await refreshAgentsForSettings()
      setAgentEditorStatus("三种预设性格已初始化，可继续编辑")
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      setAgentEditorStatus(`初始化失败：${msg}`)
    }
  })
}

function switchSettingsTab(tab) {
  settingsTabButtons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.getAttribute("data-settings-tab") === tab)
  })
  ;["general", "profile", "agents"].forEach((name) => {
    const panel = document.getElementById(`settings-tab-${name}`)
    if (!panel) return
    const active = name === tab
    panel.classList.toggle("is-hidden", !active)
    panel.setAttribute("aria-hidden", String(!active))
  })
  if (tab === "agents") {
    void refreshAgentsForSettings()
  }
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
      uiSettings.conversation.defaultModel = value
      persistUiSettings()
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

  uploadAttachmentEl?.addEventListener("click", async () => {
    if (uiSettings.conversation.filePermission === "deny") return
    if (composerSettings.hasAttachment) {
      composerSettings.hasAttachment = false
      attachmentFile = null
      syncComposerSettingsView()
      return
    }
    try {
      const result = await desktopBridge.session?.pickFile?.()
      if (result && result.ref && result.name) {
        attachmentFile = result
        composerSettings.hasAttachment = true
      }
    } catch {
      /* file picker cancelled or unavailable */
    }
    syncComposerSettingsView()
  })

  uploadImageEl?.addEventListener("click", async () => {
    if (uiSettings.conversation.filePermission === "deny") return
    if (composerSettings.hasImage) {
      composerSettings.hasImage = false
      imageFile = null
      syncComposerSettingsView()
      return
    }
    try {
      const result = await desktopBridge.session?.pickImage?.()
      if (result && result.url) {
        imageFile = result
        composerSettings.hasImage = true
      }
    } catch {
      /* file picker cancelled or unavailable */
    }
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

function buildRendererSession(item, fallbackTimeText = "刚刚") {
  const ts = item.updatedAt ?? item.createdAt ?? null
  return {
    id: item.id,
    group: inferGroupByTimestamp(ts),
    title: item.displayName || item.id.slice(0, 10),
    subtitle: "等待对话开始...",
    agentId: item.agentId || null,
    agentName: item.agentId || "theworld",
    agentAvatarUrl: "",
    summaryReady: false,
    time: ts ? formatTime(ts) : fallbackTimeText,
  }
}

function getSessionTimestamp(session) {
  return session?.updatedAt ?? session?.createdAt ?? 0
}

function filterSessionsByQuery(list, query) {
  if (!query || !query.trim()) return list
  const q = query.trim().toLowerCase()
  return list.filter((s) => {
    const title = (s.title || "").toLowerCase()
    const subtitle = (s.subtitle || "").toLowerCase()
    const agentName = getAgentName(s).toLowerCase()
    return title.includes(q) || subtitle.includes(q) || agentName.includes(q)
  })
}

function renderSessions() {
  const filtered = filterSessionsByQuery(sessions, searchQuery)
  const visible = filtered.slice(0, MAX_LEFT_ITEMS)
  const hasMore = filtered.length > MAX_LEFT_ITEMS
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
      rehydrateSessionMessagesFromDisk(activeSessionId)
      renderSessions()
      renderMessages()
      refreshRightPanel()
      void refreshMessagesForActiveSession()
    })
    node.addEventListener("contextmenu", (event) => {
      const sid = node.getAttribute("data-session-id") || ""
      if (sid) showSessionContextMenu(event, sid)
    })
  })

  if (hasMore) {
    const moreBtn = document.createElement("button")
    moreBtn.type = "button"
    moreBtn.className = "session-more-card"
    const filtered = filterSessionsByQuery(sessions, searchQuery)
    moreBtn.textContent = `还有 ${filtered.length - MAX_LEFT_ITEMS} 个会话，点击查看全部`
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

  const activeSession = getActiveSession()
  const assistantAgentName = getAgentName(activeSession)
  const assistantAvatarUrl = getAgentAvatarUrl(activeSession)
  const assistantLetterLabel = getAvatarLabel(assistantAgentName)

  messageListEl.classList.add("is-visible")
  messageListEl.innerHTML = messages
    .map((message) => {
      const normalizedRole =
        message.role === "user" || message.role === "assistant" || message.role === "tool" || message.role === "system"
          ? message.role
          : "assistant"
      const role = normalizedRole
      let avatarInner
      if (role === "user") {
        avatarInner = "我"
      } else if (role === "tool") {
        avatarInner = "T"
      } else if (role === "system") {
        avatarInner = "S"
      } else if (assistantAvatarUrl) {
        avatarInner = `<img class="message-avatar-img" src="${escapeHtml(assistantAvatarUrl)}" alt="${escapeHtml(assistantAgentName)}" loading="lazy" />`
      } else {
        avatarInner = escapeHtml(assistantLetterLabel)
      }
      const roleClass = role === "user" ? "user" : role === "tool" ? "tool" : role === "system" ? "system" : "assistant"
      const bubbleRoleClass = roleClass
      const typingClass = message.__loading ? "is-typing is-loading" : ""
      const rawContent = message.content || ""
      const renderedContent = message.__loading
        ? `<p class="md-p">正在响应<span class="loading-dots"><i></i><i></i><i></i></span></p>`
        : renderMarkdown(rawContent)
      const pendRow = pendingRunBySession.get(activeSessionId)
      const traceForProcessPanel =
        pendRow?.loadingId === message.id && pendRow.traceId ? pendRow.traceId : ""
      const processPanelHtml =
        role === "assistant" ? buildRunProcessPanelHtml(message, traceForProcessPanel || undefined) : ""
      const bubbleWrap =
        role === "assistant"
          ? `<div class="message-column">${processPanelHtml}<div class="message-bubble ${bubbleRoleClass} ${typingClass}">${renderedContent}</div></div>`
          : `<div class="message-bubble ${bubbleRoleClass} ${typingClass}">${renderedContent}</div>`
      return `
        <article class="message-row ${roleClass}">
          <div class="message-avatar ${roleClass}">${avatarInner}</div>
          ${bubbleWrap}
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

messageListEl?.addEventListener("click", async (event) => {
  const btn = event.target.closest("[data-approval-action]")
  if (!btn || !messageListEl.contains(btn)) return
  const action = btn.getAttribute("data-approval-action")
  if (action !== "approve" && action !== "deny") return
  const approvalEl = btn.closest("[data-approval-id]")
  const approvalId = approvalEl?.getAttribute("data-approval-id")?.trim()
  const details = btn.closest(".run-process-details[data-run-trace-id]")
  const traceId = details?.getAttribute("data-run-trace-id")?.trim()
  if (!approvalId) return
  event.preventDefault()
  const approveFn = desktopBridge?.session?.approveApproval
  const denyFn = desktopBridge?.session?.denyApproval
  if (action === "approve" && !approveFn) return
  if (action === "deny" && !denyFn) return
  approvalEl?.querySelectorAll("button[data-approval-action]").forEach((b) => {
    b.disabled = true
  })
  try {
    const result =
      action === "approve"
        ? await approveFn(activeBaseUrl, approvalId, apiKey)
        : await denyFn(activeBaseUrl, approvalId, apiKey)
    if (!result?.ok && statusTextEl) {
      statusTextEl.textContent = `当前状态：approval_resolve_failed(${action})`
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (statusTextEl) {
      statusTextEl.textContent = `当前状态：approval_resolve_error(${msg})`
    }
  }
  if (traceId) {
    await syncApprovalsForTrace(traceId)
  } else {
    renderMessages()
  }
  approvalEl?.querySelectorAll("button[data-approval-action]").forEach((b) => {
    b.disabled = false
  })
})

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
    const pending = pendingRunBySession.get(activeSessionId)
    const prevList = messagesBySession[activeSessionId]
    let preservedRunProcess = null
    if (pending && Array.isArray(prevList)) {
      const oldRow = prevList.find((m) => m.id === pending.loadingId)
      if (oldRow?.__runProcess) {
        preservedRunProcess = oldRow.__runProcess
      }
    }

    messagesBySession[activeSessionId] = remoteMessages
      .map((item) => ({
        id: item.id,
        role: item.role,
        content: item.content || "",
        createdAt: item.createdAt || 0,
      }))
      .map((m) => (m.role === "assistant" ? hydrateAssistantRunFields(activeSessionId, m) : m))
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
        const loadingRow = {
          id: pending.loadingId,
          role: "assistant",
          content: "",
          createdAt: pending.startedAt + 1,
          __loading: true,
          __runProcess:
            preservedRunProcess || {
              streamText: "",
              items: [],
              pendingApprovals: [],
            },
        }
        if (pending.traceId) {
          loadingRow.__traceId = pending.traceId
        }
        messagesBySession[activeSessionId].push(loadingRow)
        saveMessageRunArtifact(activeSessionId, loadingRow)
      } else {
        if (preservedRunProcess) {
          const msgs = messagesBySession[activeSessionId]
          for (let i = msgs.length - 1; i >= 0; i -= 1) {
            const m = msgs[i]
            if (m.role === "assistant" && (m.createdAt || 0) >= pending.startedAt - 1000) {
              promoteRunArtifactMessageId(activeSessionId, pending.loadingId, m.id)
              msgs[i] = {
                ...m,
                __runProcess: preservedRunProcess,
                __traceId: pending.traceId || m.__traceId,
              }
              saveMessageRunArtifact(activeSessionId, msgs[i])
              break
            }
          }
        }
        pendingRunBySession.delete(activeSessionId)
        clearApprovalPoll()
        stopRunPolling()
        setBusyState(false)
      }
    }
    persistSessionAssistantRunArtifacts(activeSessionId)
    renderMessages()
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (statusTextEl) {
      statusTextEl.textContent = `当前状态：message_error(${msg})，请检查服务端与地址配置`
    }
  }
}

function setBusyState(nextBusy) {
  isBusy = nextBusy
  sendBtnEl.disabled = false
  sendBtnEl.setAttribute("aria-label", nextBusy ? "取消运行" : "发送")
  sendBtnEl.setAttribute("title", nextBusy ? "取消运行" : "发送")
  sendBtnEl.classList.toggle("is-cancel", nextBusy)
  composerInputEl.disabled = nextBusy
  composerInputEl.dataset.busy = String(nextBusy)
  if (statusTextEl) {
    statusTextEl.textContent = `当前状态：${nextBusy ? "busy" : "idle"}`
  }
  renderHeroHeader((messagesBySession[activeSessionId] || []).length > 0)
}

function setModuleChipState(chipEl, ok, okText, badText) {
  if (!chipEl) return
  chipEl.classList.toggle("status-ok", ok)
  chipEl.classList.toggle("status-warn", !ok)
  chipEl.textContent = ok ? okText : badText
}

function formatAgeMs(ts) {
  if (!ts) return "未知"
  const diff = Math.max(0, Date.now() - ts)
  const s = Math.round(diff / 1000)
  if (s < 60) return `${s}s 前`
  const m = Math.round(s / 60)
  return `${m}m 前`
}

async function refreshSystemStatus() {
  if (!desktopBridge?.system?.getSystemStatus) return
  try {
    const status = await desktopBridge.system.getSystemStatus(activeBaseUrl, apiKey)
    const schedulerActive = Boolean(status.taskScheduler?.active)
    const schedulerStale = Boolean(status.taskScheduler?.stale)
    setModuleChipState(cronStatusChipEl, schedulerActive && !schedulerStale, "active", "degraded")
    if (cronStatusTextEl) {
      const tickAge = formatAgeMs(status.taskScheduler?.lastTickAt)
      cronStatusTextEl.textContent = `最近调度：${tickAge}`
    }

    const beatTs = status.heartbeat?.schedulerLastBeatAt || status.heartbeat?.taskSseLastBeatAt || 0
    const healthy = Boolean(beatTs) && Date.now() - beatTs < 20000
    setModuleChipState(heartbeatStatusChipEl, healthy, "healthy", "stale")
    if (heartbeatStatusTextEl) {
      heartbeatStatusTextEl.textContent = `最近心跳：${formatAgeMs(beatTs)}`
    }
    refreshRightPanel()
  } catch (error) {
    setModuleChipState(cronStatusChipEl, false, "active", "offline")
    setModuleChipState(heartbeatStatusChipEl, false, "healthy", "offline")
    const msg = error instanceof Error ? error.message : String(error)
    if (cronStatusTextEl) cronStatusTextEl.textContent = `状态获取失败：${msg}`
    if (heartbeatStatusTextEl) heartbeatStatusTextEl.textContent = "最近心跳：不可用"
  }
}

function startSystemStatusPolling() {
  if (systemStatusTimer) {
    window.clearInterval(systemStatusTimer)
  }
  void refreshSystemStatus()
  const intervalMs = Number(uiSettings?.general?.statusPollInterval || 5000)
  if (intervalMs > 0) {
    systemStatusTimer = window.setInterval(() => {
      void refreshSystemStatus()
    }, intervalMs)
  }
}

/** Apply a new polling interval from settings (called on change). */
function applyStatusPollInterval(value) {
  const ms = Number(value)
  if (systemStatusTimer) {
    window.clearInterval(systemStatusTimer)
    systemStatusTimer = null
  }
  if (ms > 0) {
    systemStatusTimer = window.setInterval(() => {
      void refreshSystemStatus()
    }, ms)
  }
  // If ms === 0, polling is disabled
}

function markPendingRunCancelled(sessionId) {
  const pending = pendingRunBySession.get(sessionId)
  if (!pending) return
  pending.cancelled = true
}

function requestCancelActiveRun() {
  const canCancel = desktopBridge?.session?.cancelRun
  if (!canCancel) {
    if (statusTextEl) {
      statusTextEl.textContent = "当前状态：cancel_unavailable"
    }
    return
  }
  if (!activeRunTraceId) {
    cancelRequestedBeforeTrace = true
    if (statusTextEl) {
      statusTextEl.textContent = "当前状态：cancel_pending(等待 traceId)"
    }
    return
  }
  const traceId = activeRunTraceId
  const sessionId = activeSessionId
  markPendingRunCancelled(sessionId)
  if (statusTextEl) {
    statusTextEl.textContent = "当前状态：cancelling..."
  }
  void desktopBridge.session
    .cancelRun(activeBaseUrl, traceId, apiKey)
    .then(({ cancelled }) => {
      if (statusTextEl) {
        statusTextEl.textContent = `当前状态：${cancelled ? "cancelled" : "cancel_not_applied"}`
      }
    })
    .catch((error) => {
      const msg = error instanceof Error ? error.message : String(error)
      if (statusTextEl) {
        statusTextEl.textContent = `当前状态：cancel_error(${msg})`
      }
    })
}

function openAllSessionsView() {
  if (!desktopShellEl || !allSessionsViewEl) {
    return
  }
  desktopShellEl.classList.add("is-hidden")
  allSessionsViewEl.classList.remove("is-hidden")
  allSessionsViewEl.setAttribute("aria-hidden", "false")
  settingsViewEl?.classList.add("is-hidden")
  settingsViewEl?.setAttribute("aria-hidden", "true")
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

function openSettingsView() {
  if (!desktopShellEl || !settingsViewEl) return
  desktopShellEl.classList.add("is-hidden")
  allSessionsViewEl?.classList.add("is-hidden")
  allSessionsViewEl?.setAttribute("aria-hidden", "true")
  settingsViewEl.classList.remove("is-hidden")
  settingsViewEl.setAttribute("aria-hidden", "false")
  switchSettingsTab("general")
  syncSettingsView()
  void refreshAgentsForSettings()
}

function closeSettingsView() {
  if (!desktopShellEl || !settingsViewEl) return
  settingsViewEl.classList.add("is-hidden")
  settingsViewEl.setAttribute("aria-hidden", "true")
  desktopShellEl.classList.remove("is-hidden")
}

function renderAgentPickerList() {
  if (!agentPickerListEl) return
  const agents = Array.from(agentDirectory.entries())
  if (agents.length === 0) {
    agentPickerListEl.innerHTML = `<p class="settings-subtitle">暂无可选 Agent，系统将使用默认角色。</p>`
    return
  }
  if (!selectedAgentIdForCreate || !agentDirectory.has(selectedAgentIdForCreate)) {
    selectedAgentIdForCreate = agents[0][0]
  }
  agentPickerListEl.innerHTML = agents
    .map(([id, meta]) => {
      const activeClass = id === selectedAgentIdForCreate ? "is-active" : ""
      return `<button class="agent-picker-item ${activeClass}" data-agent-id="${id}" type="button">
        <h4>${escapeHtml(meta.name || id)}</h4>
        <p>${escapeHtml(meta.description || `ID: ${id}`)}</p>
      </button>`
    })
    .join("")
  agentPickerListEl.querySelectorAll("[data-agent-id]").forEach((node) => {
    node.addEventListener("click", () => {
      selectedAgentIdForCreate = node.getAttribute("data-agent-id") || selectedAgentIdForCreate
      renderAgentPickerList()
    })
  })
}

function openAgentPicker() {
  if (!agentPickerModalEl) return
  renderAgentPickerList()
  agentPickerModalEl.classList.remove("is-hidden")
  agentPickerModalEl.setAttribute("aria-hidden", "false")
}

function closeAgentPicker() {
  if (!agentPickerModalEl) return
  agentPickerModalEl.classList.add("is-hidden")
  agentPickerModalEl.setAttribute("aria-hidden", "true")
}

function setAgentEditorStatus(text) {
  if (settingsAgentEditorStatusEl) {
    settingsAgentEditorStatusEl.textContent = text
  }
}

function syncAgentEditorOptions() {
  if (!settingsAgentListEl) return
  const entries = Array.from(agentEditorMap.values())
  if (entries.length === 0) {
    settingsAgentListEl.innerHTML = `<p class="settings-subtitle">暂无 Agent</p>`
    agentEditorSelectedId = ""
    return
  }
  if (!agentEditorSelectedId || !agentEditorMap.has(agentEditorSelectedId)) {
    agentEditorSelectedId = entries[0].id
  }
  settingsAgentListEl.innerHTML = entries
    .map((agent) => {
      const activeClass = agent.id === agentEditorSelectedId ? "is-active" : ""
      return `<button class="settings-agent-list-item ${activeClass}" data-agent-item-id="${escapeHtml(agent.id)}" type="button">
        <p>${escapeHtml(agent.name || agent.id)}</p>
        <span>${escapeHtml(agent.id)}</span>
      </button>`
    })
    .join("")
  settingsAgentListEl.querySelectorAll("[data-agent-item-id]").forEach((node) => {
    node.addEventListener("click", () => {
      agentEditorSelectedId = node.getAttribute("data-agent-item-id") || ""
      syncAgentEditorOptions()
      syncAgentEditorForm()
    })
  })
}

function syncAgentEditorForm() {
  const selected = agentEditorMap.get(agentEditorSelectedId)
  const disabled = !selected
  const locked = selected ? BUILTIN_LOCKED_AGENT_IDS.has(selected.id) : false
  if (settingsAgentEditorNameEl) settingsAgentEditorNameEl.disabled = disabled || locked
  if (settingsAgentEditorDescriptionEl) settingsAgentEditorDescriptionEl.disabled = disabled || locked
  if (settingsAgentEditorModelEl) settingsAgentEditorModelEl.disabled = disabled || locked
  if (settingsAgentEditorPromptEl) settingsAgentEditorPromptEl.disabled = disabled || locked
  if (settingsAgentSaveEl) settingsAgentSaveEl.disabled = disabled || locked
  if (settingsAgentDeleteEl) settingsAgentDeleteEl.disabled = disabled || locked
  if (!selected) {
    if (settingsAgentEditorNameEl) settingsAgentEditorNameEl.value = ""
    if (settingsAgentEditorDescriptionEl) settingsAgentEditorDescriptionEl.value = ""
    if (settingsAgentEditorModelEl) settingsAgentEditorModelEl.value = ""
    if (settingsAgentEditorPromptEl) settingsAgentEditorPromptEl.value = ""
    return
  }
  if (settingsAgentEditorNameEl) settingsAgentEditorNameEl.value = selected.name || ""
  if (settingsAgentEditorDescriptionEl) settingsAgentEditorDescriptionEl.value = selected.description || ""
  if (settingsAgentEditorModelEl) settingsAgentEditorModelEl.value = selected.model || ""
  if (settingsAgentEditorPromptEl) settingsAgentEditorPromptEl.value = selected.systemPrompt || ""
  if (locked) {
    setAgentEditorStatus("内置预设角色已锁定，不允许修改或删除")
  } else {
    setAgentEditorStatus("准备就绪")
  }
}

async function refreshAgentsForSettings() {
  if (!desktopBridge?.agent?.listAgents) return
  try {
    const agents = await desktopBridge.agent.listAgents(activeBaseUrl, apiKey)
    agentEditorMap.clear()
    agents.forEach((agent) => {
      const id = (agent.id || "").trim()
      if (!id) return
      agentEditorMap.set(id, {
        id,
        name: (agent.displayName || agent.name || id).trim(),
        description: (agent.description || "").trim(),
        systemPrompt: (agent.systemPrompt || "").trim(),
        model: (agent.model || "").trim(),
      })
    })
    syncAgentEditorOptions()
    syncAgentEditorForm()
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    setAgentEditorStatus(`加载 Agent 失败：${msg}`)
  }
}

function promptAgentForNewSession() {
  return new Promise((resolve) => {
    if (!agentPickerModalEl || !agentPickerConfirmEl || !agentPickerListEl) {
      resolve("")
      return
    }
    const cleanup = () => {
      agentPickerConfirmEl.removeEventListener("click", onConfirm)
      agentPickerCancelEl?.removeEventListener("click", onCancel)
      agentPickerCancelTopEl?.removeEventListener("click", onCancel)
      agentPickerModalEl.removeEventListener("click", onBackdrop)
    }
    const onConfirm = () => {
      cleanup()
      closeAgentPicker()
      resolve(selectedAgentIdForCreate || "")
    }
    const onCancel = () => {
      cleanup()
      closeAgentPicker()
      resolve("")
    }
    const onBackdrop = (event) => {
      if (event.target?.dataset?.agentPickerClose === "true") {
        onCancel()
      }
    }
    agentPickerConfirmEl.addEventListener("click", onConfirm)
    agentPickerCancelEl?.addEventListener("click", onCancel)
    agentPickerCancelTopEl?.addEventListener("click", onCancel)
    agentPickerModalEl.addEventListener("click", onBackdrop)
    openAgentPicker()
  })
}

function showSessionContextMenu(event, sessionId) {
  event.preventDefault()
  event.stopPropagation()
  const existing = document.getElementById("session-context-menu")
  if (existing) existing.remove()
  const menu = document.createElement("div")
  menu.id = "session-context-menu"
  menu.className = "context-menu"
  menu.style.left = `${event.clientX}px`
  menu.style.top = `${event.clientY}px`
  const items = [
    { label: "重命名", action: "rename" },
    { label: "删除", action: "delete", danger: true },
  ]
  menu.innerHTML = items.map((item) =>
    `<button class="context-menu-item${item.danger ? " is-danger" : ""}" data-action="${item.action}" type="button">${item.label}</button>`
  ).join("")
  document.body.appendChild(menu)
  menu.querySelectorAll(".context-menu-item").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.getAttribute("data-action")
      menu.remove()
      if (action === "delete") {
        const ok = window.confirm("确认删除该会话？此操作不可恢复。")
        if (!ok) return
        try {
          await desktopBridge.session.deleteSession(activeBaseUrl, sessionId, apiKey)
          await loadSessionsFromSurface()
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          if (sessionFetchStatusEl) sessionFetchStatusEl.textContent = `删除会话失败：${msg}`
        }
      } else if (action === "rename") {
        const session = sessions.find((s) => s.id === sessionId)
        const newName = window.prompt("输入新名称", session?.title || "")
        if (newName === null || !newName.trim()) return
        try {
          await desktopBridge.session.patchSession(activeBaseUrl, sessionId, { displayName: newName.trim() }, apiKey)
          await loadSessionsFromSurface(sessionId)
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          if (sessionFetchStatusEl) sessionFetchStatusEl.textContent = `重命名失败：${msg}`
        }
      }
    })
  })
  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove()
      document.removeEventListener("click", closeMenu)
    }
  }
  window.setTimeout(() => document.addEventListener("click", closeMenu), 0)
}

function renderAllSessions() {
  if (!allSessionsListEl) {
    return
  }
  const filtered = filterSessionsByQuery(sessions, searchQuery)
  allSessionsListEl.innerHTML = filtered
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
      rehydrateSessionMessagesFromDisk(activeSessionId)
      closeAllSessionsView()
      renderSessions()
      renderMessages()
      refreshRightPanel()
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
      agentDirectory.set(id, {
        name,
        avatarUrl,
        description: (agent.description || "").trim(),
      })
    })
    await syncBuiltinPresetPromptsFromPresets(agents)
  } catch (_error) {
    // keep fallback rendering when agent directory unavailable
  }
}

async function syncBuiltinPresetPromptsFromPresets(agents) {
  if (!desktopBridge?.agent?.updateAgent) {
    return
  }
  let stored = 0
  try {
    stored = parseInt(localStorage.getItem(BUILTIN_PRESET_PROMPTS_STORAGE_KEY) || "0", 10)
  } catch {
    stored = 0
  }
  if (stored >= BUILTIN_PRESET_PROMPTS_REV) {
    return
  }
  const existingIds = new Set(agents.map((a) => (a.id || "").trim()).filter(Boolean))
  let allAttemptsOk = true
  for (const preset of PRESET_SOUL_AGENTS) {
    if (!existingIds.has(preset.id)) {
      continue
    }
    try {
      await desktopBridge.agent.updateAgent(
        activeBaseUrl,
        preset.id,
        {
          name: preset.name,
          description: preset.description,
          systemPrompt: preset.systemPrompt,
        },
        apiKey,
      )
    } catch (_error) {
      allAttemptsOk = false
    }
  }
  if (allAttemptsOk) {
    localStorage.setItem(BUILTIN_PRESET_PROMPTS_STORAGE_KEY, String(BUILTIN_PRESET_PROMPTS_REV))
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

function refreshRightPanel() {
  if (rightPanelController?.refresh) {
    void rightPanelController.refresh()
  }
}

sendBtnEl.addEventListener("click", () => {
  const content = composerInputEl.value.trim()
  if (isBusy) {
    requestCancelActiveRun()
    return
  }
  if (!content) {
    return
  }
  if (!activeSessionId || !sessions.some((s) => s.id === activeSessionId)) {
    if (statusTextEl) {
      statusTextEl.textContent =
        "当前状态：no_session — 请先连接后端并新建会话，或等待左侧会话列表加载完成。"
    }
    if (sessionFetchStatusEl) {
      sessionFetchStatusEl.textContent = "发送已阻止：当前没有有效的服务端会话。"
    }
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
    __runProcess: {
      streamText: "",
      items: [],
      pendingApprovals: [],
    },
  })
  pendingRunBySession.set(activeSessionId, { startedAt, inputText, localUserId, loadingId })
  composerInputEl.value = ""
  renderContextUsage()
  renderMessages()
  setBusyState(true)
  activeRunTraceId = null
  cancelRequestedBeforeTrace = false

  const canRun =
    typeof desktopBridge?.session?.createRun === "function" &&
    typeof desktopBridge?.session?.streamRunUntilTerminal === "function"
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
  const attachments = []
  if (composerSettings.hasAttachment && attachmentFile) {
    attachments.push({
      kind: "file",
      ref: attachmentFile.ref,
      name: attachmentFile.name,
      mimeType: attachmentFile.mimeType,
    })
  }
  if (composerSettings.hasImage && imageFile) {
    attachments.push({
      kind: "image",
      url: imageFile.url,
      mimeType: imageFile.mimeType,
      detail: "auto",
    })
  }
  const preferredAgentId = sessionAgentPreference[activeSessionId] || ""
  const modelMappedAgentId = MODEL_TO_AGENT_ID[composerSettings.model] || ""
const runOptions = {
...((preferredAgentId || modelMappedAgentId) ? { agentId: preferredAgentId || modelMappedAgentId } : {}),
...(attachments.length > 0 ? { attachments } : {}),
...(resolveExecutionMode() !== "standard" ? { executionMode: resolveExecutionMode() } : {}),
}
  void desktopBridge.session
    .createRun(activeBaseUrl, activeSessionId, inputText, apiKey, runOptions)
    .then(({ traceId }) => {
      activeRunTraceId = traceId
      const pending = pendingRunBySession.get(activeSessionId)
      if (pending) pending.traceId = traceId
      if (cancelRequestedBeforeTrace) {
        requestCancelActiveRun()
      }
      startApprovalPollForTrace(traceId)
      const sid = activeSessionId
      return desktopBridge.session
        .streamRunUntilTerminal(activeBaseUrl, traceId, apiKey, (ev) => handleRunStreamEvent(sid, ev))
        .then(() => refreshMessagesForActiveSession())
        .then(() => attachTraceToLastAssistant(sid, traceId))
    })
    .catch((error) => {
      const msg = error instanceof Error ? error.message : String(error)
      addAssistantMessage(`运行失败：${msg}`)
      renderMessages()
      if (statusTextEl) {
        statusTextEl.textContent = `当前状态：run_error(${msg})，请检查服务端与地址配置`
      }
    })
    .finally(() => {
      stopRunPolling()
      clearApprovalPoll()
      activeRunTraceId = null
      cancelRequestedBeforeTrace = false
      const pending = pendingRunBySession.get(activeSessionId)
      if (pending) {
        const listNow = messagesBySession[activeSessionId] || []
        const idx = listNow.findIndex((m) => m.id === pending.loadingId)
        if (idx >= 0) {
          listNow[idx] = {
            ...listNow[idx],
            __loading: false,
            content: listNow[idx].content || (pending.cancelled ? "该次运行已取消。" : "暂未收到回复，请稍后重试。"),
          }
          messagesBySession[activeSessionId] = listNow
          saveMessageRunArtifact(activeSessionId, listNow[idx])
        }
        pendingRunBySession.delete(activeSessionId)
      }
      renderMessages()
      setBusyState(false)
    })
})

composerInputEl.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return
  const mode = uiSettings.conversation.enterBehavior
  if (mode === "enter-newline") {
    if (event.shiftKey) {
      event.preventDefault()
      sendBtnEl.click()
    }
    return
  }
  if (!event.shiftKey) {
    event.preventDefault()
    sendBtnEl.click()
  }
})

document.addEventListener("keydown", (event) => {
  const isMeta = event.metaKey || event.ctrlKey
  if (isMeta && event.key === "n") {
    event.preventDefault()
    newSessionBtnEl.click()
  }
  if (isMeta && event.key === ",") {
    event.preventDefault()
    openSettingsBtnEl?.click()
  }
  if (isMeta && event.key === "f") {
    event.preventDefault()
    const searchInput = document.getElementById("session-search-input")
    if (searchInput) searchInput.focus()
  }
  if (isMeta && event.key === "k") {
    event.preventDefault()
    newSessionBtnEl.click()
  }
  if (event.key === "Escape") {
    if (!agentPickerModalEl?.classList.contains("is-hidden")) {
      closeAgentPicker()
    }
  }
})

newSessionBtnEl.addEventListener("click", async () => {
  const canCreate = desktopBridge?.session?.createSession
  const canProbe = desktopBridge?.session?.probeRunSurface
  if (!canCreate) {
    if (sessionFetchStatusEl) {
      sessionFetchStatusEl.textContent = "新建会话接口不可用，暂未创建。"
    }
    return
  }

  let createdSessionId = ""
  let selectedAgentId = ""
  let lastError = "unknown"
  try {
    if (agentDirectory.size === 0) {
      await loadAgentDirectory()
    }
    selectedAgentId = await promptAgentForNewSession()
    if (!selectedAgentId) {
      if (sessionFetchStatusEl) {
        sessionFetchStatusEl.textContent = "已取消创建会话"
      }
      return
    }
    for (const candidate of baseUrlCandidates) {
      try {
        if (canProbe) {
          const runReady = await desktopBridge.session.probeRunSurface(candidate, apiKey)
          if (!runReady) {
            continue
          }
        }
        const created = await desktopBridge.session.createSession(candidate, apiKey)
        activeBaseUrl = candidate
        localStorage.setItem("theworld_console_base_url", candidate)
        createdSessionId = created.id
        break
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }
    if (!createdSessionId) {
      throw new Error(lastError || "create_session_failed")
    }
    sessionAgentPreference[createdSessionId] = selectedAgentId
    persistSessionAgentPreference()
    await loadSessionsFromSurface(createdSessionId)
    if (sessionFetchStatusEl) {
      sessionFetchStatusEl.textContent = "已创建新会话"
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (sessionFetchStatusEl) {
      sessionFetchStatusEl.textContent = `新建会话失败：${msg}`
    }
    if (statusTextEl) {
      statusTextEl.textContent = `当前状态：session_create_error(${msg})`
    }
  }
})

backFromAllSessionsBtn?.addEventListener("click", () => {
  closeAllSessionsView()
})

openSettingsBtnEl?.addEventListener("click", () => {
  openSettingsView()
})

backFromSettingsBtnEl?.addEventListener("click", () => {
  closeSettingsView()
})

async function loadSessionsFromSurface(preferredSessionId = "") {
  if (!desktopBridge?.session?.listSessions) {
    sessionFetchStatusEl.textContent = "会话接口不可用，使用本地占位数据。"
    return
  }

  const canProbe = desktopBridge?.session?.probeRunSurface
  let lastError = "unknown"
  for (const candidate of baseUrlCandidates) {
    try {
      if (canProbe) {
        const runReady = await desktopBridge.session.probeRunSurface(candidate, apiKey)
        if (!runReady) {
          lastError = `candidate ${candidate} 缺少 /v1/runs`
          continue
        }
      }
      const remoteSessions = await desktopBridge.session.listSessions(candidate, apiKey)
      const chatSessions = remoteSessions
        .filter((item) => !item.kind || item.kind === "chat")
        .sort((a, b) => getSessionTimestamp(b) - getSessionTimestamp(a))
      activeBaseUrl = candidate
      localStorage.setItem("theworld_console_base_url", candidate)
      if (backendTextEl) {
        backendTextEl.textContent = `后端地址：${activeBaseUrl}`
      }
      sessions.length = 0
      const keepIds = new Set(chatSessions.map((s) => s.id))
      for (const k of Object.keys(messagesBySession)) {
        if (!keepIds.has(k)) {
          delete messagesBySession[k]
        }
      }
      await loadAgentDirectory()

      for (const item of chatSessions) {
        const session = buildRendererSession(item, "未知时间")
        const preferredAgentId = sessionAgentPreference[item.id]
        if (preferredAgentId) {
          session.agentId = preferredAgentId
          session.agentName = agentDirectory.get(preferredAgentId)?.name || preferredAgentId
        }
        session.subtitle = "摘要加载中..."
        sessions.push(session)
        if (!messagesBySession[item.id]) {
          messagesBySession[item.id] = []
        }
      }

      if (sessions.length > 0) {
        const preferred = preferredSessionId && sessions.some((item) => item.id === preferredSessionId)
        activeSessionId = preferred ? preferredSessionId : sessions[0].id
        sessionFetchStatusEl.textContent = `已加载 ${sessions.length} 个会话`
      } else {
        activeSessionId = ""
        sessionFetchStatusEl.textContent = "当前无会话，显示空态。"
      }
      rehydrateSessionMessagesFromDisk(activeSessionId)
      renderSessions()
      renderMessages()
      refreshRightPanel()
      void refreshMessagesForActiveSession()
      void refreshSessionStartSummaries()
      return
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }

  if (backendTextEl) {
    backendTextEl.textContent = `后端地址：${activeBaseUrl}`
  }
  sessions.length = 0
  activeSessionId = ""
  for (const k of Object.keys(messagesBySession)) {
    delete messagesBySession[k]
  }
  sessionFetchStatusEl.textContent = `会话加载失败：${lastError}`
  renderSessions()
  renderMessages()
  refreshRightPanel()
}

renderSessions()
renderMessages()
rightPanelController = mountRightPanel(document.getElementById("right-panel-root"), {
  getActiveSessionId: () => activeSessionId,
  loadSessionMessages: async (sessionId) => {
    if (!desktopBridge?.session?.getSessionMessages) return []
    return desktopBridge.session.getSessionMessages(activeBaseUrl, sessionId, apiKey)
  },
  saveCapture: async (sessionId, text) => {
    if (!desktopBridge?.session?.createSessionMessage) return
    await desktopBridge.session.createSessionMessage(
      activeBaseUrl,
      sessionId,
      `[RIGHT_PANEL_CAPTURE] ${text}`,
      "user",
      apiKey,
    )
    await refreshMessagesForActiveSession()
  },
  recordAction: async (sessionId, item, action) => {
    if (!desktopBridge?.session?.createSessionMessage) return
    const actionLabel = action === "adopt" ? "采纳" : action === "edit" ? "编辑" : "暂存"
    await desktopBridge.session.createSessionMessage(
      activeBaseUrl,
      sessionId,
      `右栏动作：${actionLabel} · ${item.title}`,
      "system",
      apiKey,
    )
    await refreshMessagesForActiveSession()
  },
  getHeartbeatText: () => (heartbeatStatusTextEl?.textContent || "").replace(/^最近心跳：/, "").trim() || "未知",
})
initPaneWidths()
bindPaneResizers()
bindComposerToolbar()
bindSettingsView()
syncSettingsView()
void loadSessionsFromSurface()
startSystemStatusPolling()

// ── Wave 1A: Search & Left Pane Collapse ──────────────────────────────────

const sessionSearchWrapEl = document.getElementById("session-search-wrap")
const sessionSearchInputEl = document.getElementById("session-search-input")
const toggleSearchEl = document.getElementById("toggle-search")
const toggleLeftPaneEl = document.getElementById("toggle-left-pane")

toggleSearchEl?.addEventListener("click", () => {
  if (!sessionSearchWrapEl) return
  const shown = !sessionSearchWrapEl.classList.contains("is-hidden")
  if (shown) {
    sessionSearchWrapEl.classList.add("is-hidden")
    searchQuery = ""
    if (sessionSearchInputEl) sessionSearchInputEl.value = ""
    renderSessions()
  } else {
    sessionSearchWrapEl.classList.remove("is-hidden")
    sessionSearchInputEl?.focus()
  }
})

sessionSearchInputEl?.addEventListener("input", () => {
  searchQuery = sessionSearchInputEl.value
  renderSessions()
})

toggleLeftPaneEl?.addEventListener("click", () => {
  leftPaneCollapsed = !leftPaneCollapsed
  if (paneLeftEl) {
    paneLeftEl.classList.toggle("is-collapsed", leftPaneCollapsed)
  }
  if (resizerLeftEl) {
    resizerLeftEl.style.display = leftPaneCollapsed ? "none" : ""
  }
  if (toggleLeftPaneEl) {
    toggleLeftPaneEl.title = leftPaneCollapsed ? "展开侧栏" : "折叠侧栏"
    toggleLeftPaneEl.textContent = leftPaneCollapsed ? "☰" : "栏"
  }
})

document.getElementById("new-session-rail-btn")?.addEventListener("click", () => {
  newSessionBtnEl.click()
})

// ── Wave 1B: Network & Control → executionMode mapping ────────────────────

const EXECUTION_MODE_MAP = {
  "network-on_control-off": "standard",
  "network-on_control-on":  "full_control",
  "network-off_control-off": "offline",
  "network-off_control-on":  "full_control_offline",
}

function resolveExecutionMode() {
  const net = composerSettings.networkEnabled ? "network-on" : "network-off"
  const ctrl = composerSettings.fullControlEnabled ? "control-on" : "control-off"
  return EXECUTION_MODE_MAP[`${net}_${ctrl}`] || "standard"
}

// ── Wave 2A: Task Management ──────────────────────────────────────────────

const tasksViewEl = document.getElementById("tasks-view")
const taskListEl = document.getElementById("task-list")
const createTaskBtnEl = document.getElementById("create-task-btn")
const backFromTasksEl = document.getElementById("back-from-tasks")
const taskDetailPanelEl = document.getElementById("task-detail-panel")
const taskDetailTitleEl = document.getElementById("task-detail-title")
const taskDetailRunsEl = document.getElementById("task-detail-runs")

async function loadAndRenderTasks() {
  if (!taskListEl) return
  try {
    const tasks = await desktopBridge.task.listTasks(activeBaseUrl, apiKey)
    if (!Array.isArray(tasks) || tasks.length === 0) {
      taskListEl.innerHTML = '<p class="settings-subtitle">暂无任务</p>'
      return
    }
    taskListEl.innerHTML = tasks.map((t) => `
      <div class="session-item" data-task-id="${escapeHtml(t.id)}">
        <div class="session-main">
          <p class="session-title">${escapeHtml(t.name || t.id)}</p>
          <p class="session-subtitle">触发方式：${escapeHtml(t.triggerType || "unknown")} · ${t.enabled ? "已启用" : "已禁用"}</p>
        </div>
        <div class="session-item-actions">
          <button class="ghost-btn task-trigger-btn" data-task-id="${escapeHtml(t.id)}" type="button">触发</button>
          <button class="ghost-btn task-toggle-btn" data-task-id="${escapeHtml(t.id)}" data-enabled="${t.enabled}" type="button">${t.enabled ? "禁用" : "启用"}</button>
          <button class="ghost-btn task-history-btn" data-task-id="${escapeHtml(t.id)}" type="button">历史</button>
          <button class="ghost-btn task-delete-btn" data-task-id="${escapeHtml(t.id)}" type="button" style="color:var(--color-danger,red)">删除</button>
        </div>
      </div>
    `).join("")

    taskListEl.querySelectorAll(".task-trigger-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const taskId = btn.getAttribute("data-task-id")
        try {
          await desktopBridge.task.triggerTask(activeBaseUrl, taskId, apiKey)
          loadAndRenderTasks()
        } catch (e) {
          alert(`触发任务失败：${e instanceof Error ? e.message : String(e)}`)
        }
      })
    })
    taskListEl.querySelectorAll(".task-toggle-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const taskId = btn.getAttribute("data-task-id")
        const enabled = btn.getAttribute("data-enabled") === "true"
        try {
          if (enabled) {
            await desktopBridge.task.disableTask(activeBaseUrl, taskId, apiKey)
          } else {
            await desktopBridge.task.enableTask(activeBaseUrl, taskId, apiKey)
          }
          loadAndRenderTasks()
        } catch (e) {
          alert(`操作失败：${e instanceof Error ? e.message : String(e)}`)
        }
      })
    })
    taskListEl.querySelectorAll(".task-history-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const taskId = btn.getAttribute("data-task-id")
        try {
          const runs = await desktopBridge.task.listTaskRuns(activeBaseUrl, taskId, apiKey)
          if (taskDetailPanelEl) taskDetailPanelEl.classList.remove("is-hidden")
          if (taskDetailTitleEl) taskDetailTitleEl.textContent = `任务 ${taskId} 运行历史`
          if (taskDetailRunsEl) {
            if (!Array.isArray(runs) || runs.length === 0) {
              taskDetailRunsEl.innerHTML = '<p class="settings-subtitle">暂无运行记录</p>'
            } else {
              taskDetailRunsEl.innerHTML = runs.map((r) => `
                <div class="session-item">
                  <div class="session-main">
                    <p class="session-title">${escapeHtml(r.id || "")}</p>
                    <p class="session-subtitle">状态：${escapeHtml(r.status || "unknown")}</p>
                  </div>
                </div>
              `).join("")
            }
          }
        } catch (e) {
          alert(`加载运行历史失败：${e instanceof Error ? e.message : String(e)}`)
        }
      })
    })
    taskListEl.querySelectorAll(".task-delete-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const taskId = btn.getAttribute("data-task-id")
        const ok = window.confirm(`确认删除任务 ${taskId}？`)
        if (!ok) return
        try {
          await desktopBridge.task.deleteTask(activeBaseUrl, taskId, apiKey)
          loadAndRenderTasks()
        } catch (e) {
          alert(`删除失败：${e instanceof Error ? e.message : String(e)}`)
        }
      })
    })
  } catch (e) {
    taskListEl.innerHTML = `<p class="settings-subtitle">加载任务失败：${e instanceof Error ? e.message : String(e)}</p>`
  }
}

createTaskBtnEl?.addEventListener("click", async () => {
  const name = window.prompt("任务名称")
  if (!name?.trim()) return
  const triggerType = window.prompt("触发方式 (cron / event / manual)", "manual")
  try {
    await desktopBridge.task.createTask(activeBaseUrl, { name: name.trim(), triggerType: triggerType || "manual" }, apiKey)
    loadAndRenderTasks()
  } catch (e) {
    alert(`创建任务失败：${e instanceof Error ? e.message : String(e)}`)
  }
})

backFromTasksEl?.addEventListener("click", () => {
  if (tasksViewEl) {
    tasksViewEl.classList.add("is-hidden")
    tasksViewEl.setAttribute("aria-hidden", "true")
  }
  if (desktopShellEl) {
    desktopShellEl.classList.remove("is-hidden")
  }
})

// ── Wave 2B: Tools & Skills View ──────────────────────────────────────────

const toolsViewEl = document.getElementById("tools-view")
const toolsListEl = document.getElementById("tools-list")
const skillsListEl = document.getElementById("skills-list")
const backFromToolsEl = document.getElementById("back-from-tools")

async function loadAndRenderTools() {
  if (toolsListEl) {
    try {
      const tools = await desktopBridge.system.listTools(activeBaseUrl, apiKey)
      if (!Array.isArray(tools) || tools.length === 0) {
        toolsListEl.innerHTML = '<p class="settings-subtitle">暂无注册工具</p>'
      } else {
        toolsListEl.innerHTML = tools.map((t) => `
          <div class="session-item">
            <div class="session-main">
              <p class="session-title">${escapeHtml(t.name || t.id || "unknown")}</p>
              <p class="session-subtitle">${escapeHtml(t.description || "无描述")}</p>
            </div>
          </div>
        `).join("")
      }
    } catch {
      toolsListEl.innerHTML = '<p class="settings-subtitle">加载工具失败</p>'
    }
  }
  if (skillsListEl) {
    try {
      const skills = await desktopBridge.system.listSkills(activeBaseUrl, apiKey)
      if (!Array.isArray(skills) || skills.length === 0) {
        skillsListEl.innerHTML = '<p class="settings-subtitle">暂无注册技能</p>'
      } else {
        skillsListEl.innerHTML = skills.map((s) => `
          <div class="session-item">
            <div class="session-main">
              <p class="session-title">${escapeHtml(s.name || s.id || "unknown")}</p>
              <p class="session-subtitle">${escapeHtml(s.description || "无描述")}</p>
            </div>
          </div>
        `).join("")
      }
    } catch {
      skillsListEl.innerHTML = '<p class="settings-subtitle">加载技能失败</p>'
    }
  }
}

backFromToolsEl?.addEventListener("click", () => {
  if (toolsViewEl) {
    toolsViewEl.classList.add("is-hidden")
    toolsViewEl.setAttribute("aria-hidden", "true")
  }
  if (desktopShellEl) {
    desktopShellEl.classList.remove("is-hidden")
  }
})

// ── Wave 3A: Top Tab Switching ────────────────────────────────────────────

function switchTopTab(tabId) {
activeTopTab = tabId
document.querySelectorAll("[data-top-tab]").forEach((btn) => {
btn.classList.toggle("is-active", btn.getAttribute("data-top-tab") === tabId)
})
if (typeof window.closeAllFlyouts === "function") window.closeAllFlyouts()
// Hide all sub-views and desktop shell
const subViews = [tasksViewEl, toolsViewEl, allSessionsViewEl, settingsViewEl]
  subViews.forEach((v) => {
    if (v) {
      v.classList.add("is-hidden")
      v.setAttribute("aria-hidden", "true")
    }
  })

  // Channel view
  const channelViewEl = document.getElementById("channel-view")
  if (channelViewEl) {
    channelViewEl.classList.toggle("is-hidden", tabId !== "channel")
    channelViewEl.setAttribute("aria-hidden", tabId !== "channel")
  }

  if (tabId === "channel") {
    if (desktopShellEl) desktopShellEl.classList.add("is-hidden")
    window.initChannelView?.()
    return
  }

  if (desktopShellEl) desktopShellEl.classList.remove("is-hidden")

  if (tabId === "tasks") {
    if (desktopShellEl) desktopShellEl.classList.add("is-hidden")
    if (tasksViewEl) {
      tasksViewEl.classList.remove("is-hidden")
      tasksViewEl.removeAttribute("aria-hidden")
    }
    loadAndRenderTasks()
  } else if (tabId === "tools") {
    if (desktopShellEl) desktopShellEl.classList.add("is-hidden")
    if (toolsViewEl) {
      toolsViewEl.classList.remove("is-hidden")
      toolsViewEl.removeAttribute("aria-hidden")
    }
    loadAndRenderTools()
  }
}

document.querySelectorAll("[data-top-tab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    switchTopTab(btn.getAttribute("data-top-tab"))
  })
})

// ── Wave 3A: Connection Status Health Check ───────────────────────────────

const connectionDotEl = document.getElementById("connection-status-dot")

async function checkConnectionHealth() {
  if (!desktopBridge?.system?.getHealth) {
    connectionHealthy = false
    if (connectionDotEl) connectionDotEl.className = "connection-dot is-down"
    return
  }
  try {
    const result = await desktopBridge.system.getHealth(activeBaseUrl, apiKey)
    connectionHealthy = Boolean(result?.ok)
    if (connectionDotEl) connectionDotEl.className = "connection-dot is-up"
  } catch {
    connectionHealthy = false
    if (connectionDotEl) connectionDotEl.className = "connection-dot is-down"
  }
}

setInterval(checkConnectionHealth, 30000)
checkConnectionHealth()

// ── Wave 3A: Context Panel Refresh from Run Context ──────────────────────

async function refreshContextFromRun() {
  if (!activeRunTraceId || !desktopBridge?.session?.getRunContext) return
  try {
    const ctx = await desktopBridge.session.getRunContext(activeBaseUrl, activeRunTraceId, apiKey)
    if (ctx && contextModelValueEl) {
      if (ctx.model) contextModelValueEl.textContent = String(ctx.model)
      if (ctx.networkEnabled !== undefined) contextNetworkValueEl.textContent = ctx.networkEnabled ? "on" : "off"
      if (ctx.fullControl !== undefined) contextControlValueEl.textContent = ctx.fullControl ? "on" : "off"
      if (ctx.usage) {
        const ratio = typeof ctx.usage === "number" ? ctx.usage : (ctx.usage.ratio ?? 0)
        if (contextRingEl) contextRingEl.style.setProperty("--usage", String(Math.min(ratio, 1)))
      }
    }
  } catch {
    /* context not available yet */
  }
}

// ── Wave 2B: Agent Enable/Disable in Settings ────────────────────────────

function addAgentToggleButtons() {
  const listEl = settingsAgentListEl
  if (!listEl) return
  listEl.querySelectorAll("[data-agent-id]").forEach((item) => {
    if (item.querySelector(".agent-toggle-btn")) return
    const agentId = item.getAttribute("data-agent-id")
    const agent = agentEditorMap.get(agentId)
    if (!agent) return
    const btn = document.createElement("button")
    btn.className = "ghost-btn agent-toggle-btn"
    btn.type = "button"
    btn.textContent = agent.enabled === false ? "启用" : "禁用"
    btn.addEventListener("click", async () => {
      try {
        if (agent.enabled === false) {
          await desktopBridge.agent.enableAgent(activeBaseUrl, agentId, apiKey)
        } else {
          await desktopBridge.agent.disableAgent(activeBaseUrl, agentId, apiKey)
        }
        await loadAgentDirectory()
        renderAgentList()
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (settingsAgentEditorStatusEl) settingsAgentEditorStatusEl.textContent = `操作失败：${msg}`
      }
    })
    item.appendChild(btn)
  })
}

// Patch the existing renderAgentList to also call addAgentToggleButtons
const _origRenderAgentList = typeof renderAgentList === "function" ? renderAgentList : null
function renderAgentListPatched() {
  if (_origRenderAgentList) _origRenderAgentList()
  addAgentToggleButtons()
}

// ── Wave 5: Message Context Menu (Copy / Export) ──────────────────────────

function renderMessageContextMenu(event, messageEl) {
  event.preventDefault()
  const existing = document.getElementById("message-context-menu")
  if (existing) existing.remove()
  const menu = document.createElement("div")
  menu.id = "message-context-menu"
  menu.className = "context-menu"
  menu.style.left = `${event.clientX}px`
  menu.style.top = `${event.clientY}px`
  const items = [
    { label: "复制内容", action: "copy" },
    { label: "导出会话", action: "export" },
  ]
  menu.innerHTML = items.map((item) =>
    `<button class="context-menu-item" data-action="${item.action}" type="button">${item.label}</button>`
  ).join("")
  document.body.appendChild(menu)
  menu.querySelectorAll(".context-menu-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-action")
      menu.remove()
      if (action === "copy") {
        const content = messageEl?.querySelector(".message-content")?.textContent || ""
        navigator.clipboard?.writeText(content).catch(() => {})
      } else if (action === "export") {
        const msgs = messagesBySession[activeSessionId]
        if (!Array.isArray(msgs)) return
        const text = msgs.map((m) => `[${m.role || "unknown"}] ${m.content || ""}`).join("\n---\n")
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `session-${activeSessionId}.txt`
        a.click()
        URL.revokeObjectURL(url)
      }
    })
  })
  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove()
      document.removeEventListener("click", closeMenu)
    }
  }
  window.setTimeout(() => document.addEventListener("click", closeMenu), 0)
}

messageListEl?.addEventListener("contextmenu", (event) => {
  const msgEl = event.target.closest("[data-message-id]")
  if (msgEl) renderMessageContextMenu(event, msgEl)
})

// ── Wave 3B: Auto-refresh context on active run ──────────────────────────

const _origSetBusy = typeof setBusy === "function" ? setBusy : null
function setBusyPatched(nextBusy) {
  if (_origSetBusy) _origSetBusy(nextBusy)
  if (!nextBusy && activeRunTraceId) {
    refreshContextFromRun()
  }
}


// ── Cron Panel, Toast, Task SSE, Heartbeat Panel ──────────────────────────
// These modules have been extracted to separate plain scripts loaded after this module:
//   - toast-system.js  (showToast, dismissToast)
//   - cron-panel.js    (closeAllFlyouts, openFlyout, refreshCronSchedulerStatus, loadAndRenderCronTasks)
//   - heartbeat-panel.js (refreshHeartbeatPanel)
//   - task-sse.js      (subscribeTaskEvents, unsubscribeTaskEvents)
// Functions are available via window after those scripts load.

// ── Channel View (IM Panel) ──────────────────────────────────────────────
// Channel code has been extracted to channel-app.js (plain script loaded after this module).
// Channel functions are available via window after channel-app.js loads.
// initChannelView is called via window.initChannelView() when the channel tab is activated.

// ── Expose app-level globals for channel-app.js and discussion-engine.js ─
Object.assign(window, { desktopBridge, activeBaseUrl, apiKey, escapeHtml, svgIcon, sessions, messagesBySession, activeSessionId, renderMessages, renderSessions })
