import { renderCandidateCard } from "./CandidateCard.js"

/**
 * @param {{items: Array<{id:string,status:"pending"|"accepted"|"frozen",source:string,title:string,summary:string}>}} props
 */
export function renderStreamList(props) {
  const items = props.items || []
  if (items.length === 0) {
    return `
      <section class="rp-stream-list">
        <div class="rp-empty-state">暂无候选内容，记录点什么吧。</div>
      </section>
    `
  }

  return `
    <section class="rp-stream-list">
      ${items.map((item) => renderCandidateCard(item)).join("")}
    </section>
  `
}

