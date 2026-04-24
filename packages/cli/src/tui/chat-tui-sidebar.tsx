import React from 'react'
import { Box, Text } from 'ink'
import { ink } from '../style.js'
import type { ChatTuiContextStats } from './chat-tui-statusbar.js'
import type { TuiRunPhase } from './tui-run-phase.js'
import { formatTuiRunPhase } from './tui-run-phase.js'

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
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(0, max - 1))}…`
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={ink.panelBorder} paddingX={1} paddingY={0}>
      <Text bold color={ink.accent}>
        {title}
      </Text>
      {children}
    </Box>
  )
}

function kv(label: string, value: string, color?: string): React.ReactElement {
  return (
    <Text>
      <Text color={ink.muted}>{label}</Text>
      <Text dimColor> · </Text>
      <Text color={color}>{value}</Text>
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
}: ChatTuiSidebarProps): React.ReactElement {
  const title = displayName?.trim() || alias?.trim() || shortId
  const aliasLabel = alias?.trim() && alias?.trim() !== displayName?.trim() ? alias.trim() : '-'
  const contextLabel = context ? `${context.msgs} msgs · ~${context.chars} chars` : 'ctx unavailable'

  return (
    <Box flexDirection="column" width={width} minWidth={26}>
      <Box marginBottom={1}>
        <Section title="Thread">
          <Text bold color={ink.focus}>
            {truncate(title, width - 6)}
          </Text>
          {kv('alias', truncate(aliasLabel, width - 10))}
          {kv('id', shortId)}
        </Section>
      </Box>

      <Box marginBottom={1}>
        <Section title="Runtime">
          {kv(
            'phase',
            formatTuiRunPhase(runPhase),
            runPhase === 'failed' ? ink.danger : runPhase === 'streaming' ? ink.assistant : ink.accent,
          )}
          {kv('host', truncate(host, width - 10))}
          {kv('model', truncate(modelEnv || '-', width - 10))}
          {kv('agent', truncate(agentId || '-', width - 10))}
          {kv('context', truncate(contextLabel, width - 10))}
        </Section>
      </Box>

      <Section title="Shell">
        <Text dimColor>Enter send</Text>
        <Text dimColor>Up/Down scroll transcript</Text>
        <Text dimColor>Tab complete slash</Text>
        <Text dimColor>/help local commands</Text>
        <Text dimColor>exit or Ctrl+C quit</Text>
      </Section>
    </Box>
  )
}
