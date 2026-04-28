/**
 * @param {{pendingCount:number,acceptedCount:number,heartbeatAt:string}} props
 */
export function renderFooterSummary(props) {
  return `
    <footer class="rp-footer-summary">
      <span>待确认 ${props.pendingCount}</span>
      <span>已采纳 ${props.acceptedCount}</span>
      <span>heartbeat ${props.heartbeatAt}</span>
    </footer>
  `
}

