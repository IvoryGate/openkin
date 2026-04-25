/**
 * L4 layered memory product surface (102) — taxonomy + human views from L3 context descriptors.
 * Consumes the same `GetRunContextResponseBody` as 101; does not add L3 contract fields.
 */
import type {
  ContextBlockDescriptorDto,
  ContextBuildReportDto,
  GetRunContextResponseBody,
} from '@theworld/operator-client'
import { formatContextHintOneLine } from './l4-context-view.js'

export type L4LayeredMemoryStatus = 'implemented' | 'read_only' | 'planned'

export type L4LayeredMemoryLayer = {
  id: string
  label: string
  status: L4LayeredMemoryStatus
  l3OrProductAnchor: string
}

/** Frozen in 102: product vocabulary for later 103–106 and docs. */
export const L4_LAYERED_MEMORY_TAXONOMY: L4LayeredMemoryLayer[] = [
  {
    id: 'working',
    label: 'Working memory (dialogue scratch in the prompt)',
    status: 'implemented',
    l3OrProductAnchor: 'Context blocks with layer history / recent; chat transcript window.',
  },
  {
    id: 'session',
    label: 'Session-scoped memory (this thread)',
    status: 'implemented',
    l3OrProductAnchor: 'L3 `MemoryContributionDescriptor` with sourceKind=session; session isolation by sessionId.',
  },
  {
    id: 'session_summary',
    label: 'Session summary memory (injected before compression)',
    status: 'read_only',
    l3OrProductAnchor:
      'L3 memory contributions + `memory` layer blocks when MemoryPort provides summary; no user-authored edit in 102.',
  },
  {
    id: 'workspace',
    label: 'Workspace / repo memory',
    status: 'planned',
    l3OrProductAnchor: 'sourceKind=workspace in L3; no dedicated workspace write path in 102.',
  },
  {
    id: 'persona',
    label: 'Persona / identity memory',
    status: 'planned',
    l3OrProductAnchor: 'sourceKind=persona in L3 enum; not a standalone product flow in 102.',
  },
  {
    id: 'skill',
    label: 'Skill memory (tooling surface)',
    status: 'read_only',
    l3OrProductAnchor: 'Skills are discoverable via inspect/list; not merged into 102 memory DTO as a layer.',
  },
  {
    id: 'retrieval',
    label: 'Retrieval / long-term factual memory',
    status: 'planned',
    l3OrProductAnchor: 'sourceKind=retrieval reserved; no vector index or embedding pipeline in 102.',
  },
]

const POSTPONED_L4_MEMORY_VERBS =
  'Postponed (no stable CLI→server contract in 102): explicit `save` / `pin` / `ignore` / `summarize` as first-class product verbs beyond existing `/compact` and L3 report hooks. Use `/compact` and `theworld inspect context|memory <traceId>` for observability.'

function statusLabel(s: L4LayeredMemoryStatus): string {
  if (s === 'implemented') return 'implemented'
  if (s === 'read_only') return 'read-only'
  return 'planned'
}

/** Static taxonomy + postponed ops (printed by `theworld inspect memory` with no traceId). */
export function formatL4LayeredMemoryTaxonomyHuman(): string {
  const lines: string[] = [
    'L4 layered memory — taxonomy (102)',
    '',
    'layer                         status         notes (anchor)',
    '----------------------------------------------------------------',
  ]
  for (const L of L4_LAYERED_MEMORY_TAXONOMY) {
    const st = statusLabel(L.status).padEnd(12, ' ')
    const id = L.id.padEnd(12, ' ')
    lines.push(`${id} ${st} ${L.label}`)
    lines.push(`            ${L.l3OrProductAnchor}`)
  }
  lines.push('')
  lines.push(POSTPONED_L4_MEMORY_VERBS)
  lines.push('')
  lines.push('Inspect memory for a run (L3 same as 101 `inspect context`, filtered to memory):')
  lines.push('  theworld inspect memory <traceId> [--json]')
  return lines.join('\n')
}

function memBlockLine(b: ContextBlockDescriptorDto): string {
  const inPrompt = b.includedInPrompt ? 'in' : 'out'
  return `  ${b.id}  ${b.protection}  msgs=${b.messageCount}  ~tok=${b.estimatedTokens}  ${inPrompt}`
}

function stepMemoryBody(s: ContextBuildReportDto, stepIndex: number): string {
  const memBlocks = s.blocks.filter((b) => b.layer === 'memory')
  const lines: string[] = [`Step ${stepIndex}  (stepIndex=${s.stepIndex})`]
  if (memBlocks.length === 0) {
    lines.push('  Memory-layer blocks: (none)')
  } else {
    lines.push('  Memory-layer blocks:')
    for (const b of memBlocks) {
      lines.push(memBlockLine(b))
    }
  }
  if (!s.memoryContributions.length) {
    lines.push('  L3 memory contributions: (none)')
  } else {
    lines.push('  L3 memory contributions:')
    for (const m of s.memoryContributions) {
      const lab = m.label ? `  ${m.label}` : ''
      lines.push(
        `    ${m.sourceKind}${lab}  msgs=${m.messageCount}  ~tok=${m.estimatedTokens}`,
      )
    }
  }
  return lines.join('\n')
}

/** Per-run view: memory blocks + contributions; links to `inspect context` for full pack. */
export function formatGetRunContextMemoryHuman(
  traceId: string,
  body: GetRunContextResponseBody,
): string {
  if (!body.steps.length) {
    return [
      'L4 memory surface',
      `traceId: ${traceId}`,
      'No context build steps recorded for this run on the current server process.',
      '(Memory contributions are emitted with prompt assembly; empty after restart or for very old traces.)',
      'Full context (same DTO, all layers):  theworld inspect context <traceId>',
    ].join('\n')
  }
  const parts: string[] = [
    'L4 memory surface (from GET /v1/runs/.../context, memory-focused)',
    `traceId: ${traceId}`,
    `steps: ${body.steps.length}`,
    '',
  ]
  body.steps.forEach((s: ContextBuildReportDto, i: number) => {
    parts.push(stepMemoryBody(s, i))
    if (i < body.steps.length - 1) {
      parts.push('')
    }
  })
  parts.push('')
  parts.push('Full context assembly (all layers, compact, blocks):  theworld inspect context ' + traceId)
  return parts.join('\n')
}

/** TUI / rail: compact memory line from the same report as 101. */
export function formatMemoryHintOneLine(body: GetRunContextResponseBody): string {
  if (!body.steps.length) {
    return 'mem· no report'
  }
  const last = body.steps[body.steps.length - 1]!
  const contribs = last.memoryContributions
  if (!contribs.length) {
    const mb = last.blocks.filter((b) => b.layer === 'memory')
    if (!mb.length) {
      return 'mem· —'
    }
    const tok = mb.reduce((a, b) => a + b.estimatedTokens, 0)
    return `mem· blocks ~${tok}tok`
  }
  const kinds = [...new Set(contribs.map((c) => c.sourceKind))].join('+')
  const tok = contribs.reduce((a, c) => a + c.estimatedTokens, 0)
  return `mem· ${kinds} ~${tok}tok`
}

/** One line for the context rail: 101 + 102 together (same GET). */
export function formatL4ContextAndMemoryRailLine(body: GetRunContextResponseBody): string {
  const c = formatContextHintOneLine(body)
  const m = formatMemoryHintOneLine(body)
  if (c === 'ctx·eng: no report' && m === 'mem· no report') {
    return c
  }
  return `${c} · ${m}`
}
