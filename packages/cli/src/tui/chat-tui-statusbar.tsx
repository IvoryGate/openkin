import React from 'react'
import { Text } from 'ink'
import { colorEnabled, ink } from '../style.js'
import type { TuiRunPhase } from './tui-run-phase.js'
import { formatTuiRunPhase } from './tui-run-phase.js'
import { useTuiPalette } from './tui-theme-context.js'
import { padStringToWidth } from './tui-pad-to-width.js'

export type ChatTuiContextStats = { msgs: number; chars: number }

export type ChatTuiStatusBarProps = {
  columns: number
  narrow: boolean
  runPhase: TuiRunPhase
  modelEnv: string
  agentId?: string
  context: ChatTuiContextStats | null
  host: string
  sessionAlias?: string
  sessionShort: string
  workspacePath: string
  version: string
  /**
   * When `false` and {@link ChatTuiContextRail} (or similar) already shows mdl/ctx, omit
   * from this bar to avoid duplicate noise (OpenCode 式分工).
   */
  includeModelContext?: boolean
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(0, max - 1))}…`
}

/** One row, left + gap + right, fixed cols — makes `Text`+`backgroundColor` span the full width (081). */
function buildPaddedStatusLine(left: string, right: string, cols: number): string {
  if (cols <= 0) return ''
  if (left.length + right.length >= cols) {
    return padStringToWidth(`${left} ${right}`, cols)
  }
  const gap = cols - left.length - right.length
  return padStringToWidth(left + ' '.repeat(gap) + right, cols)
}

export function ChatTuiStatusBar({
  columns,
  narrow,
  runPhase,
  modelEnv,
  agentId,
  context,
  host,
  sessionAlias,
  sessionShort,
  workspacePath,
  version,
  includeModelContext = true,
}: ChatTuiStatusBarProps): React.ReactElement {
  const p = useTuiPalette()
  const mdl = modelEnv || '-'
  const ag = agentId ? truncate(agentId, 10) : '-'
  const ctx =
    context === null
      ? 'ctx ?'
      : `m${context.msgs} ~${context.chars}`
  const phase = formatTuiRunPhase(runPhase)
  const sessionLabel = sessionAlias?.trim() ? `${sessionAlias.trim()} · ${sessionShort}` : sessionShort

  const firstPriority = [phase, sessionLabel, truncate(host, 18)]
  const secondPriority = includeModelContext
    ? [`mdl ${truncate(mdl, 10)}`, `agt ${ag}`, ctx]
    : []
  const rightFooter = `v${version}`

  const compactParts = [...firstPriority]
  if (!narrow && colorEnabled && secondPriority.length > 0) {
    compactParts.push(...secondPriority)
  }
  compactParts.push(rightFooter)

  let compact = ''
  for (const part of compactParts) {
    const next = compact ? `${compact}  ·  ${part}` : part
    if (next.length > columns) break
    compact = next
  }

  const phaseColor =
    runPhase === 'failed' ? p.danger ?? ink.danger : runPhase === 'streaming' ? p.assistantAccent ?? ink.assistant : p.accent ?? ink.accent
  const barText = p.textMuted
  const barBg = p.statusBar

  if (narrow || !colorEnabled) {
    const bar = padStringToWidth(
      truncate(compact || `${phase}  ·  ${sessionLabel}  ·  ${truncate(host, 18)}`, columns),
      columns,
    )
    if (p.color && barBg) {
      return (
        <Text backgroundColor={barBg} color={barText} dimColor={false} wrap="truncate-end">
          {bar}
        </Text>
      )
    }
    return (
      <Text dimColor color={!p.color ? undefined : barText} wrap="truncate-end">
        {bar}
      </Text>
    )
  }

  const left = `${phase} · ${truncate(sessionLabel, 18)} · ${truncate(host, 18)} · ${truncate(workspacePath, 20)}`
  const right = includeModelContext
    ? `mdl ${truncate(mdl, 10)} · agt ${ag} · ${ctx} · ${rightFooter}`
    : `${rightFooter}`
  const line = buildPaddedStatusLine(left, right, columns)

  if (p.color && barBg) {
    return (
      <Text backgroundColor={barBg} color={barText} wrap="truncate-end">
        {line}
      </Text>
    )
  }

  return (
    <Text wrap="truncate-end">
      <Text color={phaseColor} bold>
        {phase}
      </Text>
      <Text dimColor color={!p.color ? undefined : barText}>
        {' '}
        ·{' '}
      </Text>
      <Text color={p.focus ?? ink.focus}>{truncate(sessionLabel, 18)}</Text>
      <Text dimColor color={!p.color ? undefined : barText}>
        {' '}
        · {truncate(host, 18)} · {truncate(workspacePath, 20)}
      </Text>
      {includeModelContext ? (
        <Text dimColor color={!p.color ? undefined : barText}>
          {'  '}
          {`mdl ${truncate(mdl, 10)} · agt ${ag} · ${ctx} · ${rightFooter}`}
        </Text>
      ) : (
        <Text dimColor color={!p.color ? undefined : barText}>
          {'  '}
          {rightFooter}
        </Text>
      )}
    </Text>
  )
}
