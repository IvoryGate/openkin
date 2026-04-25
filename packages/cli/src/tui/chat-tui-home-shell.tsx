import React, { useEffect, useMemo, useState } from 'react'
import { Box, Text } from 'ink'
import { TuiBox } from './tui-box.js'
import { createTheWorldClient, type SessionDto } from '@theworld/client-sdk'
import type { CliContext } from '../args.js'
import { useTuiPalette } from './tui-theme-context.js'
import { getSessionAlias } from '../session-alias.js'
import { describeLocalProfileLines } from '../l4-onboarding.js'
import { shortSessionIdLabel } from '../chat-status.js'
import { CHAT_TUI_TAGLINE, buildTheWorldSpecLogoLines } from './chat-tui-art.js'

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
  const p = useTuiPalette()
  const [recent, setRecent] = useState<SessionDto[] | null>(null)
  const logoLines = useMemo(() => buildTheWorldSpecLogoLines(columns), [columns])
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
    <Box flexDirection="column" flexGrow={1} justifyContent="center" alignItems="center" paddingBottom={1} width="100%">
      <Box flexDirection="column" alignItems="center" marginBottom={1}>
        {logoLines.map((line, index) => (
          <Text key={`${line}-${index}`} color={p.color ? p.brand : undefined}>
            {line}
          </Text>
        ))}
        <Text dimColor color={!p.color ? undefined : p.textMuted}>
          {CHAT_TUI_TAGLINE}
        </Text>
      </Box>

      <TuiBox
        flexDirection="column"
        width={cardWidth}
        backgroundColor={p.color ? p.surface : undefined}
        paddingX={2}
        paddingY={1}
        marginBottom={1}
      >
        <Text dimColor color={!p.color ? undefined : p.textMuted}>
          Ask anything… fix a bug, inspect the server, or continue a thread.
        </Text>
        <Text color={p.accent ?? undefined}>Enter sends · Tab completes slash · Up/Down scroll transcript</Text>
        <Text>
          <Text color={!p.color ? undefined : p.textMuted}>Resume </Text>
          <Text dimColor>-c / --continue</Text>
          <Text color={!p.color ? undefined : p.textMuted}> · pick </Text>
          <Text dimColor>--pick</Text>
          <Text color={!p.color ? undefined : p.textMuted}> · attach </Text>
          <Text dimColor>--resume &lt;id|alias&gt;</Text>
        </Text>
        <Text>
          <Text color={!p.color ? undefined : p.textMuted}>Commands </Text>
          <Text dimColor>/help · /inspect health · /rename &lt;name&gt;</Text>
        </Text>
        <Box marginTop={1} flexDirection="column">
        <Text bold color={p.accent ?? undefined}>
          Local profile
        </Text>
        {describeLocalProfileLines(ctx).map((line, i) => (
          <Text key={i} dimColor color={!p.color ? undefined : p.textMuted}>
            {line}
          </Text>
        ))}
        <Text dimColor color={!p.color ? undefined : p.textMuted}>
          List tools: theworld inspect tools · Risky tools may need server approval
        </Text>
        </Box>
      </TuiBox>

      <Box flexDirection="column" width={cardWidth}>
        <Text bold color={p.accent ?? undefined}>
          Recent threads
        </Text>
        {recent === null ? (
          <Text dimColor color={!p.color ? undefined : p.textMuted}>
            Loading recent threads…
          </Text>
        ) : recent.length === 0 ? (
          <Text dimColor color={!p.color ? undefined : p.textMuted}>
            No other saved threads yet (or server unreachable).
          </Text>
        ) : (
          recent.map(s => (
            <Text key={s.id} dimColor color={!p.color ? undefined : p.textMuted}>
              {'· '}
              {formatRecentLine(s)}
            </Text>
          ))
        )}
        {!narrow ? (
          <Text dimColor color={!p.color ? undefined : p.textMuted}>
            Full CLI: theworld help · theworld sessions list · theworld inspect status
          </Text>
        ) : null}
      </Box>
    </Box>
  )
}
