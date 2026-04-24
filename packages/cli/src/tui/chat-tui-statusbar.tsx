import React from 'react'
import { Box, Text } from 'ink'
import { colorEnabled, ink } from '../style.js'
import type { TuiRunPhase } from './tui-run-phase.js'
import { formatTuiRunPhase } from './tui-run-phase.js'

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
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(0, max - 1))}…`
}

/**
 * Footer status rail (064): first priority = phase + session + host; then model/agent/ctx.
 */
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
}: ChatTuiStatusBarProps): React.ReactElement {
  const mdl = modelEnv || '-'
  const ag = agentId ? truncate(agentId, 10) : '-'
  const ctx =
    context === null
      ? 'ctx ?'
      : `m${context.msgs} ~${context.chars}`
  const phase = formatTuiRunPhase(runPhase)
  const sessionLabel = sessionAlias?.trim() ? `${sessionAlias.trim()} · ${sessionShort}` : sessionShort

  const firstPriority = [phase, sessionLabel, truncate(host, 18)]
  const secondPriority = [`mdl ${truncate(mdl, 10)}`, `agt ${ag}`, ctx]
  const rightFooter = `v${version}`

  const compactParts = [...firstPriority]
  if (!narrow && colorEnabled) {
    compactParts.push(...secondPriority)
  }
  compactParts.push(rightFooter)

  let compact = ''
  for (const part of compactParts) {
    const next = compact ? `${compact}  ·  ${part}` : part
    if (next.length > columns) break
    compact = next
  }

  if (narrow || !colorEnabled) {
    const bar = truncate(compact || `${phase}  ·  ${sessionLabel}  ·  ${truncate(host, 18)}`, columns)
    return (
      <Box width={columns}>
        <Text dimColor>{bar}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="row" justifyContent="space-between" width={columns}>
      <Text>
        <Text
          color={runPhase === 'failed' ? ink.danger : runPhase === 'streaming' ? ink.assistant : ink.accent}
          bold
        >
          {phase}
        </Text>
        <Text dimColor> · </Text>
        <Text color={ink.focus}>{truncate(sessionLabel, 18)}</Text>
        <Text dimColor> · </Text>
        <Text dimColor>{truncate(host, 18)}</Text>
        <Text dimColor> · </Text>
        <Text dimColor>{truncate(workspacePath, 20)}</Text>
      </Text>
      <Text dimColor>
        {`mdl ${truncate(mdl, 10)} · agt ${ag} · ${ctx} · ${rightFooter}`}
      </Text>
    </Box>
  )
}
