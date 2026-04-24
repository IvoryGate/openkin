import React from 'react'
import { Box, Text } from 'ink'
import { ink } from '../style.js'
import type { TuiTranscriptBlock } from './tui-transcript-model.js'

export type ChatTuiTranscriptProps = {
  blocks: TuiTranscriptBlock[]
  assistantStream: string | null
  streamCursor: string
  hiddenBeforeCount?: number
  hiddenAfterCount?: number
}

function labelForBlock(block: TuiTranscriptBlock): { label: string; color?: string; borderColor?: string } {
  switch (block.type) {
    case 'user':
      return { label: 'YOU', color: ink.user, borderColor: ink.user }
    case 'assistant':
      return { label: 'ASSISTANT', color: ink.assistant, borderColor: ink.assistant }
    case 'tool_call':
      return { label: 'TOOL CALL', color: ink.tool, borderColor: ink.tool }
    case 'tool_result':
      return { label: block.ok ? 'TOOL OK' : 'TOOL ERR', color: block.ok ? ink.success : ink.danger, borderColor: block.ok ? ink.success : ink.danger }
    case 'note':
      return { label: 'NOTE', color: ink.muted, borderColor: ink.panelBorder }
    case 'error':
      return { label: 'ERROR', color: ink.danger, borderColor: ink.danger }
    case 'system_hint':
      return { label: 'HINT', color: ink.muted, borderColor: ink.panelBorder }
  }
}

function BlockView({ block }: { block: TuiTranscriptBlock }): React.ReactElement {
  const meta = labelForBlock(block)
  switch (block.type) {
    case 'user':
      return (
        <Box flexDirection="column" borderStyle="round" borderColor={meta.borderColor} paddingX={1}>
          <Text color={meta.color} bold>
            {meta.label}
          </Text>
          <Text>{block.text}</Text>
        </Box>
      )
    case 'assistant':
      return (
        <Box flexDirection="column" borderStyle="round" borderColor={meta.borderColor} paddingX={1}>
          <Text color={meta.color} bold>
            {meta.label}
          </Text>
          <Text>{block.text}</Text>
        </Box>
      )
    case 'tool_call':
      return (
        <Box flexDirection="column" borderStyle="round" borderColor={meta.borderColor} paddingX={1}>
          <Text color={meta.color} bold>
            {meta.label}
          </Text>
          <Text bold>{block.name}</Text>
          <Text dimColor>{block.inputSummary}</Text>
        </Box>
      )
    case 'tool_result':
      return (
        <Box flexDirection="column" borderStyle="round" borderColor={meta.borderColor} paddingX={1}>
          <Text color={meta.color} bold>
            {meta.label}
          </Text>
          <Text bold>{block.name}</Text>
          <Text>{block.summary}</Text>
        </Box>
      )
    case 'note':
      return (
        <Box flexDirection="column" borderStyle="round" borderColor={meta.borderColor} paddingX={1}>
          <Text color={meta.color} bold>
            {meta.label}
          </Text>
          <Text dimColor>{block.text}</Text>
        </Box>
      )
    case 'error':
      return (
        <Box flexDirection="column" borderStyle="round" borderColor={meta.borderColor} paddingX={1}>
          <Text color={meta.color} bold>
            {meta.label}
          </Text>
          <Text>{block.message}</Text>
          {block.tip ? <Text dimColor>{block.tip}</Text> : null}
        </Box>
      )
    case 'system_hint':
      return (
        <Box flexDirection="column" borderStyle="round" borderColor={meta.borderColor} paddingX={1}>
          <Text color={meta.color} bold>
            {meta.label}
          </Text>
          <Text dimColor>{block.text}</Text>
        </Box>
      )
  }
}

export function ChatTuiTranscript({
  blocks,
  assistantStream,
  streamCursor,
  hiddenBeforeCount = 0,
  hiddenAfterCount = 0,
}: ChatTuiTranscriptProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      {hiddenBeforeCount > 0 ? (
        <Text dimColor>↑ {hiddenBeforeCount} earlier block{hiddenBeforeCount === 1 ? '' : 's'} above</Text>
      ) : null}
      {blocks.map(b => (
        <Box key={b.id} flexDirection="column" marginBottom={1}>
          <BlockView block={b} />
        </Box>
      ))}
      {assistantStream !== null ? (
        <Box flexDirection="column" borderStyle="round" borderColor={ink.assistant} paddingX={1}>
          <Text color={ink.assistant} bold>
            STREAMING
          </Text>
          <Text>
            {assistantStream}
            {streamCursor ? <Text dimColor>{streamCursor}</Text> : null}
          </Text>
        </Box>
      ) : null}
      {hiddenAfterCount > 0 ? (
        <Text dimColor>↓ {hiddenAfterCount} newer block{hiddenAfterCount === 1 ? '' : 's'} below</Text>
      ) : null}
    </Box>
  )
}
