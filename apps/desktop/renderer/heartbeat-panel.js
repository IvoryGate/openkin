/**
 * heartbeat-panel.js — Heartbeat monitoring panel
 *
 * Extracted from app.js to reduce file size.
 * This is a plain script (not module), loaded after cron-panel.js via index.html.
 * Dependencies accessed via window:
 *   - desktopBridge, activeBaseUrl, apiKey
 *   - showToast, escapeHtml
 *   - closeAllFlyouts, openFlyout (from cron-panel.js)
 */

const heartbeatViewEl = document.getElementById("heartbeat-view")
const hbSchedulerBeatEl = document.getElementById("hb-scheduler-beat")
const hbTaskSseBeatEl = document.getElementById("hb-task-sse-beat")
const hbUptimeEl = document.getElementById("hb-uptime")
const hbDbStatusEl = document.getElementById("hb-db-status")
const hbActiveSessionsEl = document.getElementById("hb-active-sessions")
const hbVersionEl = document.getElementById("hb-version")
const hbOverallStatusEl = document.getElementById("heartbeat-overall-status")
const hbTimelineEl = document.getElementById("heartbeat-timeline")
const heartbeatModuleCardEl = document.getElementById("heartbeat-module-card")
const closeHeartbeatFlyoutEl = document.getElementById("close-heartbeat-flyout")

const heartbeatHistory = []
const MAX_HEARTBEAT_HISTORY = 30
let lastHeartbeatAlertTs = 0

function _esc(raw) {
  if (typeof window.escapeHtml === "function") return window.escapeHtml(raw)
  return String(raw)
}

function _toast(type, message, onClick) {
  if (typeof window.showToast === "function") return window.showToast(type, message, onClick)
}

function formatUptime(seconds) {
  if (!seconds || seconds <= 0) return "—"
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}

function _formatAgeMs(ts) {
  if (!ts) return "未知"
  const diff = Math.max(0, Date.now() - ts)
  const s = Math.round(diff / 1000)
  if (s < 60) return `${s}s 前`
  const m = Math.round(s / 60)
  return `${m}m 前`
}

