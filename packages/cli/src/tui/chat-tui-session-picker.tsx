/**
 * Full-screen session list overlay (exec-plan 079). Data via {@link fetchTuiSessionList}.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import { TuiBox } from './tui-box.js'
import type { CliContext } from '../args.js'
import { fetchTuiSessionList, type TuiSessionRow } from './tui-session-list.js'
import { ink, colorEnabled } from '../style.js'
import { useTuiPalette } from './tui-theme-context.js'

function clipLabel(text: string, maxCols: number): string {
  if (text.length <= maxCols) return text
  if (maxCols < 3) return text.slice(0, maxCols)
  return `${text.slice(0, maxCols - 1)}…`
}

export type ChatTuiSessionPickerProps = {
  ctx: CliContext
  currentSessionId: string
  onPick: (sessionId: string) => void
  onClose: () => void
}

function isCtrlL(input: string, key: { ctrl: boolean }): boolean {
  if (!key.ctrl) return false
  if (input === 'l' || input === 'L') return true
  return input.length === 1 && input.charCodeAt(0) === 12
}

export function ChatTuiSessionPicker({
  ctx,
  currentSessionId,
  onPick,
  onClose,
}: ChatTuiSessionPickerProps): React.ReactElement {
  const p = useTuiPalette()
  const { stdout } = useStdout()
  const cols = stdout.columns ?? 80
  const rows = stdout.rows ?? 24
  const innerW = Math.max(20, cols - 3)

  const [list, setList] = useState<TuiSessionRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    void (async () => {
      const r = await fetchTuiSessionList(ctx)
      if (r.ok) {
        setList(r.rows)
        const i = r.rows.findIndex(x => x.id === currentSessionId)
        setIndex(i >= 0 ? i : 0)
      } else {
        setLoadError(r.message)
        setList([])
      }
    })()
  }, [ctx, currentSessionId])

  const itemCount = list?.length ?? 0
  const canMove = itemCount > 0

  const maxVisible = Math.max(1, Math.min(itemCount, Math.max(1, rows - 5)))
  const start =
    itemCount === 0 || itemCount <= maxVisible
      ? 0
      : Math.max(0, Math.min(index, itemCount - maxVisible))
  const visible = (list ?? []).slice(start, start + maxVisible)

  const moveUp = useCallback((): void => {
    setIndex(i => (i <= 0 ? 0 : i - 1))
  }, [])

  const moveDown = useCallback((): void => {
    setIndex(i => {
      const n = list?.length ?? 0
      if (n === 0) return 0
      return Math.min(i + 1, n - 1)
    })
  }, [list])

  useInput(
    (input, key) => {
      if (key.escape || (input === 'q' && !key.ctrl && !key.meta)) {
        onClose()
        return
      }
      if (isCtrlL(input, key)) {
        onClose()
        return
      }
      if (key.return && canMove) {
        onPick((list ?? [])[index]!.id)
        return
      }
      if (key.upArrow || (!key.ctrl && !key.meta && input === 'k')) {
        moveUp()
        return
      }
      if (key.downArrow || (!key.ctrl && !key.meta && input === 'j')) {
        moveDown()
        return
      }
    },
    { isActive: true },
  )

  return (
    <TuiBox
      flexDirection="column"
      width={cols}
      height={rows}
      backgroundColor={p.color ? p.background : undefined}
      paddingX={1}
    >
      <Text bold color={p.accent ?? ink.accent}>
        Sessions
      </Text>
      <Text dimColor color={!p.color ? undefined : p.textMuted}>
        j/k move · Enter open · Esc/q close · Ctrl+L close
      </Text>
      {loadError ? (
        <Text color={p.danger ?? ink.danger}>{loadError}</Text>
      ) : list === null ? (
        <Text dimColor color={!p.color ? undefined : p.textMuted}>
          Loading…
        </Text>
      ) : list.length === 0 ? (
        <Text dimColor color={!p.color ? undefined : p.textMuted}>
          No chat sessions
        </Text>
      ) : (
        <Box flexDirection="column" marginTop={1} flexGrow={1} overflow="hidden">
          {visible.map((r, i) => {
            const globalIdx = start + i
            const active = globalIdx === index
            const line = clipLabel(r.label, innerW)
            if (active) {
              return (
                <Text key={r.id} inverse>
                  {`> ${line}`}
                </Text>
              )
            }
            return (
              <Text key={r.id} dimColor={colorEnabled} color={p.textMuted ?? ink.muted}>
                {`  ${line}`}
              </Text>
            )
          })}
        </Box>
      )}
    </TuiBox>
  )
}
