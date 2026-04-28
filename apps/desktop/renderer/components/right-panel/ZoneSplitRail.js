/**
 * 候选区与冻结区共用的单条滚动进度轨道（当前展开区驱动填充比例）。
 * @param {"stream"|"frozen"} active
 */
export function renderZoneSplitRail(active) {
  return `
    <div class="rp-zone-split-rail" data-active="${active}" aria-hidden="true">
      <div class="rp-zone-split-bar" title="当前展开区阅读进度">
        <span class="rp-zone-split-fill"></span>
      </div>
    </div>
  `
}