async function refreshHeartbeatPanel() {
  const desktopBridge = window.desktopBridge
  const activeBaseUrl = window.activeBaseUrl
  const apiKey = window.apiKey
  const closeAllFlyouts = window.closeAllFlyouts
  const openFlyout = window.openFlyout

  if (!desktopBridge?.system?.getSystemStatus) return
  try {
    const status = await desktopBridge.system.getSystemStatus(activeBaseUrl, apiKey)

    // Scheduler heartbeat
    const schedBeat = status.heartbeat?.schedulerLastBeatAt || 0
    const schedAge = schedBeat ? _formatAgeMs(schedBeat) : "—"
    const schedOk = schedBeat && Date.now() - schedBeat < 60000
    if (hbSchedulerBeatEl) {
      hbSchedulerBeatEl.textContent = schedAge
      hbSchedulerBeatEl.className = `module-status ${schedOk ? "status-ok" : "status-warn"}`
      hbSchedulerBeatEl.textContent += schedOk ? " 正常" : " 超时"
    }

    // Task SSE heartbeat
    const sseBeat = status.heartbeat?.taskSseLastBeatAt || 0
    const sseAge = sseBeat ? _formatAgeMs(sseBeat) : "—"
    const sseOk = sseBeat && Date.now() - sseBeat < 60000
    if (hbTaskSseBeatEl) {
      hbTaskSseBeatEl.textContent = sseAge
      hbTaskSseBeatEl.className = `module-status ${sseOk ? "status-ok" : "status-warn"}`
      hbTaskSseBeatEl.textContent += sseOk ? " 正常" : " 超时"
    }

    // Uptime
    if (hbUptimeEl) hbUptimeEl.textContent = formatUptime(status.uptime)

    // DB status
    if (hbDbStatusEl) {
      const dbOk = status.db === "connected"
      hbDbStatusEl.className = `module-status ${dbOk ? "status-ok" : "status-warn"}`
      hbDbStatusEl.textContent = status.db || "—"
    }

    // Active sessions
    if (hbActiveSessionsEl) hbActiveSessionsEl.textContent = String(status.activeSessions ?? "—")

    // Version
    if (hbVersionEl) hbVersionEl.textContent = status.version || "—"

    // Overall status
    const overallOk = schedOk && sseOk && status.db === "connected"
    if (hbOverallStatusEl) {
      hbOverallStatusEl.textContent = `系统心跳：${overallOk ? "正常" : "异常"}`
    }

    // Timeline
    const entry = {
      ts: Date.now(),
      schedOk,
      sseOk,
      dbOk: status.db === "connected",
      label: overallOk ? "全部正常" : `${!schedOk ? "调度器超时 " : ""}${!sseOk ? "SSE超时 " : ""}${status.db !== "connected" ? "数据库异常" : ""}`.trim(),
    }
    heartbeatHistory.unshift(entry)
    if (heartbeatHistory.length > MAX_HEARTBEAT_HISTORY) heartbeatHistory.pop()
    renderHeartbeatTimeline()

    // P2-A: Heartbeat alert — warn when scheduler stale or heartbeat timeout
    if (!overallOk && Date.now() - lastHeartbeatAlertTs > 30000) {
      lastHeartbeatAlertTs = Date.now()
      const alertParts = []
      if (!schedOk) alertParts.push("调度器心跳超时")
      if (!sseOk) alertParts.push("SSE 心跳超时")
      if (status.db !== "connected") alertParts.push("数据库异常")
      _toast("warn", `${alertParts.join("、")}，请检查后端服务`, () => {
        if (heartbeatViewEl && typeof openFlyout === "function") {
          openFlyout(heartbeatViewEl)
          refreshHeartbeatPanel()
          if (window.heartbeatPanelTimer) clearInterval(window.heartbeatPanelTimer)
          window.heartbeatPanelTimer = setInterval(refreshHeartbeatPanel, 5000)
        }
      })
    }

  } catch {
    if (hbOverallStatusEl) hbOverallStatusEl.textContent = "系统心跳：不可用"
    heartbeatHistory.unshift({
      ts: Date.now(),
      schedOk: false,
      sseOk: false,
      dbOk: false,
      label: "获取状态失败",
    })
    if (heartbeatHistory.length > MAX_HEARTBEAT_HISTORY) heartbeatHistory.pop()
    renderHeartbeatTimeline()
  }
}

function renderHeartbeatTimeline() {
  if (!hbTimelineEl) return
  hbTimelineEl.innerHTML = heartbeatHistory.map((h) => {
    const ok = h.schedOk && h.sseOk && h.dbOk
    const dotClass = ok ? "is-ok" : (!h.schedOk && !h.sseOk ? "is-down" : "is-warn")
    const timeStr = new Date(h.ts).toLocaleTimeString("zh-CN", { hour12: false })
    return `
      <div class="heartbeat-timeline-entry">
        <span class="heartbeat-timeline-dot ${dotClass}"></span>
        <span class="heartbeat-timeline-label">${_esc(h.label)}</span>
        <span class="heartbeat-timeline-time">${timeStr}</span>
      </div>
    `
  }).join("")
}

// ── Event bindings ─────────────────────────────────────────────────────────

closeHeartbeatFlyoutEl?.addEventListener("click", () => {
  if (typeof window.closeAllFlyouts === "function") window.closeAllFlyouts()
})

heartbeatModuleCardEl?.addEventListener("click", () => {
  if (typeof window.openFlyout === "function") window.openFlyout(heartbeatViewEl)
  refreshHeartbeatPanel()
  if (window.heartbeatPanelTimer) clearInterval(window.heartbeatPanelTimer)
  window.heartbeatPanelTimer = setInterval(refreshHeartbeatPanel, 5000)
})

// Expose to window for other scripts
Object.assign(window, { refreshHeartbeatPanel })
