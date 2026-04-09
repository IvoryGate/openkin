import * as readline from 'node:readline'
import { describeFetchError } from '@theworld/core'
import { createOpenKinClient, type StreamEvent } from '@theworld/client-sdk'
import type { CliContext } from './args.js'
import { CLI_CHAT_TITLE } from './branding.js'
import { println } from './io.js'
import { runSlashCommand } from './slash-chat.js'
import { S, label, line as hrule } from './style.js'

function writePrompt(): void {
  process.stdout.write(`${S.bold}${S.cyan}You${S.reset}${S.bold}: ${S.reset}`)
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

function readLines(): AsyncIterableIterator<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
    terminal: false,
  })

  const buffer: string[] = []
  let done = false
  const waiters: Array<(value: IteratorResult<string>) => void> = []

  rl.on('line', (ln: string) => {
    if (waiters.length > 0) {
      waiters.shift()!({ value: ln, done: false })
    } else {
      buffer.push(ln)
    }
  })

  rl.on('close', () => {
    done = true
    for (const waiter of waiters) {
      waiter({ value: '', done: true })
    }
    waiters.length = 0
  })

  return {
    [Symbol.asyncIterator]() {
      return this
    },
    next(): Promise<IteratorResult<string>> {
      if (buffer.length > 0) {
        return Promise.resolve({ value: buffer.shift()!, done: false })
      }
      if (done) {
        return Promise.resolve({ value: '', done: true })
      }
      return new Promise(resolve => {
        waiters.push(resolve)
      })
    },
  }
}

async function runChatTurn(ctx: CliContext, sessionId: string, text: string): Promise<void> {
  const client = createOpenKinClient({
    baseUrl: ctx.baseUrl,
    apiKey: ctx.apiKey,
  })
  const frames = ['-', '\\', '|', '/']
  let frameIdx = 0
  let spinning = true
  let streamingAnswer = false

  const spinnerInterval = setInterval(() => {
    if (!spinning) return
    process.stdout.write(`\r${S.yellow}${frames[frameIdx % frames.length]} Thinking...${S.reset}  `)
    frameIdx++
  }, 120)

  const stopSpinner = (): void => {
    if (!spinning) return
    spinning = false
    clearInterval(spinnerInterval)
    process.stdout.write('\r\x1b[K')
  }

  try {
    println(`${S.dim}--- run start ---${S.reset}`)
    await client.streamRun({ sessionId, input: { text } }, (event: StreamEvent) => {
      if (event.type === 'text_delta') {
        if (!streamingAnswer) {
          stopSpinner()
          streamingAnswer = true
          process.stdout.write(`${S.bold}${S.green}${label('agent')}Agent${S.reset}${S.bold}: ${S.reset}`)
        }
        const payload = event.payload as { delta?: string }
        if (payload.delta) {
          process.stdout.write(payload.delta)
        }
        return
      }

      if (event.type === 'tool_call') {
        stopSpinner()
        streamingAnswer = false
        for (const toolCall of event.payload as Array<{ name: string; input: unknown }>) {
          printToolCall(toolCall.name, toolCall.input)
        }
        spinning = true
        frameIdx = 0
        return
      }

      if (event.type === 'tool_result') {
        stopSpinner()
        streamingAnswer = false
        const result = event.payload as {
          name: string
          output: unknown
          isError?: boolean
        }
        printToolResult(result.name, result.output, result.isError ?? false)
        spinning = true
        frameIdx = 0
        return
      }

      if (event.type === 'message') {
        stopSpinner()
        streamingAnswer = false
        const payload = event.payload as { text?: string }
        if (payload.text) {
          printThinking(payload.text)
        }
        spinning = true
        frameIdx = 0
        return
      }

      if (event.type === 'run_completed') {
        stopSpinner()
        if (streamingAnswer) {
          process.stdout.write('\n')
          streamingAnswer = false
          println(`${S.dim}--- run end ---${S.reset}`)
          return
        }
        const payload = event.payload as {
          output?: { content: Array<{ type: string; text?: string }> }
        }
        const finalText = (payload.output?.content ?? [])
          .filter(part => part.type === 'text')
          .map(part => part.text ?? '')
          .join('')
          .trim()
        if (finalText) {
          println(
            `${S.bold}${S.green}${label('agent')}Agent${S.reset}${S.bold}: ${S.reset}${finalText}`,
          )
        }
        println(`${S.dim}--- run end ---${S.reset}`)
        return
      }

      if (event.type === 'run_failed') {
        stopSpinner()
        if (streamingAnswer) {
          process.stdout.write('\n')
          streamingAnswer = false
        }
        const payload = event.payload as {
          error?: { message?: string; code?: string }
          message?: string
        }
        const errorMessage = payload.error?.message ?? payload.message ?? 'Unknown error'
        const code = payload.error?.code ? ` [${payload.error.code}]` : ''
        println(
          `${S.red}${label('error')}Run failed${code}: ${errorMessage}${S.reset}`,
        )
        println(
          `${S.dim}Tip: theworld inspect health  ·  theworld sessions messages <id>${S.reset}`,
        )
        println(`${S.dim}--- run end ---${S.reset}`)
      }
    })
  } finally {
    stopSpinner()
    if (streamingAnswer) {
      process.stdout.write('\n')
      println(`${S.dim}--- run end ---${S.reset}`)
    }
  }
}

