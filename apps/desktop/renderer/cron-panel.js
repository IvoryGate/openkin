/**
 * cron-panel.js — Cron / Task Scheduler panel
 *
 * Extracted from app.js to reduce file size.
 * This is a plain script (not module), loaded after app.js via index.html.
 * Dependencies accessed via window:
 *   - desktopBridge, activeBaseUrl, apiKey
 *   - showToast, escapeHtml, svgIcon
 *   - sessions, switchSession, renderSessions (from app.js)
 */

const cronViewEl = document.getElementById("cron-view")
const flyoutOverlayEl = document.getElementById("flyout-overlay")
const cronTaskListEl = document.getElementById("cron-task-list")
const createCronTaskBtnEl = document.getElementById("create-cron-task-btn")
const closeCronFlyoutEl = document.getElementById("close-cron-flyout")
const cronTaskDetailPanelEl = document.getElementById("cron-task-detail-panel")
const cronTaskDetailTitleEl = document.getElementById("cron-task-detail-title")
const cronTaskDetailRunsEl = document.getElementById("cron-task-detail-runs")
const cronSchedActiveEl = document.getElementById("cron-sched-active")
const cronSchedLastTickEl = document.getElementById("cron-sched-last-tick")
const cronSchedIntervalEl = document.getElementById("cron-sched-interval")
const cronSchedRunningEl = document.getElementById("cron-sched-running")
const cronSchedMaxConcurrentEl = document.getElementById("cron-sched-max-concurrent")
const cronSchedulerStatusEl = document.getElementById("cron-scheduler-status")
const cronModuleCardEl = document.getElementById("cron-module-card")

let heartbeatPanelTimer = null

function _esc(raw) {
  if (typeof window.escapeHtml === "function") return window.escapeHtml(raw)
  return String(raw)
}

function _svg(name) {
  if (typeof window.svgIcon === "function") return window.svgIcon(name)
  return ""
}

function _toast(type, message, onClick) {
  if (typeof window.showToast === "function") return window.showToast(type, message, onClick)
}

function _formatAgeMs(ts) {
  if (!ts) return "未知"
  const diff = Math.max(0, Date.now() - ts)
  const s = Math.round(diff / 1000)
  if (s < 60) return `${s}s 前`
  const m = Math.round(s / 60)
  return `${m}m 前`
}

function closeAllFlyouts() {
  const heartbeatViewEl = document.getElementById("heartbeat-view")
  if (cronViewEl) { cronViewEl.classList.add("is-hidden"); cronViewEl.setAttribute("aria-hidden", "true") }
  if (heartbeatViewEl) { heartbeatViewEl.classList.add("is-hidden"); heartbeatViewEl.setAttribute("aria-hidden", "true") }
  if (flyoutOverlayEl) { flyoutOverlayEl.classList.add("is-hidden") }
  if (heartbeatPanelTimer) { clearInterval(heartbeatPanelTimer); heartbeatPanelTimer = null }
}

function openFlyout(viewEl) {
  closeAllFlyouts()
  if (flyoutOverlayEl) flyoutOverlayEl.classList.remove("is-hidden")
  if (viewEl) {
    viewEl.classList.remove("is-hidden")
    viewEl.removeAttribute("aria-hidden")
  }
}

