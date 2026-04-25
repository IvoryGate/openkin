/**
 * 080: Settings 占位全屏层（设计稿 §2.2.2 / §4，Ctrl+,）
 */
import React, { useCallback } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import { TuiBox } from './tui-box.js'
import type { TuiFileConfig } from '../tui-config.js'
import { useTuiPalette } from './tui-theme-context.js'

export type ChatTuiSettingsProps = {
  tuiFile: TuiFileConfig
  onClose: () => void
}

export function ChatTuiSettings({ tuiFile, onClose }: ChatTuiSettingsProps): React.ReactElement {
  const p = useTuiPalette()
  const { stdout } = useStdout()
  const cols = stdout.columns ?? 80
  const rows = stdout.rows ?? 24

  const close = useCallback((): void => {
    onClose()
  }, [onClose])

  useInput(
    (input, key) => {
      if (key.escape) {
        close()
        return
      }
      if (key.ctrl && input === ',') {
        close()
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
      <Text bold color={p.color ? p.brand : undefined}>
        TUI settings
      </Text>
      <Text dimColor>Esc or Ctrl+, close</Text>
      <Box marginY={1} flexDirection="column">
        <Text color={p.color ? p.text : undefined}>
          Theme (from .theworld/tui.yaml): {tuiFile.theme}
        </Text>
        <Text dimColor>
          Config: {tuiFile.configFilePath ?? '— (no tui.yaml or unreadable)'}
        </Text>
        <Text dimColor>Sidebar: {tuiFile.showSidebar === undefined ? 'default (on when ≥80 cols)' : tuiFile.showSidebar ? 'on' : 'off'}</Text>
      </Box>
    </TuiBox>
  )
}
