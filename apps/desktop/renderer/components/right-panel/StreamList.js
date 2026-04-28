import { renderCandidateCard } from "./CandidateCard.js"

/**
 * @param {{items: Array<{id:string,status:"pending"|"accepted"|"frozen",source:string,title:string,summary:string}>, open:boolean}} props
 */
export function renderStreamList(props) {
  const items = props.items || []
  const open = Boolean(props.open)
  const bodyClass = open ? "is-open" : ""
  const caret = open ? "收起" : "展开"
  const bodyContent = items.length
    ? items.map((item) => renderCandidateCard(item)).join("")
    : '<div class="rp-empty-state">暂无候选内容，记录点什么吧。</div>'

  return `
    <section class="rp-accordion-section rp-stream ${open ? "is-open" : ""}">
      <button id="rp-stream-toggle" class="rp-accordion-head" type="button" aria-expanded="${open ? "true" : "false"}">
        <span>候选区（实时）</span>
        <span class="rp-frozen-caret">${caret}</span>
      </button>
      <div class="rp-accordion-body rp-stream-list ${bodyClass}">
        ${bodyContent}
      </div>
    </section>
  `
}

