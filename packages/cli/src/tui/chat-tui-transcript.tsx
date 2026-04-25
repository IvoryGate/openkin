import React from 'react'
import { Box, Text } from 'ink'
import { TuiBox } from './tui-box.js'
import { ink } from '../style.js'
import type { TuiTranscriptBlock } from './tui-transcript-model.js'
import { useTuiPalette } from './tui-theme-context.js'

export type ChatTuiTranscriptProps = {
  blocks: TuiTranscriptBlock[]
  assistantStream: string | null
  streamCursor: string
  hiddenBeforeCount?: number
  hiddenAfterCount?: number
}

type BlockMeta = {
  label: string
  labelTone: string | undefined
  textTone: string | undefined
}

function blockMeta(block: TuiTranscriptBlock, p: ReturnType<typeof useTuiPalette>): BlockMeta {
  switch (block.type) {
    case 'user':
      return { label: 'YOU', labelTone: p.userAccent, textTone: p.text }
    case 'assistant':
      return { label: 'ASSISTANT', labelTone: p.assistantAccent, textTone: p.text }
    case 'tool_call':
      return { label: 'TOOL CALL', labelTone: p.toolAccent, textTone: p.text }
    case 'tool_result':
      return {
        label: block.ok ? 'TOOL OK' : 'TOOL ERR',
        labelTone: block.ok ? p.success : p.danger,
        textTone: p.text,
      }
    case 'note':
      return { label: 'NOTE', labelTone: p.textMuted, textTone: p.textMuted }
    case 'error':
      return { label: 'ERROR', labelTone: p.danger, textTone: p.danger }
    case 'system_hint':
      return { label: 'HINT', labelTone: p.textMuted, textTone: p.textMuted }
  }
}

function BlockView({ block }: { block: TuiTranscriptBlock }): React.ReactElement {
  const p = useTuiPalette()
  const m = blockMeta(block, p)

  const labelLine = (
    <Text bold color={m.labelTone ?? undefined}>
      {m.label}
    </Text>
  )

  const blockShell = (opts: { bg: string | undefined; errorRail: boolean; children: React.ReactNode }): React.ReactElement => {
    if (p.color) {
      if (opts.errorRail) {
        return (
          <Box flexDirection="row" width="100%">
            <TuiBox minWidth={3} width={3} backgroundColor={p.errorRail} />
            <TuiBox flexDirection="column" flexGrow={1} backgroundColor={opts.bg} paddingX={1} paddingY={0}>
              {opts.children}
            </TuiBox>
          </Box>
        )
      }
      return (
        <TuiBox flexDirection="column" width="100%" backgroundColor={opts.bg} paddingX={1} paddingY={0}>
          {opts.children}
        </TuiBox>
      )
    }
    return (
      <Box flexDirection="column" width="100%" paddingX={1} paddingY={0}>
        {opts.children}
      </Box>
    )
  }

  switch (block.type) {
    case 'user': {
      const inner = (
        <>
          {labelLine}
          <Text>
            <Text color={p.userAccent ?? ink.user} bold>
              {'> '}
            </Text>
            <Text color={m.textTone ?? undefined}>{block.text}</Text>
          </Text>
        </>
      )
      return blockShell({ bg: p.userMessage, errorRail: false, children: inner })
    }
    case 'assistant':
      return blockShell({
        bg: p.assistantMessage,
        errorRail: false,
        children: (
          <>
            {labelLine}
            <Text color={m.textTone ?? undefined}>{block.text}</Text>
          </>
        ),
      })
    case 'tool_call':
      return blockShell({
        bg: p.toolCall,
        errorRail: false,
        children: (
          <>
            {labelLine}
            <Text bold color={m.textTone ?? undefined}>
              {block.name}
            </Text>
            <Text dimColor color={!p.color ? undefined : p.textMuted}>
              {block.inputSummary}
            </Text>
          </>
        ),
      })
    case 'tool_result':
      return blockShell({
        bg: p.toolResult,
        errorRail: false,
        children: (
          <>
            {labelLine}
            <Text bold color={m.textTone ?? undefined}>
              {block.name}
            </Text>
            <Text color={m.textTone ?? undefined}>{block.summary}</Text>
          </>
        ),
      })
    case 'note':
      return blockShell({
        bg: p.toolResult,
        errorRail: false,
        children: (
          <>
            {labelLine}
            <Text dimColor color={!p.color ? undefined : p.textMuted}>
              {block.text}
            </Text>
          </>
        ),
      })
    case 'error':
      return blockShell({
        bg: p.error,
        errorRail: true,
        children: (
          <>
            {labelLine}
            <Text color={p.danger ?? undefined}>{block.message}</Text>
            {block.tip ? (
              <Text dimColor color={!p.color ? undefined : p.textMuted}>
                {block.tip}
              </Text>
            ) : null}
          </>
        ),
      })
    case 'system_hint':
      return blockShell({
        bg: p.toolCall,
        errorRail: false,
        children: (
          <>
            {labelLine}
            <Text dimColor color={!p.color ? undefined : p.textMuted}>
              {block.text}
            </Text>
          </>
        ),
      })
  }
}

function StreamingView({
  text,
  streamCursor,
}: {
  text: string
  streamCursor: string
}): React.ReactElement {
  const p = useTuiPalette()
  if (p.color) {
    return (
      <TuiBox flexDirection="column" width="100%" backgroundColor={p.assistantMessage} paddingX={1}>
        <Text color={p.assistantAccent} bold>
          STREAMING
        </Text>
        <Text color={p.text}>
          {text}
          {streamCursor ? <Text dimColor color={p.textMuted}>{streamCursor}</Text> : null}
        </Text>
      </TuiBox>
    )
  }
  return (
    <Box flexDirection="column" width="100%" paddingX={1}>
      <Text color={ink.assistant} bold>
        STREAMING
      </Text>
      <Text>
        {text}
        {streamCursor ? <Text dimColor>{streamCursor}</Text> : null}
      </Text>
    </Box>
  )
}

export function ChatTuiTranscript({
  blocks,
  assistantStream,
  streamCursor,
  hiddenBeforeCount = 0,
  hiddenAfterCount = 0,
}: ChatTuiTranscriptProps): React.ReactElement {
  const p = useTuiPalette()
  return (
    <Box flexDirection="column" width="100%">
      {hiddenBeforeCount > 0 ? (
        <Text dimColor={!p.color} color={p.textMuted ?? undefined}>
          ↑ {hiddenBeforeCount} earlier block{hiddenBeforeCount === 1 ? '' : 's'} above
        </Text>
      ) : null}
      {blocks.map(b => (
        <Box key={b.id} flexDirection="column" marginBottom={1} width="100%">
          <BlockView block={b} />
        </Box>
      ))}
      {assistantStream !== null ? <StreamingView text={assistantStream} streamCursor={streamCursor} /> : null}
      {hiddenAfterCount > 0 ? (
        <Text dimColor={!p.color} color={p.textMuted ?? undefined}>
          ↓ {hiddenAfterCount} newer block{hiddenAfterCount === 1 ? '' : 's'} below
        </Text>
      ) : null}
    </Box>
  )
}
