/**
 * @param {{pendingCount:number,acceptedCount:number,heartbeatAt:string}} props
 */
export function renderFooterSummary(props) {
  return `
    <footer class="rp-footer-summary">待确认 ${props.pendingCount} · 已采纳 ${props.acceptedCount} · heartbeat ${props.heartbeatAt}</footer>
  `
}

