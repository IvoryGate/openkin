import React, { createContext, useContext } from 'react'
import { getTuiPalette, type TuiPalette } from './tui-ink-palette.js'
import { colorEnabled } from '../style.js'

const TuiThemeContext = createContext<TuiPalette | null>(null)

export type TuiThemeProviderProps = {
  value?: TuiPalette
  /** 当未传 value 时用 themeId + 终端能力生成 */
  themeId?: string
  children: React.ReactNode
}

export function TuiThemeProvider({ value, themeId = 'dark', children }: TuiThemeProviderProps): React.ReactElement {
  const v = value ?? getTuiPalette(themeId, colorEnabled)
  return <TuiThemeContext.Provider value={v}>{children}</TuiThemeContext.Provider>
}

export function useTuiPalette(): TuiPalette {
  const p = useContext(TuiThemeContext)
  if (!p) {
    return getTuiPalette('dark', colorEnabled)
  }
  return p
}
