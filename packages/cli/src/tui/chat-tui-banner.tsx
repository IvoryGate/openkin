import React, { useEffect, useMemo, useState } from 'react'
import { Box, Text, useStdout } from 'ink'
import { CHAT_TUI_TAGLINE, buildLazyvimLogoLines } from './chat-tui-art.js'
import { ink } from '../style.js'

const INTRO_MS = 52

export function ChatTuiBanner(): React.ReactElement {
  const { stdout } = useStdout()
  const cols = stdout.columns ?? 80
  const lines = useMemo(() => buildLazyvimLogoLines(cols), [cols])
  const [visibleCount, setVisibleCount] = useState(1)

  useEffect(() => {
    setVisibleCount(1)
  }, [cols])

  useEffect(() => {
    if (visibleCount >= lines.length) return
    const t = setTimeout(() => {
      setVisibleCount(v => Math.min(v + 1, lines.length))
    }, INTRO_MS)
    return () => clearTimeout(t)
  }, [visibleCount, lines.length])

  return (
    <Box flexDirection="column" marginBottom={0}>
      {lines.slice(0, visibleCount).map((line, i) => {
        const isEdge = i === 0 || i === visibleCount - 1
        return (
          <Text key={`${line}-${i}`} bold={isEdge} color={isEdge ? ink.brand : undefined}>
            {line}
          </Text>
        )
      })}
      <Text dimColor>{CHAT_TUI_TAGLINE}</Text>
    </Box>
  )
}
