/**
 * Ink 5 `Box` 类型未包含 `backgroundColor`，但运行时会将 style 传给 `ink-box`；用于主题色块。
 */
import React from 'react'
import { Box } from 'ink'
import type { BoxProps } from 'ink'

/** `BoxProps` in ink 5 omits `children` from the exported alias; include it for JSX. */
export type TuiBoxProps = BoxProps & { backgroundColor?: string; children?: React.ReactNode }

export function TuiBox({ backgroundColor, ...rest }: TuiBoxProps): React.ReactElement {
  return (
    <Box
      {...(rest as BoxProps)}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Ink forwards backgroundColor; BoxProps typings omit it.
      {...(backgroundColor !== undefined ? { backgroundColor } : {}) as any}
    />
  )
}
