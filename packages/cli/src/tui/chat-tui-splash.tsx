/**
 * TUI splash: Phase 1 line reveal (074), Phase 2 logo breath, Phase 3 CTA + any key / 3s (075).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import { TuiBox } from './tui-box.js'
import { buildSplashPhase1Lines } from './chat-tui-art.js'
import { colorEnabled, motionEnabled } from '../style.js'
import { useTuiPalette } from './tui-theme-context.js'

/** ms between each additional line after the first (first line shows immediately). */
export const SPLASH_LINE_STEP_MS = 100
/** CTA `> ... <` pulse period when color + motion. */
export const SPLASH_CTA_BLINK_MS = 500
/** No key: auto-continue to main TUI. */
export const SPLASH_AUTO_ENTER_MS = 3_000
const BREATH_DIM_MS = 180

export type ChatTuiSplashProps = {
  onComplete: () => void
}

type Stage = 'reveal' | 'breath' | 'wait'

export function ChatTuiSplash({ onComplete }: ChatTuiSplashProps): React.ReactElement {
  const p = useTuiPalette()
  const doneRef = useRef(false)
  const finish = useCallback((): void => {
    if (doneRef.current) return
    doneRef.current = true
    onComplete()
  }, [onComplete])

  const { stdout } = useStdout()
  const cols = stdout.columns ?? 80
  const rows = stdout.rows ?? 24

  const lines = useMemo(() => buildSplashPhase1Lines(cols), [cols])
  const [stage, setStage] = useState<Stage>('reveal')
  const [visibleCount, setVisibleCount] = useState(0)
  const [logoBreathDim, setLogoBreathDim] = useState(false)
  const [ctaTick, setCtaTick] = useState(0)

  // Phase 1: line reveal
  useEffect(() => {
    if (stage !== 'reveal') return
    if (lines.length === 0) {
      finish()
      return
    }
    setVisibleCount(1)
    if (lines.length === 1) {
      queueMicrotask(() => {
        setStage(motionEnabled ? 'breath' : 'wait')
      })
      return
    }
    let next = 1
    const id = setInterval(() => {
      next += 1
      setVisibleCount(next)
      if (next >= lines.length) {
        clearInterval(id)
        setStage(motionEnabled ? 'breath' : 'wait')
      }
    }, SPLASH_LINE_STEP_MS)
    return () => clearInterval(id)
  }, [stage, lines.length, finish, motionEnabled])

  // Phase 2: Logo 呼吸 ×2（每輪 亮 → 暗 → 亮，對齊 TUI_DESKTOP_DESIGN_SPEC §2.2.1）
  useEffect(() => {
    if (stage !== 'breath') return
    setLogoBreathDim(false)
    const t1 = setTimeout(() => {
      setLogoBreathDim(true)
    }, BREATH_DIM_MS)
    const t2 = setTimeout(() => {
      setLogoBreathDim(false)
    }, BREATH_DIM_MS * 2)
    const t3 = setTimeout(() => {
      setLogoBreathDim(true)
    }, BREATH_DIM_MS * 2 + BREATH_DIM_MS)
    const t4 = setTimeout(() => {
      setLogoBreathDim(false)
    }, BREATH_DIM_MS * 2 + BREATH_DIM_MS * 2)
    const t5 = setTimeout(() => {
      setStage('wait')
    }, BREATH_DIM_MS * 2 + BREATH_DIM_MS * 2 + 100)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
      clearTimeout(t5)
    }
  }, [stage])

  // CTA line pulse
  useEffect(() => {
    if (stage !== 'wait' || !motionEnabled) return
    const id = setInterval(() => {
      setCtaTick(t => t + 1)
    }, SPLASH_CTA_BLINK_MS)
    return () => clearInterval(id)
  }, [stage])

  // 3s auto-continue
  useEffect(() => {
    if (stage !== 'wait') return
    const id = setTimeout(finish, SPLASH_AUTO_ENTER_MS)
    return () => clearTimeout(id)
  }, [stage, finish])

  useInput(
    () => {
      finish()
    },
    { isActive: stage === 'wait' },
  )

  const displayLines = stage === 'reveal' ? lines.slice(0, visibleCount) : lines
  const logoTextDim = stage === 'breath' && logoBreathDim
  const showCta = stage === 'wait'
  const ctaPulseDim = motionEnabled ? ctaTick % 2 === 0 : true

  const reserveRows = (showCta ? displayLines.length + 3 : displayLines.length) || 1
  const padTop = Math.max(0, Math.floor((rows - reserveRows) / 2))

  return (
    <TuiBox flexDirection="column" width={cols} height={rows} backgroundColor={p.color ? p.background : undefined}>
      <Box height={padTop} flexShrink={0} />
      <Box flexDirection="column" alignItems="center" width={cols} flexGrow={1}>
        {displayLines.map((line, i) => (
          <Text
            key={i}
            color={colorEnabled && !logoTextDim ? p.brand : undefined}
            dimColor={!!(colorEnabled && logoTextDim)}
          >
            {line}
          </Text>
        ))}
        {showCta ? (
          <Box marginTop={1} justifyContent="center" width={cols}>
            <Text dimColor={!!colorEnabled && ctaPulseDim} color={p.color && colorEnabled && !ctaPulseDim ? p.textMuted : undefined}>
              {'>  Press any key to enter  <'}
            </Text>
          </Box>
        ) : null}
      </Box>
    </TuiBox>
  )
}
