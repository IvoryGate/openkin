import React from 'react'
import { Box, Text } from 'ink'
import { ink } from '../style.js'

export type ChatTuiInputMode = 'idle' | 'busy' | 'blocked'

export type ChatTuiInputBarProps = {
  columns: number
  draft: string
  cursorIndex: number
  caret: string
  inputMode: ChatTuiInputMode
  showHome: boolean
}

function borderColorForMode(inputMode: ChatTuiInputMode): string | undefined {
  if (inputMode === 'busy') return ink.warning
  if (inputMode === 'blocked') return ink.danger
  return ink.panelBorder
}

function modeTone(inputMode: ChatTuiInputMode): string | undefined {
  if (inputMode === 'busy') return ink.warning
  if (inputMode === 'blocked') return ink.danger
  return ink.accent
}

function buildPieces(draft: string, cursorIndex: number, caret: string): { before: string; after: string } {
  const safeIndex = Math.max(0, Math.min(cursorIndex, draft.length))
  return {
    before: draft.slice(0, safeIndex),
    after: draft.slice(safeIndex),
  }
}

export function ChatTuiInputBar({
  columns,
  draft,
  cursorIndex,
  caret,
  inputMode,
  showHome,
}: ChatTuiInputBarProps): React.ReactElement {
  const placeholder =
    showHome ? 'Ask anything… or resume a recent thread' : 'Continue the current thread…'
  const pieces = buildPieces(draft, cursorIndex, caret)
  const hasDraft = draft.length > 0

  return (
    <Box
      flexDirection="column"
      width={columns}
      borderStyle="round"
      borderColor={borderColorForMode(inputMode)}
      paddingX={1}
      paddingY={0}
    >
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color={ink.user}>
          Prompt
        </Text>
        <Text color={modeTone(inputMode)}>{inputMode}</Text>
      </Box>
      {hasDraft ? (
        <Text>
          <Text color={ink.user}>{pieces.before}</Text>
          {inputMode === 'idle' ? <Text color={ink.focus}>{caret || '|'}</Text> : null}
          <Text color={ink.user}>{pieces.after}</Text>
        </Text>
      ) : (
        <Text dimColor>{placeholder}</Text>
      )}
      <Text dimColor>
        Enter send · Tab complete slash · Up/Down scroll · Left/Right move cursor
      </Text>
    </Box>
  )
}
