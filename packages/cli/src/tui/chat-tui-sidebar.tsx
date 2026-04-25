import React from 'react'
import { Box, Text } from 'ink'
import { TuiBox } from './tui-box.js'
import { ink } from '../style.js'
import type { ChatTuiContextStats } from './chat-tui-statusbar.js'
import type { TuiRunPhase } from './tui-run-phase.js'
import { formatTuiRunPhase } from './tui-run-phase.js'
import { useTuiPalette } from './tui-theme-context.js'
import type { TuiSessionRow } from './tui-session-list.js'

export type ChatTuiSidebarProps = {
  width: number
  runPhase: TuiRunPhase
  host: string
  modelEnv: string
  agentId?: string
  context: ChatTuiContextStats | null
  displayName?: string
  alias?: string
  shortId: string
  currentSessionId: string
  recentRows: TuiSessionRow[] | null
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(0, max - 1))}…`
}

/** 085: 与主列用留白/字重区分，无独立色块。 */
function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  const p = useTuiPalette()
  return (
    <TuiBox flexDirection="column" width="100%" paddingX={1} paddingY={0} backgroundColor={undefined}>
      <Text bold color={!p.color ? undefined : p.textMuted ?? ink.dim}>
        {title}
      </Text>
      {children}
    </TuiBox>
  )
}

function kv(
  p: ReturnType<typeof useTuiPalette>,
  label: string,
  value: string,
  valueTone?: string,
): React.ReactElement {
  return (
    <Text>
      <Text color={!p.color ? undefined : p.textMuted}>{label}</Text>
      <Text dimColor={!p.color} color={!p.color ? undefined : p.textMuted}>
        {' '}
        ·{' '}
      </Text>
      <Text color={valueTone ?? (p.text ?? undefined)}>{value}</Text>
    </Text>
  )
}

export function ChatTuiSidebar({
  width,
  runPhase,
  host,
  modelEnv,
  agentId,
  context,
  displayName,
  alias,
  shortId,
  currentSessionId,
  recentRows,
}: ChatTuiSidebarProps): React.ReactElement {
  const p = useTuiPalette()
  const title = displayName?.trim() || alias?.trim() || shortId
  const aliasLabel = alias?.trim() && alias?.trim() !== displayName?.trim() ? alias.trim() : '-'
  const contextLabel = context ? `${context.msgs} msgs · ~${context.chars} chars` : 'ctx unavailable'
  const others = (recentRows ?? []).filter(r => r.id !== currentSessionId).slice(0, 5)
  const panel = p.color ? p.surface : undefined

  return (
    <TuiBox
      flexDirection="column"
      flexGrow={1}
      minHeight={0}
      width={width}
      minWidth={width}
      backgroundColor={panel}
    >
      <Box marginBottom={1}>
        <Section title="Thread">
          <Text bold color={p.focus ?? ink.focus}>
            {truncate(title, width - 6)}
          </Text>
          {kv(p, 'alias', truncate(aliasLabel, width - 10))}
          {kv(p, 'id', shortId, p.text ?? undefined)}
        </Section>
      </Box>

      <Box marginBottom={1}>
        <Section title="Recent">
          {recentRows === null ? (
            <Text dimColor color={!p.color ? undefined : p.textMuted}>
              Loading…
            </Text>
          ) : others.length === 0 ? (
            <Text dimColor color={!p.color ? undefined : p.textMuted}>
              No other threads
            </Text>
          ) : (
            others.map(r => (
              <Text key={r.id} dimColor={!p.color} color={p.textMuted ?? undefined}>
                {`· ${truncate(r.label, width - 4)}`}
              </Text>
            ))
          )}
          <Text dimColor color={!p.color ? undefined : p.textMuted}>
            Open full list: Ctrl+L
          </Text>
        </Section>
      </Box>

      <Box marginBottom={1}>
        <Section title="Runtime">
          {kv(
            p,
            'phase',
            formatTuiRunPhase(runPhase),
            runPhase === 'failed' ? p.danger : runPhase === 'streaming' ? p.assistantAccent : p.text,
          )}
          {kv(p, 'host', truncate(host, width - 10))}
          {kv(p, 'model', truncate(modelEnv || '-', width - 10))}
          {kv(p, 'agent', truncate(agentId || '-', width - 10))}
          {kv(p, 'context', truncate(contextLabel, width - 10))}
        </Section>
      </Box>

      <Box marginBottom={1}>
        <Section title="Quick">
          <Text dimColor color={!p.color ? undefined : p.textMuted}>
            New: theworld chat (or /session delete)
          </Text>
          <Text dimColor color={!p.color ? undefined : p.textMuted}>
            Settings: Ctrl+,
          </Text>
        </Section>
      </Box>

      <Section title="Shell">
        <Text dimColor color={!p.color ? undefined : p.textMuted}>
          Enter send · Shift+↵/Ctrl+O line · /help
        </Text>
      </Section>
      <TuiBox flexDirection="column" flexGrow={1} minHeight={0} width="100%" />
    </TuiBox>
  )
}
