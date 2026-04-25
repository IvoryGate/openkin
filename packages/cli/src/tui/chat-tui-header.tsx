import React from 'react'
import { Box, Text } from 'ink'
import { TuiBox } from './tui-box.js'
import { ink } from '../style.js'
import { formatTuiRunPhase, type TuiRunPhase } from './tui-run-phase.js'
import { useTuiPalette } from './tui-theme-context.js'
import { TuiTextFill } from './tui-text-fill.js'

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
  columns,
  workspaceLabel,
  displayName,
  alias,
  shortId,
  runPhase,
  showHome,
}: ChatTuiHeaderProps): React.ReactElement {
  const p = useTuiPalette()
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
  const phaseTone =
    runPhase === 'failed'
      ? p.danger ?? ink.danger
      : runPhase === 'streaming'
        ? p.assistantAccent ?? ink.assistant
        : p.accent ?? ink.accent

  return (
    <TuiBox flexDirection="column" width={columns} backgroundColor={p.surface} marginBottom={0}>
      {p.color && p.surface ? <TuiTextFill width={columns} backgroundColor={p.surface} /> : null}
      <Box flexDirection="column" paddingX={1} paddingY={0}>
        <Box flexDirection="row" justifyContent="space-between">
          <Box flexDirection="row">
            <Text bold color={p.brand ?? ink.brand}>
              THEWORLD
            </Text>
            <Text dimColor color={!p.color ? undefined : p.textMuted}>
              {' '}
              · chat shell · {workspaceLabel}
            </Text>
          </Box>
          <Text color={phaseTone}>{formatTuiRunPhase(runPhase)}</Text>
        </Box>
        <Box flexDirection="row" flexWrap="wrap">
          <Text bold color={p.focus ?? ink.focus}>
            {titleName}
          </Text>
          <Text dimColor color={!p.color ? undefined : p.textMuted}>
            {' '}
            · {identitySub}
          </Text>
        </Box>
      </Box>
      {p.color && p.border ? <TuiTextFill width={columns} backgroundColor={p.border} /> : null}
    </TuiBox>
  )
}