async function refreshCronSchedulerStatus() {
  const desktopBridge = window.desktopBridge
  const activeBaseUrl = window.activeBaseUrl
  const apiKey = window.apiKey
  if (!desktopBridge?.system?.getSystemStatus) return
  try {
    const status = await desktopBridge.system.getSystemStatus(activeBaseUrl, apiKey)
    const sched = status.taskScheduler
    if (cronSchedActiveEl) {
      const ok = sched?.active && !sched?.stale
      cronSchedActiveEl.className = `module-status ${ok ? "status-ok" : "status-warn"}`
      cronSchedActiveEl.textContent = sched?.active ? (sched?.stale ? "stale" : "active") : "inactive"
    }
    if (cronSchedLastTickEl) cronSchedLastTickEl.textContent = sched?.lastTickAt ? _formatAgeMs(sched.lastTickAt) : "—"
    if (cronSchedIntervalEl) cronSchedIntervalEl.textContent = sched?.tickIntervalMs ? `${Math.round(sched.tickIntervalMs / 1000)}s` : "—"
    if (cronSchedRunningEl) cronSchedRunningEl.textContent = sched?.runningExecutions != null ? String(sched.runningExecutions) : "—"
    if (cronSchedMaxConcurrentEl) cronSchedMaxConcurrentEl.textContent = sched?.maxConcurrent != null ? String(sched.maxConcurrent) : "—"
    if (cronSchedulerStatusEl) {
      const active = sched?.active
      const stale = sched?.stale
      cronSchedulerStatusEl.textContent = `调度器状态：${active ? (stale ? "异常 (stale)" : "运行中") : "未启动"}`
    }
  } catch {
    if (cronSchedActiveEl) {
      cronSchedActiveEl.className = "module-status status-warn"
      cronSchedActiveEl.textContent = "offline"
    }
    if (cronSchedulerStatusEl) cronSchedulerStatusEl.textContent = "调度器状态：不可用"
  }
}

