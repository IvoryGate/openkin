/**
 * TUI splash Phase 1: line-by-line logo reveal (exec-plan 074).
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Box, Text, useStdout } from 'ink'
import { buildSplashPhase1Lines } from './chat-tui-art.js'
import { ink, colorEnabled } from '../style.js'

/** Milliseconds between revealing each additional line (first line shows immediately). */
export const SPLASH_LINE_STEP_MS = 100

export type ChatTuiSplashProps = {
  onComplete: () => void
}

export function ChatTuiSplash({ onComplete }: ChatTuiSplashProps): React.ReactElement {
  const { stdout } = useStdout()
  const cols = stdout.columns ?? 80
  const rows = stdout.rows ?? 24

  const lines = useMemo(() => buildSplashPhase1Lines(cols), [cols])
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    if (lines.length === 0) {
      onComplete()
      return
    }
    setVisibleCount(1)
    if (lines.length === 1) {
      const done = setTimeout(() => {
        onComplete()
      }, 0)
      return () => clearTimeout(done)
    }
    let next = 1
    const id = setInterval(() => {
      next += 1
      setVisibleCount(next)
      if (next >= lines.length) {
        clearInterval(id)
        setTimeout(() => {
          onComplete()
        }, 0)
      }
    }, SPLASH_LINE_STEP_MS)
    return () => clearInterval(id)
  }, [lines, onComplete])

  const shown = lines.slice(0, visibleCount)
  const padTop = Math.max(0, Math.floor((rows - Math.max(shown.length, 1) - 2) / 2))

  return (
    <Box flexDirection="column" width={cols} height={rows}>
      <Box height={padTop} flexShrink={0} />
      <Box flexDirection="column" alignItems="center" width={cols} flexGrow={1}>
        {shown.map((line, i) => (
          <Text key={i} color={colorEnabled ? ink.accent : undefined}>
            {line}
          </Text>
        ))}
      </Box>
    </Box>
  )
}