function parseChatArgs(args: string[]): { sessionId?: string } {
  let sessionId: string | undefined
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--session') {
      const id = args[i + 1]
      if (!id) {
        throw new Error('Missing value for --session')
      }
      sessionId = id
      i++
    }
  }
  return { sessionId }
}

export async function runChatCommand(ctx: CliContext, args: string[]): Promise<void> {
  if (ctx.json) {
    throw new Error('`chat` does not support --json in the basic CLI.')
  }

  const { sessionId: existingId } = parseChatArgs(args)

  const client = createOpenKinClient({
    baseUrl: ctx.baseUrl,
    apiKey: ctx.apiKey,
  })

  println()
  println(hrule())
  println(`${S.bold}${S.cyan}${CLI_CHAT_TITLE}${S.reset}  ${S.dim}(server: ${ctx.baseUrl})${S.reset}`)
  println(hrule())
  println(
    `${S.dim}Messages go to the server; lines starting with / are local slash commands (/help).${S.reset}`,
  )
  println(`${S.dim}Quit: /exit  or  exit  ·  Ctrl+C${S.reset}`)
  println(hrule('·'))
  println()

  let sessionId: string
  try {
    if (existingId) {
      await client.getSession(existingId)
      sessionId = existingId
    } else {
      const session = await client.createSession({ kind: 'chat' })
      sessionId = session.id
    }
  } catch (error: unknown) {
    const message = describeFetchError(error)
    if (existingId) {
      println(`${S.red}Session not found or unreachable: ${message}${S.reset}`)
      println(`${S.dim}List ids: theworld sessions list${S.reset}`)
    } else {
      println(`${S.red}Cannot connect to server: ${message}${S.reset}`)
      println(`${S.dim}Start the server: pnpm dev:server  ·  check URL with theworld inspect health${S.reset}`)
    }
    process.exit(1)
  }

  println(`${S.bold}Session${S.reset}`)
  println(`  ${S.dim}id · ${sessionId}${S.reset}`)
  println(hrule('-', 48))
  println()

  const lines = readLines()
  writePrompt()

  for await (const line of lines) {
    const text = line.trim()

    if (!text) {
      writePrompt()
      continue
    }

    if (text.startsWith('/')) {
      println()
      println(`${S.dim}--- slash ---${S.reset}`)
      const slash = await runSlashCommand(ctx, sessionId, text, s => println(s))
      println(`${S.dim}--- end slash ---${S.reset}`)
      if (slash.kind === 'exit') {
        println()
        println(`${S.dim}Bye!${S.reset}`)
        process.exit(0)
      }
      if (slash.kind === 'new_session') {
        sessionId = slash.sessionId
        println()
        println(`${S.bold}Session${S.reset}`)
        println(`  ${S.dim}id · ${sessionId}${S.reset}`)
        println(hrule('-', 48))
      }
      println()
      writePrompt()
      continue
    }

    if (text.toLowerCase() === 'exit' || text.toLowerCase() === 'quit') {
      println()
      println(`${S.dim}Bye!${S.reset}`)
      process.exit(0)
    }

    println()

    try {
      await runChatTurn(ctx, sessionId, text)
    } catch (error: unknown) {
      println(`${S.red}Error: ${describeFetchError(error)}${S.reset}`)
      println(`${S.dim}Tip: theworld inspect health${S.reset}`)
    }

    println()
    writePrompt()
  }

  println()
  println(`${S.dim}Bye!${S.reset}`)
}
