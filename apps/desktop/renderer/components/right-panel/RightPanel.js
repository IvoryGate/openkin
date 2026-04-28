import { renderRightPanelHeader } from "./RightPanelHeader.js"
import { renderCaptureBox } from "./CaptureBox.js"
import { renderStreamList } from "./StreamList.js"
import { renderFrozenSection } from "./FrozenSection.js"
import { renderFooterSummary } from "./FooterSummary.js"
import { renderZoneSplitRail } from "./ZoneSplitRail.js"

/**
 * @typedef {{id:string,status:"pending"|"accepted"|"frozen",source:string,title:string,summary:string}} CandidateItem
 */

/**
 * @param {HTMLElement | null} root
 * @param {{
 *  getActiveSessionId?: () => string,
 *  loadSessionMessages?: (sessionId:string) => Promise<Array<{id:string,role:"user"|"assistant"|"tool"|"system",content:string,createdAt:number}>>,
 *  saveCapture?: (sessionId:string, text:string) => Promise<void>,
 *  recordAction?: (sessionId:string, item:CandidateItem, action:"adopt"|"edit"|"stash") => Promise<void>,
 *  getHeartbeatText?: () => string,
 * }} [options]
 */
export function mountRightPanel(root, options = {}) {
  if (!root) return

  /** @type {{filter:"all"|"pending"|"accepted",draft:string,activeSection:"stream"|"frozen",items:CandidateItem[],heartbeatAt:string,lastSessionId:string}} */
  const state = {
    filter: "all",
    draft: "",
    activeSection: "stream",
    items: [],
    heartbeatAt: options.getHeartbeatText?.() || "未知",
    lastSessionId: "",
  }
  const maxLength = 240

  /**
   * @param {Array<{id:string,role:"user"|"assistant"|"tool"|"system",content:string,createdAt:number}>} messages
   * @returns {CandidateItem[]}
   */
  function mapMessagesToCandidates(messages) {
    function parseProcessedCandidate(msg) {
      const text = (msg.content || "").trim()
      if (!text) return null
      if (msg.role === "user") return null
      if (text.startsWith("右栏动作：")) return null
      const markers = ["候选结果：", "整理结果：", "右栏结果："]
      const marker = markers.find((m) => text.startsWith(m))
      if (!marker) return null
      const body = text.slice(marker.length).trim() || text
      return {
        id: `cand-${msg.id}`,
        status: "pending",
        source: "Heartbeat",
        title: body.slice(0, 24) || "空白内容",
        summary: body,
      }
    }

    return (messages || [])
      .filter((msg) => (msg.content || "").trim())
      .slice(-24)
      .reverse()
      .map((msg) => parseProcessedCandidate(msg))
      .filter(Boolean)
  }

  function getFilteredItems() {
    const flowing = state.items.filter((item) => item.status !== "frozen")
    if (state.filter === "all") return flowing
    return flowing.filter((item) => item.status === state.filter)
  }

  async function createDraftCandidate() {
    const text = state.draft.trim()
    if (!text) return
    const sessionId = options.getActiveSessionId?.() || ""
    if (sessionId && options.saveCapture) {
      try {
        await options.saveCapture(sessionId, text)
        state.heartbeatAt = "等待 heartbeat"
      } catch (_error) {
        // Keep draft clear even when persistence fails; panel remains result-driven.
      }
    }
    state.draft = ""
  }

  /**
   * @param {CandidateItem} item
   * @param {"adopt"|"edit"|"stash"} action
   */
  async function applyAction(item, action) {
    if (!item) return
    if (action === "adopt") item.status = "accepted"
    if (action === "stash") item.status = "frozen"
    if (action === "edit") {
      const edited = window.prompt("编辑候选内容", item.summary)
      if (typeof edited === "string" && edited.trim()) {
        item.summary = edited.trim()
        item.title = edited.trim().slice(0, 24)
      }
    }
    const sessionId = options.getActiveSessionId?.() || ""
    if (sessionId && options.recordAction) {
      try {
        await options.recordAction(sessionId, item, action)
      } catch (_error) {
        // Keep UI responsive and avoid blocking action on logging failure.
      }
    }
  }

  async function refreshFromSession() {
    const sessionId = options.getActiveSessionId?.() || ""
    if (!sessionId || !options.loadSessionMessages) return
    try {
      const messages = await options.loadSessionMessages(sessionId)
      state.items = mapMessagesToCandidates(messages)
      state.lastSessionId = sessionId
      state.heartbeatAt = options.getHeartbeatText?.() || "刚刚"
    } catch (_error) {
      if (!state.items.length) {
        state.items = []
      }
    }
    render()
  }

  function bind() {
    root.querySelectorAll("[data-rp-filter]").forEach((node) => {
      node.addEventListener("click", () => {
        const next = node.getAttribute("data-rp-filter")
        if (next === "all" || next === "pending" || next === "accepted") {
          state.filter = next
          render()
        }
      })
    })

    const input = root.querySelector("#rp-capture-input")
    input?.addEventListener("input", () => {
      state.draft = input.value.slice(0, maxLength)
      const sendBtn = root.querySelector("#rp-capture-send")
      if (sendBtn) {
        sendBtn.toggleAttribute("disabled", state.draft.trim().length === 0)
      }
      const counter = root.querySelector(".rp-char-count")
      if (counter) {
        counter.textContent = `${state.draft.length}/${maxLength}`
      }
    })

    root.querySelector("#rp-capture-send")?.addEventListener("click", async () => {
      await createDraftCandidate()
      await refreshFromSession()
    })

    root.querySelector("#rp-stream-toggle")?.addEventListener("click", () => {
      state.activeSection = state.activeSection === "stream" ? "frozen" : "stream"
      render()
    })

    root.querySelector("#rp-frozen-toggle")?.addEventListener("click", () => {
      state.activeSection = state.activeSection === "frozen" ? "stream" : "frozen"
      render()
    })

    root.querySelectorAll(".rp-action-btn").forEach((node) => {
      node.addEventListener("click", async () => {
        const action = node.getAttribute("data-rp-action")
        if (action !== "adopt" && action !== "edit" && action !== "stash") return
        const article = node.closest("[data-candidate-id]")
        const candidateId = article?.getAttribute("data-candidate-id")
        const item = state.items.find((v) => v.id === candidateId)
        if (!item) return
        await applyAction(item, action)
        render()
      })
    })

    bindZoneSplitRail()
  }

  function scrollRatio(el) {
    if (!el) return 0
    const max = el.scrollHeight - el.clientHeight
    if (max <= 0) return 0
    return Math.min(1, Math.max(0, el.scrollTop / max))
  }

  function bindZoneSplitRail() {
    const rail = root.querySelector(".rp-zone-split-rail")
    if (!rail || !root) return

    rail.dataset.active = state.activeSection

    function updateRail() {
      const pane =
        state.activeSection === "stream"
          ? root.querySelector('[data-rp-scroll-pane="stream"]')
          : root.querySelector('[data-rp-scroll-pane="frozen"]')
      const ratio = scrollRatio(pane)
      rail.style.setProperty("--rp-scroll-fill", String(ratio))
    }

    const streamPane = root.querySelector('[data-rp-scroll-pane="stream"]')
    const frozenPane = root.querySelector('[data-rp-scroll-pane="frozen"]')
    const onScroll = () => updateRail()

    streamPane?.addEventListener("scroll", onScroll, { passive: true })
    frozenPane?.addEventListener("scroll", onScroll, { passive: true })

    let roStream
    let roFrozen
    if (typeof ResizeObserver !== "undefined") {
      roStream = new ResizeObserver(updateRail)
      roFrozen = new ResizeObserver(updateRail)
      if (streamPane) roStream.observe(streamPane)
      if (frozenPane) roFrozen.observe(frozenPane)
    }

    window.requestAnimationFrame(() => updateRail())
  }

  function render() {
    const items = getFilteredItems()
    const frozenItems = state.items.filter((item) => item.status === "frozen")
    const pendingCount = state.items.filter((item) => item.status === "pending").length
    const acceptedCount = state.items.filter((item) => item.status === "accepted").length

    root.innerHTML = `
      <section class="right-panel-shell">
        ${renderRightPanelHeader({ filter: state.filter })}
        ${renderCaptureBox({ draft: state.draft, maxLength })}
        <section class="rp-accordion-shell">
          ${renderStreamList({ items, open: state.activeSection === "stream" })}
          ${renderZoneSplitRail(state.activeSection)}
          ${renderFrozenSection({ items: frozenItems, open: state.activeSection === "frozen" })}
        </section>
        ${renderFooterSummary({ pendingCount, acceptedCount, heartbeatAt: state.heartbeatAt })}
      </section>
    `
    bind()
  }

  render()

  void refreshFromSession()
  return {
    refresh: refreshFromSession,
  }
}

