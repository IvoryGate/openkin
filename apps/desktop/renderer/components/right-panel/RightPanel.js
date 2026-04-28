import { rightPanelMockCandidates, rightPanelMockHeartbeatAt } from "./mockData.js"
import { renderRightPanelHeader } from "./RightPanelHeader.js"
import { renderCaptureBox } from "./CaptureBox.js"
import { renderStreamList } from "./StreamList.js"
import { renderFrozenSection } from "./FrozenSection.js"
import { renderFooterSummary } from "./FooterSummary.js"

/**
 * @typedef {{id:string,status:"pending"|"accepted"|"frozen",source:string,title:string,summary:string}} CandidateItem
 */

/**
 * @param {HTMLElement | null} root
 */
export function mountRightPanel(root) {
  if (!root) return

  /** @type {{filter:"all"|"pending"|"accepted",draft:string,activeSection:"stream"|"frozen",items:CandidateItem[]}} */
  const state = {
    filter: "all",
    draft: "",
    activeSection: "stream",
    items: [...rightPanelMockCandidates],
  }
  const maxLength = 240

  function getFilteredItems() {
    const flowing = state.items.filter((item) => item.status !== "frozen")
    if (state.filter === "all") return flowing
    return flowing.filter((item) => item.status === state.filter)
  }

  function createDraftCandidate() {
    const text = state.draft.trim()
    if (!text) return
    state.items.unshift({
      id: `cand-local-${Date.now()}`,
      status: "pending",
      source: "Capture",
      title: text.slice(0, 24),
      summary: text,
    })
    state.draft = ""
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

    root.querySelector("#rp-capture-send")?.addEventListener("click", () => {
      createDraftCandidate()
      render()
    })

    root.querySelector("#rp-stream-toggle")?.addEventListener("click", () => {
      state.activeSection = "stream"
      render()
    })

    root.querySelector("#rp-frozen-toggle")?.addEventListener("click", () => {
      state.activeSection = "frozen"
      render()
    })
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
          ${renderFrozenSection({ items: frozenItems, open: state.activeSection === "frozen" })}
        </section>
        ${renderFooterSummary({ pendingCount, acceptedCount, heartbeatAt: rightPanelMockHeartbeatAt })}
      </section>
    `
    bind()
  }

  render()
}

