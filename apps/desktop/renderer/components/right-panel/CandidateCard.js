/**
 * @param {"pending"|"accepted"|"frozen"} status
 */
function statusLabel(status) {
  if (status === "accepted") return "已采纳"
  if (status === "frozen") return "冻结"
  return "待确认"
}

/**
 * @param {{id:string,status:"pending"|"accepted"|"frozen",source:string,title:string,summary:string}} item
 */
export function renderCandidateCard(item) {
  const statusClass = `is-${item.status}`
  return `
    <article class="rp-candidate-card ${statusClass}" data-candidate-id="${item.id}">
      <div class="rp-candidate-meta">
        <span class="rp-status-chip ${statusClass}">${statusLabel(item.status)}</span>
        <span class="rp-source-text">${item.source}</span>
      </div>
      <h4>${item.title}</h4>
      <p>${item.summary}</p>
      <div class="rp-actions">
        <button class="rp-action-btn" data-rp-action="adopt" type="button">采纳</button>
        <button class="rp-action-btn" data-rp-action="edit" type="button">编辑</button>
        <button class="rp-action-btn" data-rp-action="stash" type="button">暂存</button>
      </div>
    </article>
  `
}

