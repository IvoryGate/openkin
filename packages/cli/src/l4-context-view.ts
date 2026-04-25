/**
 * L4 context engineering — human-readable views over L3 ContextBuildReportDto (101).
 */
import type {
  ContextBlockDescriptorDto,
  ContextBuildReportDto,
  GetRunContextResponseBody,
} from '@theworld/operator-client'

function blockLine(b: ContextBlockDescriptorDto): string {
  const inPrompt = b.includedInPrompt ? 'in' : 'out'
  return `  ${b.id}  ${b.layer}/${b.protection}  msgs=${b.messageCount}  ~tok=${b.estimatedTokens}  ${inPrompt}`
}

function stepHeader(s: ContextBuildReportDto, index: number): string[] {
  const head = [`Step ${index}  (stepIndex=${s.stepIndex})`]
  if (s.maxPromptTokens != null) {
    head.push(`  maxPromptTokens: ${s.maxPromptTokens}`)
  }
  head.push(`  assembled: ${s.assembledMessageCount} msgs  ~${s.assembledEstimatedTokens} tok (heuristic)`)
  return head
}

function compactSection(s: ContextBuildReportDto): string[] {
  const c = s.compact
  const lines = [
    `  Compact:`,
    `    before/after fit: ~${c.estimatedTokensBeforeFit} / ~${c.estimatedTokensAfterFit} tok`,
  ]
  if (c.maxPromptTokens != null) {
    lines.push(`    budget: ${c.maxPromptTokens}`)
  }
  if (c.droppedBlockIds.length) {
    lines.push(`    dropped blocks: ${c.droppedBlockIds.join(', ')}  (~${c.droppedTokenEstimate} tok)`)
  } else {
    lines.push(`    dropped blocks: (none)`)
  }
  return lines
}

function memorySection(s: ContextBuildReportDto): string[] {
  if (!s.memoryContributions.length) {
    return ['  Memory contributions: (none)']
  }
  const lines = ['  Memory contributions:']
  for (const m of s.memoryContributions) {
    const lab = m.label ? `  ${m.label}` : ''
    lines.push(
      `    ${m.sourceKind}${lab}  msgs=${m.messageCount}  ~tok=${m.estimatedTokens}`,
    )
  }
  return lines
}

export function formatContextBuildReportStep(s: ContextBuildReportDto, stepIndex: number): string {
  const lines: string[] = [...stepHeader(s, stepIndex), '  Blocks:']
  for (const b of s.blocks) {
    lines.push(blockLine(b))
  }
  lines.push(...compactSection(s))
  lines.push(...memorySection(s))
  return lines.join('\n')
}

/** Full multi-step report for `theworld inspect context` (human). */
export function formatGetRunContextHuman(
  traceId: string,
  body: GetRunContextResponseBody,
): string {
  if (!body.steps.length) {
    return [
      `traceId: ${traceId}`,
      'No context build steps recorded for this run on the current server process.',
      '(Reports are produced when the run assembles a prompt; empty after restart or for very old traces.)',
      'Try: run a new message in this session, then re-fetch; or use a recently completed traceId.',
    ].join('\n')
  }
  const parts: string[] = [`traceId: ${traceId}`, `steps: ${body.steps.length}`, '']
  body.steps.forEach((s: ContextBuildReportDto, i: number) => {
    parts.push(formatContextBuildReportStep(s, i))
    if (i < body.steps.length - 1) {
      parts.push('')
    }
  })
  return parts.join('\n')
}

/** One compact line for TUI context rail after a successful run. */
export function formatContextHintOneLine(body: GetRunContextResponseBody): string {
  if (!body.steps.length) {
    return 'ctx·eng: no report'
  }
  const last = body.steps[body.steps.length - 1]!
  const layers = [...new Set(last.blocks.map((b: ContextBlockDescriptorDto) => b.layer))].join('|')
  const dropped = last.compact.droppedBlockIds.length
  return `ctx·eng ~${last.assembledEstimatedTokens}tok ${layers}${dropped ? ` drop${dropped}` : ''}`
}
