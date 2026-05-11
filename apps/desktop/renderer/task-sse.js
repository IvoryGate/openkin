/**
 * task-sse.js — Task SSE (Server-Sent Events) subscription
 *
 * Extracted from app.js to reduce file size.
 * This is a plain script (not module), loaded after cron-panel.js via index.html.
 * Dependencies accessed via window:
 *   - desktopBridge, activeBaseUrl, apiKey
 *   - showToast (from toast-system.js)
 *   - openFlyout, closeAllFlyouts, refreshCronSchedulerStatus, loadAndRenderCronTasks (from cron-panel.js)
 */

let taskEventSource = null

function apiPathTaskEvents() {
  return "/v1/tasks/events"
}

function _toast(type, message, onClick) {
  if (typeof window.showToast === "function") return window.showToast(type, message, onClick)
}

function subscribeTaskEvents() {
  const activeBaseUrl = window.activeBaseUrl
  const apiKey = window.apiKey
  if (taskEventSource) return // Already subscribed
  const base = (activeBaseUrl || "").replace(/\/+$/, "")
  if (!base) return

  if (typeof AbortController !== "undefined") {
    startFetchBasedTaskSSE(base, apiKey)
  }
}

async function startFetchBasedTaskSSE(base, key) {
  if (taskEventSource) return
  const controller = new AbortController()
  taskEventSource = controller

  const headers = {}
  if (key) headers["Authorization"] = `Bearer ${key}`

  try {
    const res = await fetch(`${base}${apiPathTaskEvents()}`, {
      method: "GET",
      headers: { ...headers, Accept: "text/event-stream" },
      signal: controller.signal,
    })
    if (!res.ok) {
      taskEventSource = null
      return
    }

    const body = res.body
    if (!body || typeof body.getReader !== "function") {
      taskEventSource = null
      return
    }

    const reader = body.getReader()
    const decoder = new TextDecoder()
    let carry = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      carry += decoder.decode(value, { stream: true })
      const lines = carry.split("\n")
      carry = lines.pop() ?? ""

      let eventType = ""
      let dataLine = ""

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7).trim()
        } else if (line.startsWith("data: ")) {
          dataLine = line.slice(6)
        } else if (line === "" && dataLine) {
          try {
            const parsed = JSON.parse(dataLine)
            handleTaskSSEEvent(parsed)
          } catch {
            // ignore malformed
          }
          dataLine = ""
          eventType = ""
        }
      }
    }
  } catch (e) {
    if (e?.name !== "AbortError") {
      // Connection lost, retry after 10s
      taskEventSource = null
      setTimeout(() => subscribeTaskEvents(), 10000)
    }
  }
}

function handleTaskSSEEvent(envelope) {
  const cronViewEl = document.getElementById("cron-view")
  const openFlyout = window.openFlyout
  const refreshCronSchedulerStatus = window.refreshCronSchedulerStatus
  const loadAndRenderCronTasks = window.loadAndRenderCronTasks

  // Parse EventPlaneEnvelopeV1 format: { v, domain, kind, payload, ts }
  if (envelope?.domain === "task" && envelope?.kind === "task_run_finished" && envelope?.payload) {
    const evt = envelope.payload
    if (evt.status === "completed") {
      _toast("success", `定时任务「${evt.taskName || evt.taskId}」执行完成`, () => {
        // Click toast → open cron flyout
        if (cronViewEl && typeof openFlyout === "function") {
          openFlyout(cronViewEl)
          if (typeof refreshCronSchedulerStatus === "function") refreshCronSchedulerStatus()
          if (typeof loadAndRenderCronTasks === "function") loadAndRenderCronTasks()
        }
      })
    } else if (evt.status === "failed") {
      const errMsg = evt.error ? `：${evt.error.slice(0, 80)}` : ""
      _toast("error", `定时任务「${evt.taskName || evt.taskId}」执行失败${errMsg}`, () => {
        if (cronViewEl && typeof openFlyout === "function") {
          openFlyout(cronViewEl)
          if (typeof refreshCronSchedulerStatus === "function") refreshCronSchedulerStatus()
          if (typeof loadAndRenderCronTasks === "function") loadAndRenderCronTasks()
        }
      })
    }
    // Also refresh the cron task list if flyout is open
    if (cronViewEl && !cronViewEl.classList.contains("is-hidden")) {
      if (typeof loadAndRenderCronTasks === "function") loadAndRenderCronTasks()
    }
  }
}

function unsubscribeTaskEvents() {
  if (taskEventSource) {
    taskEventSource.abort()
    taskEventSource = null
  }
}

// Auto-subscribe after a short delay (matches original app.js behavior)
setTimeout(() => subscribeTaskEvents(), 3000)

// Expose to window for other scripts
Object.assign(window, { subscribeTaskEvents, unsubscribeTaskEvents })
