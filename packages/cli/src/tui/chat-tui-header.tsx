import React from 'react'
import { Box, Text } from 'ink'
import { ink } from '../style.js'
import { formatTuiRunPhase, type TuiRunPhase } from './tui-run-phase.js'

export type ChatTuiHeaderProps = {
  columns: number
  workspaceLabel: string
  displayName?: string
  alias?: string
  shortId: string
  runPhase: TuiRunPhase
  showHome: boolean
}

export function ChatTuiHeader({
  columns: _columns,
  workspaceLabel,
  displayName,
  alias,
  shortId,
  runPhase,
  showHome,
}: ChatTuiHeaderProps): React.ReactElement {
  const dn = displayName?.trim()
  const al = alias?.trim()
  const titleName = showHome ? 'Home shell' : dn || al || shortId
  const identitySub = showHome
    ? 'Start a new turn, resume a thread, or jump into commands'
    : dn && al && al !== dn
      ? `${al} · ${shortId}`
      : dn
        ? shortId
        : al && titleName === al
          ? shortId
          : shortId
  const phaseColor =
    runPhase === 'failed' ? ink.danger : runPhase === 'streaming' ? ink.assistant : ink.accent

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Box flexDirection="row">
          <Text bold color={ink.brand}>
            THEWORLD
          </Text>
          <Text dimColor> · chat shell · {workspaceLabel}</Text>
        </Box>
        <Text color={phaseColor}>{formatTuiRunPhase(runPhase)}</Text>
      </Box>
      <Box flexDirection="row" flexWrap="wrap">
        <Text bold color={ink.focus}>
          {titleName}
        </Text>
        <Text dimColor> · {identitySub}</Text>
      </Box>
    </Box>
  )
}