async function loadAndRenderCronTasks() {
  if (!cronTaskListEl) return
  const desktopBridge = window.desktopBridge
  const activeBaseUrl = window.activeBaseUrl
  const apiKey = window.apiKey
  try {
    const tasks = await desktopBridge.task.listTasks(activeBaseUrl, apiKey)
    const allTasks = Array.isArray(tasks) ? tasks : []
    if (allTasks.length === 0) {
      cronTaskListEl.innerHTML = '<p class="settings-subtitle">暂无定时任务</p>'
      return
    }

    const triggerTypeLabel = { cron: "Cron", interval: "间隔", once: "一次性" }

    cronTaskListEl.innerHTML = allTasks.map((t) => {
      const sourceBadge = t.createdBy === "agent"
        ? `<span class="task-source-badge source-agent">${_svg("robot")} Agent</span>`
        : `<span class="task-source-badge source-user">${_svg("user")} 手动</span>`
      const triggerLabel = triggerTypeLabel[t.triggerType] || t.triggerType
      const nextRunText = t.nextRunAt ? ` · 下次：${_formatAgeMs(t.nextRunAt)}` : ""
      return `
      <div class="session-item" data-task-id="${_esc(t.id)}">
        <div class="session-main">
          <p class="session-title">${_esc(t.name || t.id)} ${sourceBadge}</p>
          <p class="session-subtitle">${triggerLabel} · ${t.enabled ? "已启用" : "已禁用"}${nextRunText}</p>
        </div>
        <div class="session-item-actions">
          <button class="ghost-btn cron-trigger-btn" data-task-id="${_esc(t.id)}" type="button">触发</button>
          <button class="ghost-btn cron-toggle-btn" data-task-id="${_esc(t.id)}" data-enabled="${t.enabled}" type="button">${t.enabled ? "禁用" : "启用"}</button>
          <button class="ghost-btn cron-history-btn" data-task-id="${_esc(t.id)}" type="button">历史</button>
          <button class="ghost-btn cron-delete-btn" data-task-id="${_esc(t.id)}" type="button" style="color:var(--color-danger,red)">删除</button>
        </div>
      </div>
    `
    }).join("")

    cronTaskListEl.querySelectorAll(".cron-trigger-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const taskId = btn.getAttribute("data-task-id")
        try {
          await desktopBridge.task.triggerTask(activeBaseUrl, taskId, apiKey)
          _toast("info", `任务 ${taskId} 已手动触发`)
          loadAndRenderCronTasks()
        } catch (e) {
          _toast("error", `触发任务失败：${e instanceof Error ? e.message : String(e)}`)
        }
      })
    })
    cronTaskListEl.querySelectorAll(".cron-toggle-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const taskId = btn.getAttribute("data-task-id")
        const enabled = btn.getAttribute("data-enabled") === "true"
        try {
          if (enabled) {
            await desktopBridge.task.disableTask(activeBaseUrl, taskId, apiKey)
          } else {
            await desktopBridge.task.enableTask(activeBaseUrl, taskId, apiKey)
          }
          loadAndRenderCronTasks()
        } catch (e) {
          _toast("error", `操作失败：${e instanceof Error ? e.message : String(e)}`)
        }
      })
    })
    cronTaskListEl.querySelectorAll(".cron-history-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const taskId = btn.getAttribute("data-task-id")
        try {
          const runs = await desktopBridge.task.listTaskRuns(activeBaseUrl, taskId, apiKey)
          if (cronTaskDetailPanelEl) cronTaskDetailPanelEl.classList.remove("is-hidden")
          if (cronTaskDetailTitleEl) cronTaskDetailTitleEl.textContent = `任务运行历史`
          if (cronTaskDetailRunsEl) {
            if (!Array.isArray(runs) || runs.length === 0) {
              cronTaskDetailRunsEl.innerHTML = '<p class="settings-subtitle">暂无运行记录</p>'
            } else {
              cronTaskDetailRunsEl.innerHTML = runs.map((r) => {
                const statusClass = r.status === "completed" ? "is-completed" : r.status === "failed" ? "is-failed" : "is-running"
                const statusLabel = r.status === "completed" ? "完成" : r.status === "failed" ? "失败" : "运行中"
                const timeLabel = r.startedAt ? _formatAgeMs(r.startedAt) : "—"
                const viewDetailBtn = (r.sessionId || r.traceId)
                  ? `<button class="ghost-btn cron-view-detail-btn" data-session-id="${_esc(r.sessionId || "")}" data-trace-id="${_esc(r.traceId || "")}" type="button">查看</button>`
                  : ""
                return `
                  <div class="task-run-item">
                    <span class="task-run-status ${statusClass}"></span>
                    <div class="task-run-main">
                      <p>${statusLabel} · ${timeLabel}${r.retryCount > 0 ? ` · 重试 #${r.retryCount}` : ""}</p>
                      <p class="session-subtitle">${_esc(r.id || "")}</p>
                    </div>
                    <div class="task-run-actions">
                      ${viewDetailBtn}
                    </div>
                  </div>
                `
              }).join("")

              // Bind view detail buttons
              cronTaskDetailRunsEl.querySelectorAll(".cron-view-detail-btn").forEach((vbtn) => {
                vbtn.addEventListener("click", () => {
                  const sid = vbtn.getAttribute("data-session-id")
                  if (sid) {
                    closeAllFlyouts()
                    if (typeof window.switchToSessionById === "function") window.switchToSessionById(sid)
                  }
                })
              })
            }
          }
        } catch (e) {
          _toast("error", `加载运行历史失败：${e instanceof Error ? e.message : String(e)}`)
        }
      })
    })
    cronTaskListEl.querySelectorAll(".cron-delete-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const taskId = btn.getAttribute("data-task-id")
        const ok = window.confirm(`确认删除定时任务 ${taskId}？`)
        if (!ok) return
        try {
          await desktopBridge.task.deleteTask(activeBaseUrl, taskId, apiKey)
          _toast("info", `任务已删除`)
          loadAndRenderCronTasks()
        } catch (e) {
          _toast("error", `删除失败：${e instanceof Error ? e.message : String(e)}`)
        }
      })
    })
  } catch (e) {
    cronTaskListEl.innerHTML = `<p class="settings-subtitle">加载定时任务失败：${e instanceof Error ? e.message : String(e)}</p>`
  }
}

async function switchToSessionById(sessionId) {
  const desktopBridge = window.desktopBridge
  const activeBaseUrl = window.activeBaseUrl
  const apiKey = window.apiKey
  if (!sessionId || !desktopBridge?.session) return
  try {
    // Delegate to app.js if available
    if (typeof window._appSwitchToSessionById === "function") {
      return window._appSwitchToSessionById(sessionId)
    }
    // Fallback: use the app-level switchSession
    if (typeof window.switchSession === "function") {
      window.switchSession(sessionId)
    }
  } catch (e) {
    _toast("error", `无法加载任务会话：${e instanceof Error ? e.message : String(e)}`)
  }
}

// ── Create Task Form Logic ──────────────────────────────────────────────────

const ctfTriggerTypeEl = document.getElementById("ctf-trigger-type")
const ctfCronFieldEl = document.getElementById("ctf-cron-field")
const ctfIntervalFieldEl = document.getElementById("ctf-interval-field")
const ctfIntervalCustomFieldEl = document.getElementById("ctf-interval-custom-field")
const ctfIntervalPresetEl = document.getElementById("ctf-interval-preset")
const ctfOnceFieldEl = document.getElementById("ctf-once-field")
const ctfErrorEl = document.getElementById("ctf-error")
const ctfNameEl = document.getElementById("ctf-name")
const ctfCronExprEl = document.getElementById("ctf-cron-expr")
const ctfIntervalSecEl = document.getElementById("ctf-interval-sec")
const ctfOnceAtEl = document.getElementById("ctf-once-at")
const ctfAgentIdEl = document.getElementById("ctf-agent-id")
const ctfInputTextEl = document.getElementById("ctf-input-text")
const ctfWebhookUrlEl = document.getElementById("ctf-webhook-url")
const submitCreateTaskBtnEl = document.getElementById("submit-create-task-btn")
const cancelCreateTaskBtnEl = document.getElementById("cancel-create-task-btn")
const createTaskFormPanelEl = document.getElementById("create-task-form-panel")

function updateCtfTriggerFields() {
  const type = ctfTriggerTypeEl?.value || "interval"
  if (ctfCronFieldEl) ctfCronFieldEl.classList.toggle("is-hidden", type !== "cron")
  if (ctfIntervalFieldEl) ctfIntervalFieldEl.classList.toggle("is-hidden", type !== "interval")
  if (ctfIntervalCustomFieldEl) ctfIntervalCustomFieldEl.classList.add("is-hidden")
  if (ctfOnceFieldEl) ctfOnceFieldEl.classList.toggle("is-hidden", type !== "once")
}

ctfIntervalPresetEl?.addEventListener("change", () => {
  const val = ctfIntervalPresetEl?.value
  if (ctfIntervalCustomFieldEl) ctfIntervalCustomFieldEl.classList.toggle("is-hidden", val !== "custom")
  if (val !== "custom" && ctfIntervalSecEl) ctfIntervalSecEl.value = val
})

ctfTriggerTypeEl?.addEventListener("change", updateCtfTriggerFields)
updateCtfTriggerFields()

cancelCreateTaskBtnEl?.addEventListener("click", () => {
  if (createTaskFormPanelEl) createTaskFormPanelEl.classList.add("is-hidden")
  if (ctfErrorEl) ctfErrorEl.textContent = ""
})

submitCreateTaskBtnEl?.addEventListener("click", async () => {
  if (ctfErrorEl) ctfErrorEl.textContent = ""

  const desktopBridge = window.desktopBridge
  const activeBaseUrl = window.activeBaseUrl
  const apiKey = window.apiKey

  const name = ctfNameEl?.value?.trim() || ""
  const triggerType = ctfTriggerTypeEl?.value || "cron"
  const agentId = ctfAgentIdEl?.value || "default"
  const inputText = ctfInputTextEl?.value?.trim() || ""
  const webhookUrl = ctfWebhookUrlEl?.value?.trim() || ""

  // Validate
  if (!name) { if (ctfErrorEl) ctfErrorEl.textContent = "请输入任务名称"; return }
  if (!inputText) { if (ctfErrorEl) ctfErrorEl.textContent = "请输入任务指令"; return }

  let triggerConfig = {}
  if (triggerType === "cron") {
    const expr = ctfCronExprEl?.value?.trim() || ""
    if (!expr) { if (ctfErrorEl) ctfErrorEl.textContent = "请输入 Cron 表达式"; return }
    triggerConfig = { cron: expr }
  } else if (triggerType === "interval") {
    const presetVal = ctfIntervalPresetEl?.value
    let sec
    if (presetVal === "custom") {
      sec = Number(ctfIntervalSecEl?.value)
    } else {
      sec = Number(presetVal)
    }
    if (!sec || sec < 1) { if (ctfErrorEl) ctfErrorEl.textContent = "间隔秒数须 ≥ 1"; return }
    triggerConfig = { interval_seconds: sec }
  } else if (triggerType === "once") {
    const onceAtRaw = ctfOnceAtEl?.value
    if (!onceAtRaw) { if (ctfErrorEl) ctfErrorEl.textContent = "请选择执行时间"; return }
    triggerConfig = { once_at: new Date(onceAtRaw).getTime() }
  }

  const payload = {
    name,
    triggerType,
    triggerConfig,
    agentId,
    input: { text: inputText },
    enabled: true,
    createdBy: "user",
  }
  if (webhookUrl) payload.webhookUrl = webhookUrl

  try {
    await desktopBridge.task.createTask(activeBaseUrl, payload, apiKey)
    if (createTaskFormPanelEl) createTaskFormPanelEl.classList.add("is-hidden")
    // Reset form
    if (ctfNameEl) ctfNameEl.value = ""
    if (ctfInputTextEl) ctfInputTextEl.value = ""
    if (ctfCronExprEl) ctfCronExprEl.value = ""
    if (ctfWebhookUrlEl) ctfWebhookUrlEl.value = ""
    loadAndRenderCronTasks()
    _toast("success", `任务「${name}」创建成功`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (ctfErrorEl) ctfErrorEl.textContent = `创建失败：${msg}`
  }
})

// ── Event bindings ─────────────────────────────────────────────────────────

createCronTaskBtnEl?.addEventListener("click", async () => {
  const desktopBridge = window.desktopBridge
  const activeBaseUrl = window.activeBaseUrl
  const apiKey = window.apiKey
  const formPanel = document.getElementById("create-task-form-panel")
  if (formPanel) {
    formPanel.classList.remove("is-hidden")
    try {
      const agents = await desktopBridge.agent.listAgents(activeBaseUrl, apiKey)
      const agentSelect = document.getElementById("ctf-agent-id")
      if (agentSelect && Array.isArray(agents)) {
        agentSelect.innerHTML = agents
          .map((a) => `<option value="${_esc(a.id)}" ${a.id === "default" ? "selected" : ""}>${_esc(a.name || a.id)}</option>`)
          .join("")
        if (!agents.some((a) => a.id === "default") && agents.length > 0) {
          agentSelect.value = agents[0].id
        }
      }
    } catch {
      // Keep default agent option
    }
  }
})

closeCronFlyoutEl?.addEventListener("click", () => {
  closeAllFlyouts()
})

flyoutOverlayEl?.addEventListener("click", () => {
  closeAllFlyouts()
})

cronModuleCardEl?.addEventListener("click", () => {
  openFlyout(cronViewEl)
  refreshCronSchedulerStatus()
  loadAndRenderCronTasks()
})

// Expose to window for other scripts (task-sse.js, heartbeat-panel.js)
Object.assign(window, {
  closeAllFlyouts,
  openFlyout,
  refreshCronSchedulerStatus,
  loadAndRenderCronTasks,
  switchToSessionById,
  // Allow heartbeat-panel.js to share the timer reference
  get heartbeatPanelTimer() { return heartbeatPanelTimer },
  set heartbeatPanelTimer(v) { heartbeatPanelTimer = v },
})
