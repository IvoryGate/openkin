export type ParsedChatArgs = {
  sessionId?: string
  continueLatest: boolean
  pick: boolean
  initialText?: string
}

export function parseChatArgs(args: string[]): ParsedChatArgs {
  let sessionId: string | undefined
  let continueLatest = false
  let pick = false
  const remaining: string[] = []

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--session' || a === '--resume') {
      const id = args[i + 1]
      if (!id) {
        throw new Error(`Missing value for ${a}`)
      }
      sessionId = id
      i++
      continue
    }
    if (a === '-c' || a === '--continue') {
      continueLatest = true
      continue
    }
    if (a === '--pick') {
      pick = true
      continue
    }
    remaining.push(a)
  }

  if (pick && (sessionId != null || continueLatest)) {
    throw new Error('Cannot combine --pick with --resume/--session or --continue')
  }

  const unknownFlag = remaining.find(x => x.startsWith('-'))
  if (unknownFlag) {
    throw new Error(`Unknown chat option: ${unknownFlag}`)
  }

  const initialText = remaining.length > 0 ? remaining.join(' ') : undefined
  return { sessionId, continueLatest, pick, initialText }
}
