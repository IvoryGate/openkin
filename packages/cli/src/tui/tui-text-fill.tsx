/**
 * 081：对标 OpenCode 在 `box` 上设 `backgroundColor` 的**可绘制**效果；Ink 下用 `Text`+空格
 * 铺满一列，保证 Warp 等环境也能看到**色带**（界面仍使用 {@link tui-ink-palette} / 设计文档，非 OpenCode 皮肤）。
 */
import React from 'react'
import { Text } from 'ink'
import { useTuiPalette } from './tui-theme-context.js'

export type TuiTextFillProps = {
  width: number
  backgroundColor: string
  char?: string
}

export function TuiTextFill({ width, backgroundColor, char = ' ' }: TuiTextFillProps): React.ReactElement | null {
  const p = useTuiPalette()
  if (!p.color) {
    return null
  }
  const w = Math.max(0, Math.min(512, width))
  if (w === 0) {
    return null
  }
  return (
    <Text backgroundColor={backgroundColor} wrap="truncate-end">
      {char.repeat(w)}
    </Text>
  )
}
