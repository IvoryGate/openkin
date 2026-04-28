import { renderCandidateCard } from "./CandidateCard.js"

/**
 * @param {{items:Array<{id:string,status:"pending"|"accepted"|"frozen",source:string,title:string,summary:string}>,open:boolean}} props
 */
export function renderFrozenSection(props) {
  const open = Boolean(props.open)
  const items = props.items || []
  const bodyClass = open ? "is-open" : ""
  const caret = open ? "收起" : "展开"

  return `
    <section class="rp-accordion-section rp-frozen ${open ? "is-open" : ""}">
      <button id="rp-frozen-toggle" class="rp-accordion-head rp-frozen-head" type="button" aria-expanded="${open ? "true" : "false"}">
        <span>冻结区（长期未处理）</span>
        <span class="rp-frozen-caret">${caret}</span>
      </button>
      <div class="rp-accordion-body rp-frozen-body ${bodyClass}">
        ${items.length ? items.map((item) => renderCandidateCard(item)).join("") : '<div class="rp-empty-state">暂无冻结候选。</div>'}
      </div>
    </section>
  `
}

