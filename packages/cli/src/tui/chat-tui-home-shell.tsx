import React, { useEffect, useMemo, useState } from 'react'
import { Box, Text } from 'ink'
import { createTheWorldClient, type SessionDto } from '@theworld/client-sdk'
import type { CliContext } from '../args.js'
import { ink } from '../style.js'
import { getSessionAlias } from '../session-alias.js'
import { shortSessionIdLabel } from '../chat-status.js'
import { CHAT_TUI_TAGLINE, buildLazyvimLogoLines } from './chat-tui-art.js'

function formatRecentLine(s: SessionDto): string {
  const display = s.displayName?.trim()
  const alias = getSessionAlias(s.id)
  const sid = shortSessionIdLabel(s.id)
  if (display) {
    if (alias && alias !== display) {
      return `${display}  ·  ${alias}  ·  ${sid}`
    }
    return `${display}  ·  ${sid}`
  }
  if (alias) {
    return `${alias}  ·  ${sid}`
  }
  return sid
}

export type ChatTuiHomeShellProps = {
  ctx: CliContext
  currentSessionId: string
  columns: number
  narrow: boolean
}

/**
 * 067: Home / empty shell — not just an empty transcript box; entry + discoverability.
 */
export function ChatTuiHomeShell({
  ctx,
  currentSessionId,
  columns,
  narrow,
}: ChatTuiHomeShellProps): React.ReactElement {
  const [recent, setRecent] = useState<SessionDto[] | null>(null)
  const logoLines = useMemo(() => buildLazyvimLogoLines(Math.max(34, columns - 18)), [columns])
  const cardWidth = Math.max(28, Math.min(columns - 4, 64))

  useEffect(() => {
    const client = createTheWorldClient({
      baseUrl: ctx.baseUrl,
      apiKey: ctx.apiKey,
    })
    void (async () => {
      try {
        const { sessions } = await client.listSessions({ kind: 'chat', limit: 6 })
        setRecent(
          sessions.filter(s => s.id !== currentSessionId).slice(0, narrow ? 3 : 5),
        )
      } catch {
        setRecent([])
      }
    })()
  }, [ctx.apiKey, ctx.baseUrl, currentSessionId])

  return (
    <Box flexDirection="column" flexGrow={1} justifyContent="center" alignItems="center" paddingBottom={1}>
      <Box flexDirection="column" alignItems="center" marginBottom={1}>
        {logoLines.map((line, index) => (
          <Text key={`${line}-${index}`} bold={index === 0} color={index === 0 ? ink.brand : undefined}>
            {line}
          </Text>
        ))}
        <Text dimColor>{CHAT_TUI_TAGLINE}</Text>
      </Box>

      <Box
        flexDirection="column"
        width={cardWidth}
        borderStyle="round"
        borderColor={ink.panelBorder}
        paddingX={2}
        paddingY={1}
        marginBottom={1}
      >
        <Text dimColor>Ask anything… fix a bug, inspect the server, or continue a thread.</Text>
        <Text color={ink.accent}>Enter sends · Tab completes slash · Up/Down scroll transcript</Text>
        <Text>
          <Text color={ink.muted}>Resume </Text>
          <Text dimColor>-c / --continue</Text>
          <Text color={ink.muted}> · pick </Text>
          <Text dimColor>--pick</Text>
          <Text color={ink.muted}> · attach </Text>
          <Text dimColor>--resume &lt;id|alias&gt;</Text>
        </Text>
        <Text>
          <Text color={ink.muted}>Commands </Text>
          <Text dimColor>/help · /inspect health · /rename &lt;name&gt;</Text>
        </Text>
      </Box>

      <Box flexDirection="column" width={cardWidth}>
        <Text bold color={ink.accent}>
          Recent threads
        </Text>
        {recent === null ? (
          <Text dimColor>Loading recent threads…</Text>
        ) : recent.length === 0 ? (
          <Text dimColor>No other saved threads yet (or server unreachable).</Text>
        ) : (
          recent.map(s => (
            <Text key={s.id} dimColor>
              {'· '}
              {formatRecentLine(s)}
            </Text>
          ))
        )}
        {!narrow ? <Text dimColor>Full CLI: theworld help · theworld sessions list · theworld inspect status</Text> : null}
      </Box>
    </Box>
  )
}
