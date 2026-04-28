const FILTERS = [
  { value: "all", label: "全部" },
  { value: "pending", label: "待确认" },
  { value: "accepted", label: "已采纳" },
]

/**
 * @param {{filter: "all"|"pending"|"accepted"}} props
 */
export function renderRightPanelHeader(props) {
  const filter = props.filter || "all"
  const tabs = FILTERS.map((item) => {
    const activeClass = item.value === filter ? "is-active" : ""
    const ariaSelected = item.value === filter ? "true" : "false"
    return `<button class="rp-segment-btn ${activeClass}" data-rp-filter="${item.value}" type="button" role="tab" aria-selected="${ariaSelected}">${item.label}</button>`
  }).join("")

  return `
    <header class="rp-header">
      <div class="rp-header-main">
        <h3>思绪流 / 候选池</h3>
        <p>捕捉输入并转为可筛选候选卡片</p>
      </div>
      <div class="rp-segmented" role="tablist" aria-label="候选状态筛选">
        ${tabs}
      </div>
    </header>
  `
}

