import { isInteractiveChatInput } from './chat-input.js'
import { colorEnabled, S } from './style.js'

const ASCII_FRAMES = ['-', '\\', '|', '/'] as const
const BRAILLE_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const
const DOTS_FRAMES = ['.', '..', '...', ' ..', '  .', '   '] as const

function envSpinnerMode(): 'ascii' | 'dots' | 'braille' {
  const v = process.env.THEWORLD_CHAT_SPINNER?.trim().toLowerCase()
  if (v === 'dots' || v === 'braille' || v === 'ascii') return v
  return 'ascii'
}

/** Braille only when TTY interactive path, colors on, not dumb (054 Phase E). */
function effectiveMode(): 'ascii' | 'dots' | 'braille' {
  const want = envSpinnerMode()
  if (want === 'braille' && (!isInteractiveChatInput() || !colorEnabled)) {
    return 'ascii'
  }
  return want
}

function framesFor(mode: 'ascii' | 'dots' | 'braille'): readonly string[] {
  if (mode === 'dots') return DOTS_FRAMES
  if (mode === 'braille') return BRAILLE_FRAMES
  return ASCII_FRAMES
}

const TICK_MS = 120

/**
 * Inline “thinking” spinner for `streamRun` waits (054 Phase E).
 * Uses `THEWORLD_CHAT_SPINNER=ascii|dots|braille`; `braille` falls back to `ascii` when not TTY or colors off.
 */
export function createChatThinkingSpinner(caption = 'Thinking'): {
  begin(): void
  end(): void
} {
  const frames = [...framesFor(effectiveMode())]
  let frameIdx = 0
  let intervalId: ReturnType<typeof setInterval> | undefined

  const tick = (): void => {
    if (!intervalId) return
    const sym = frames[frameIdx % frames.length]!
    frameIdx++
    const left = colorEnabled ? `${S.yellow}${sym}${S.reset}` : sym
    process.stderr.write(`\r${left} ${caption}...  `)
  }

  return {
    begin(): void {
      if (intervalId !== undefined) return
      frameIdx = 0
      intervalId = setInterval(tick, TICK_MS)
      tick()
    },
    end(): void {
      if (intervalId === undefined) return
      clearInterval(intervalId)
      intervalId = undefined
      process.stderr.write('\r\x1b[K')
    },
  }
}
