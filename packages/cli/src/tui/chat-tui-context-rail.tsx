import React from 'react'
import { Text } from 'ink'
import { useTuiPalette } from './tui-theme-context.js'
import { padStringToWidth } from './tui-pad-to-width.js'
import type { TuiRunPhase } from './tui-run-phase.js'
import { formatTuiRunPhase } from './tui-run-phase.js'
import type { ChatTuiContextStats } from './chat-tui-statusbar.js'

export type ChatTuiContextRailProps = {
  columns: number
  runPhase: TuiRunPhase
  modelEnv: string
  agentId?: string
  context: ChatTuiContextStats | null
  /** L4 101+102: ctx+mem one line from GET /v1/runs/:id/context after last turn */
  l4ContextHint?: string | null
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(0, max - 1))}…`
}

/**
 * OpenCode 式：紧挨在输入框下方的一条**弱对比**带（阶段 · 模型 · 上下文/Agent）。
 * 最底行 {@link ChatTuiStatusBar} 可专注会话/路径/版本（由 `includeModelContext` 去重）。
 */
export function ChatTuiContextRail({
  columns,
  runPhase,
  modelEnv,
  agentId,
  context,
  l4ContextHint,
}: ChatTuiContextRailProps): React.ReactElement | null {
  const p = useTuiPalette()
  const mdl = modelEnv || '-'
  const ag = agentId ? truncate(agentId, 14) : '-'
  const ctx = context === null ? 'ctx ?' : `m${context.msgs} ~${context.chars} ch`
  const l4 = l4ContextHint ? truncate(l4ContextHint, 36) : ''
  const phase = formatTuiRunPhase(runPhase)
  const barBg = p.statusBar ?? p.surface
  const barText = p.textMuted
  const left = ` ${phase}  ·  mdl ${truncate(mdl, 16)}  ·  agt ${ag}  ·  ${ctx}${l4 ? `  ·  ${l4}` : ''}`
  const line = padStringToWidth(truncate(left, columns - 1), Math.max(0, columns))
  if (p.color && barBg) {
    return (
      <Text backgroundColor={barBg} color={barText} dimColor={false} wrap="truncate-end">
        {line}
      </Text>
    )
  }
  return <Text dimColor color={!p.color ? undefined : barText}>{line}</Text>
}
