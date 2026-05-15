import type { RunFinalStatus } from '@theworld/shared-contracts'

export interface MetricsStore {
  llmRequests: Map<string, number>
  llmLatencyMs: Map<string, number>
  toolCalls: Map<string, number>
  agentRuns: Map<RunFinalStatus, number>
}

export function createMetricsStore(): MetricsStore {
  return {
    llmRequests: new Map(),
    llmLatencyMs: new Map(),
    toolCalls: new Map(),
    agentRuns: new Map(),
  }
}

function inc(map: Map<string, number>, key: string, delta: number): void {
  map.set(key, (map.get(key) ?? 0) + delta)
}

export const metricsHelpers = {
  recordLlmRequest(store: MetricsStore, provider: string, durationMs: number): void {
    inc(store.llmRequests, provider, 1)
    inc(store.llmLatencyMs, provider, durationMs)
  },

  recordToolCall(store: MetricsStore, toolName: string): void {
    inc(store.toolCalls, toolName, 1)
  },

  recordAgentRun(store: MetricsStore, status: RunFinalStatus): void {
    const n = store.agentRuns.get(status) ?? 0
    store.agentRuns.set(status, n + 1)
  },
}

export function formatPrometheusText(store: MetricsStore): string {
  const lines: string[] = []

  lines.push('# HELP theworld_llm_request_total LLM request count by provider')
  lines.push('# TYPE theworld_llm_request_total counter')
  for (const [provider, v] of store.llmRequests) {
    lines.push(`theworld_llm_request_total{provider="${escapeLabel(provider)}"} ${v}`)
  }

  lines.push('# HELP theworld_llm_latency_ms_sum LLM request total latency (ms)')
  lines.push('# TYPE theworld_llm_latency_ms_sum counter')
  for (const [provider, v] of store.llmLatencyMs) {
    lines.push(`theworld_llm_latency_ms_sum{provider="${escapeLabel(provider)}"} ${v}`)
  }

  lines.push('# HELP theworld_tool_call_total Tool call count by tool name')
  lines.push('# TYPE theworld_tool_call_total counter')
  for (const [tool, v] of store.toolCalls) {
    lines.push(`theworld_tool_call_total{tool="${escapeLabel(tool)}"} ${v}`)
  }

  lines.push('# HELP theworld_agent_run_total Agent run count by status')
  lines.push('# TYPE theworld_agent_run_total counter')
  for (const [status, v] of store.agentRuns) {
    lines.push(`theworld_agent_run_total{status="${escapeLabel(status)}"} ${v}`)
  }

  return lines.join('\n') + '\n'
}

function escapeLabel(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
