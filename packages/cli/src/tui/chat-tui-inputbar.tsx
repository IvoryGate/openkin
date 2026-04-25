import React from 'react'
import { Box, Text } from 'ink'
import { TuiBox } from './tui-box.js'
import { ink } from '../style.js'
import { useTuiPalette } from './tui-theme-context.js'
import { TuiTextFill } from './tui-text-fill.js'
import { TUI_DRAFT_MAX_LINES, cursorLineAndCol } from './tui-input-draft.js'

export type ChatTuiInputMode = 'idle' | 'busy' | 'blocked'

export type ChatTuiInputBarProps = {
  columns: number
  draft: string
  cursorIndex: number
  caret: string
  inputMode: ChatTuiInputMode
  showHome: boolean
}

function borderColorForMode(
  p: ReturnType<typeof useTuiPalette>,
  inputMode: ChatTuiInputMode,
): string | undefined {
  if (inputMode === 'busy') return p.inputBorderBusy ?? ink.warning
  if (inputMode === 'blocked') return p.inputBorderBlocked ?? ink.danger
  if (p.color) return p.inputBorder
  return ink.panelBorder
}

function focusColorForMode(
  p: ReturnType<typeof useTuiPalette>,
  inputMode: ChatTuiInputMode,
): string | undefined {
  if (inputMode === 'idle') return p.inputBorderFocus ?? ink.focus
  return borderColorForMode(p, inputMode)
}

function modeTone(p: ReturnType<typeof useTuiPalette>, inputMode: ChatTuiInputMode): string | undefined {
  if (inputMode === 'busy') return p.warning ?? ink.warning
  if (inputMode === 'blocked') return p.danger ?? ink.danger
  return p.accent ?? ink.accent
}

export function ChatTuiInputBar({
  columns,
  draft,
  cursorIndex,
  caret,
  inputMode,
  showHome,
}: ChatTuiInputBarProps): React.ReactElement {
  const p = useTuiPalette()
  const placeholder =
    showHome ? 'Ask anything… or resume a recent thread' : 'Continue the current thread…'
  const hasDraft = draft.length > 0
  const bColor = inputMode === 'idle' ? focusColorForMode(p, inputMode) : borderColorForMode(p, inputMode)
  const focusStripW = Math.max(0, columns - 2)

  const { line: curLine, col: curCol, lines: splitLines } = cursorLineAndCol(
    inputMode === 'blocked' ? '' : draft,
    inputMode === 'blocked' ? 0 : cursorIndex,
  )
  const visLines =
    inputMode === 'blocked' ? ['…'] : hasDraft ? splitLines.slice(0, TUI_DRAFT_MAX_LINES) : ['']
  const caretLine = curLine < visLines.length ? curLine : Math.max(0, visLines.length - 1)

  return (
    <TuiBox
      flexDirection="column"
      width={columns}
      backgroundColor={p.surface}
      paddingX={0}
      paddingTop={1}
    >
      <TuiBox
        flexDirection="column"
        marginX={0}
        marginY={0}
        paddingX={1}
        paddingY={0}
        backgroundColor={p.color ? p.background : undefined}
      >
        {p.color && bColor ? <TuiTextFill width={focusStripW} backgroundColor={bColor} /> : null}
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold color={p.userAccent ?? ink.user}>
            Prompt
          </Text>
          <Text color={modeTone(p, inputMode)}>{inputMode}</Text>
        </Box>
        {inputMode === 'blocked' ? (
          <Text color={!p.color ? undefined : p.textMuted} dimColor={!p.color}>
            …
          </Text>
        ) : hasDraft ? (
          <Box flexDirection="column">
            {visLines.map((line, i) => {
              const isCaretRow = i === caretLine && inputMode === 'idle'
              const colOnRow = isCaretRow && i === curLine ? curCol : isCaretRow ? line.length : 0
              return (
              <Text key={i}>
                {i === 0 ? (
                  <Text color={p.userAccent ?? ink.user}>{'> '}</Text>
                ) : (
                  <Text color={p.text ?? ink.user}>{'  '}</Text>
                )}
                {isCaretRow ? (
                  <>
                    <Text color={p.text ?? ink.user}>{line.slice(0, colOnRow)}</Text>
                    <Text color={p.focus ?? ink.focus}>{caret || '|'}</Text>
                    <Text color={p.text ?? ink.user}>{line.slice(colOnRow)}</Text>
                  </>
                ) : (
                  <Text color={p.text ?? ink.user}>{line}</Text>
                )}
              </Text>
              )
            })}
          </Box>
        ) : (
          <Text color={!p.color ? undefined : p.textMuted} dimColor={!p.color}>
            {`>  ${placeholder}`}
          </Text>
        )}
        <Text dimColor={!p.color} color={p.textMuted ?? undefined}>
          Enter send · Shift+↵ (if terminal supports) or Ctrl+O new line (max {TUI_DRAFT_MAX_LINES}) ·
          Tab slash · Up/Down history · ←/→
        </Text>
      </TuiBox>
    </TuiBox>
  )
}
