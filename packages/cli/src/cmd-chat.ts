import type { SessionDto } from '@theworld/client-sdk'
import { createTheWorldClient } from '@theworld/client-sdk'
import type { CliContext } from './args.js'
import type { ParsedChatArgs } from './chat-args.js'
import { parseChatArgs } from './chat-args.js'
import { resolveChatSessionId } from './chat-session-resolve.js'
import { createLineChatStreamSink, runChatStreamWithSink } from './chat-stream-sink.js'
import { printChatWelcome, printShellHomeHintsLineMode } from './chat-banner.js'
import { createChatLineReader, isInteractiveChatInput } from './chat-input.js'
import { createChatThinkingSpinner } from './chat-spinner.js'
import { printChatStatusLine, type SessionIdentityHints } from './chat-status.js'
import { println } from './io.js'
import { runSlashCommand } from './slash-chat.js'
import { getSessionAlias, resolveSessionRef } from './session-alias.js'
import { formatCliError } from './errors.js'
import { S, T, label, line as hrule } from './style.js'
import { chatTuiRequested, stripChatTuiArgv } from './tui/chat-tui-flags.js'

function sessionHints(session?: SessionDto): SessionIdentityHints | undefined {
  if (!session?.displayName?.trim()) return undefined
  return { displayName: session.displayName }
}

function printSessionBanner(sessionId: string, session?: SessionDto): void {
  println(`${S.bold}Session${S.reset}`)
  const alias = getSessionAlias(sessionId)
  const display = session?.displayName?.trim()
  if (display) {
    println(`  ${S.bold}${display}${S.reset}`)
  }
  if (alias && alias !== display) {
    println(`  ${S.dim}alias · ${alias}${S.reset}`)
  }
  println(`  ${S.dim}id · ${sessionId}${S.reset}`)
  println(hrule('-', 48))
}

async function fetchSession(ctx: CliContext, sessionId: string): Promise<SessionDto | undefined> {
  try {
    const client = createTheWorldClient({ baseUrl: ctx.baseUrl, apiKey: ctx.apiKey })
    return await client.getSession(sessionId)
  } catch {
    return undefined
  }
}

function writePrompt(): void {
  process.stderr.write(`${S.bold}${T.user}You${S.reset}${S.bold}: ${S.reset}`)
}

function printToolCall(name: string, input: unknown): void {
  const inputStr = JSON.stringify(input)
  const truncated = inputStr.length > 160 ? inputStr.slice(0, 160) + '...' : inputStr
  println(`${S.gray}  ${label('tool')}tool ${name}(${truncated})${S.reset}`)
}

function printToolResult(name: string, output: unknown, isError: boolean): void {
  const status = isError ? `${S.red}x${S.reset}` : `${S.green}ok${S.reset}`

  if (output && typeof output === 'object' && 'stdout' in (output as object)) {
    const out = output as { stdout?: string; stderr?: string; exitCode?: number }
    const stdout = (out.stdout ?? '').trim()
    const stderr = (out.stderr ?? '').trim()
    const exitCode = out.exitCode ?? 0

    println(
      `${S.gray}  ${label('result')}${status} ${name}${exitCode !== 0 ? ` (exit ${exitCode})` : ''}${S.reset}`,
    )
    for (const row of stdout.split('\n').filter(Boolean).slice(0, 12)) {
      println(`${S.gray}     ${row}${S.reset}`)
    }
    for (const row of stderr.split('\n').filter(Boolean).slice(0, 8)) {
      println(`${S.red}     ${row}${S.reset}`)
    }
    return
  }

  const raw = JSON.stringify(output)
  const truncated = raw.length > 300 ? raw.slice(0, 300) + '...' : raw
  println(`${S.gray}  ${label('result')}${status} ${name} -> ${truncated}${S.reset}`)
}

function printThinking(text: string): void {
  const trimmed = text.trim()
  if (!trimmed) return
  for (const ln of trimmed.split('\n')) {
    if (ln.trim()) {
      println(`${S.gray}  ${label('note')}note ${ln}${S.reset}`)
    }
  }
}

async function runChatTurn(ctx: CliContext, sessionId: string, text: string): Promise<void> {
  const thinking = createChatThinkingSpinner()
  const sink = createLineChatStreamSink(println, s => process.stderr.write(s), {
    printToolCall,
    printToolResult,
    printThinking,
  })
  await runChatStreamWithSink(ctx, sessionId, text, sink, thinking)
}

export async function runChatCommand(ctx: CliContext, args: string[]): Promise<void> {
  if (ctx.json) {
    throw new Error('`chat` does not support --json in the basic CLI.')
  }

  const useTui = chatTuiRequested(args)
  const lineArgs = stripChatTuiArgv(args)
  const parsed: ParsedChatArgs = parseChatArgs(lineArgs)

  if (useTui && !isInteractiveChatInput()) {
    throw new Error(
      'Chat TUI (--tui or THEWORLD_CHAT_TUI) requires an interactive terminal (TTY). For pipes and CI, omit --tui and unset THEWORLD_CHAT_TUI.',
    )
  }
  if (useTui && isInteractiveChatInput()) {
    const { runChatTuiSession } = await import('./tui/run-chat-tui.js')
    await runChatTuiSession(ctx, lineArgs)
    return
  }

  if (parsed.pick && !isInteractiveChatInput()) {
    throw new Error(
      'theworld chat --pick requires an interactive terminal (TTY). Use: theworld chat --resume <id|alias>',
    )
  }

  const { sessionId: explicitId, continueLatest, initialText } = parsed

  printChatWelcome(ctx)
  printShellHomeHintsLineMode()

  let sessionId: string
  try {
    sessionId = await resolveChatSessionId(ctx, parsed)
  } catch (error: unknown) {
    const message = formatCliError(error)
    if (explicitId) {
      println(`${S.red}Session not found or unreachable: ${message}${S.reset}`)
      println(`${S.dim}List ids: theworld sessions list${S.reset}`)
    } else {
      println(`${S.red}Cannot connect to server: ${message}${S.reset}`)
      println(`${S.dim}Start the server: pnpm dev:server  ·  check URL with theworld inspect health${S.reset}`)
    }
    process.exit(1)
  }

  let sessionDto = await fetchSession(ctx, sessionId)
  printSessionBanner(sessionId, sessionDto)
  println()
  printChatStatusLine(ctx, sessionId, sessionHints(sessionDto))

  // If an initial text was provided as positional arg, send it automatically
  if (initialText) {
    if (isInteractiveChatInput()) {
      println(`${S.bold}${T.user}You${S.reset}${S.bold}:${S.reset} ${initialText}`)
    } else {
      writePrompt()
      process.stderr.write(`${initialText}\n`)
    }
    println()
    try {
      await runChatTurn(ctx, sessionId, initialText)
    } catch (error: unknown) {
      println(`${S.red}Error: ${formatCliError(error)}${S.reset}`)
      println(`${S.dim}Tip: theworld inspect health${S.reset}`)
    }
    println()
  }

  const lines = createChatLineReader()
  if (!isInteractiveChatInput()) {
    writePrompt()
  }

  for await (const line of lines) {
    const text = line.trim()

    if (!text) {
      if (!isInteractiveChatInput()) {
        writePrompt()
      }
      continue
    }

    if (text.startsWith('/')) {
      println()
      println(`${S.dim}--- slash ---${S.reset}`)
      const slash = await runSlashCommand(ctx, sessionId, text, s => println(s))
      println(`${S.dim}--- end slash ---${S.reset}`)
      if (slash.kind === 'exit') {
        println()
        printlnResumeHint(sessionId)
        println(`${S.dim}Bye!${S.reset}`)
        process.exit(0)
      }
      if (slash.kind === 'new_session') {
        sessionId = slash.sessionId
        sessionDto = await fetchSession(ctx, sessionId)
        println()
        printSessionBanner(sessionId, sessionDto)
        printChatStatusLine(ctx, sessionId, sessionHints(sessionDto))
      }
      if (slash.kind === 'banner_refresh') {
        println()
        sessionDto = await fetchSession(ctx, sessionId)
        printSessionBanner(sessionId, sessionDto)
        printChatStatusLine(ctx, sessionId, sessionHints(sessionDto))
      }
      println()
      if (!isInteractiveChatInput()) {
        writePrompt()
      }
      continue
    }

    if (text.toLowerCase() === 'exit' || text.toLowerCase() === 'quit') {
      println()
      printlnResumeHint(sessionId)
      println(`${S.dim}Bye!${S.reset}`)
      process.exit(0)
    }

    println()

    try {
      await runChatTurn(ctx, sessionId, text)
    } catch (error: unknown) {
      println(`${S.red}Error: ${formatCliError(error)}${S.reset}`)
      println(`${S.dim}Tip: theworld inspect health${S.reset}`)
    }

    println()
    if (!isInteractiveChatInput()) {
      writePrompt()
    }
  }

  println()
  printlnResumeHint(sessionId)
  println(`${S.dim}Bye!${S.reset}`)
}

function printlnResumeHint(sessionId: string): void {
  const alias = getSessionAlias(sessionId)
  const verified =
    alias && resolveSessionRef(alias) === sessionId ? alias : undefined
  println(
    `${S.dim}Resume: theworld chat --resume ${sessionId}${verified ? `  or  theworld chat --resume ${verified}` : ''}${S.reset}`,
  )
}
