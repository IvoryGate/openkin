/**
 * cli-chat.ts — interactive terminal chat client for OpenKin
 *
 * Usage:
 *   pnpm chat                        # connects to http://127.0.0.1:3333
 *   OPENKIN_SERVER_URL=http://... pnpm chat
 *
 * Requires the server to be running first: pnpm dev:server
 */
import * as readline from 'node:readline'
import { createOpenKinClient } from '@openkin/client-sdk'
import type { StreamEvent } from '@openkin/client-sdk'

const BASE_URL = process.env.OPENKIN_SERVER_URL ?? 'http://127.0.0.1:3333'

const RESET   = '\x1b[0m'
const BOLD    = '\x1b[1m'
const DIM     = '\x1b[2m'
const ITALIC  = '\x1b[3m'
const CYAN    = '\x1b[36m'
const GREEN   = '\x1b[32m'
const YELLOW  = '\x1b[33m'
const GRAY    = '\x1b[90m'
const RED     = '\x1b[31m'
const MAGENTA = '\x1b[35m'

function println(text = ''): void {
  process.stdout.write(text + '\n')
}

function writePrompt(): void {
  process.stdout.write(`${BOLD}${CYAN}You${RESET}${BOLD}: ${RESET}`)
}

function printToolCall(name: string, input: unknown): void {
  const inputStr = JSON.stringify(input)
  const truncated = inputStr.length > 160 ? inputStr.slice(0, 160) + '…' : inputStr
  println(`${GRAY}  ⚙  ${BOLD}${name}${RESET}${GRAY}(${truncated})${RESET}`)
}

/** Format tool result — if stdout is present, show it inline instead of raw JSON */
function printToolResult(name: string, output: unknown, isError: boolean): void {
  const icon = isError ? `${RED}✗${RESET}` : `${GREEN}✓${RESET}`

  // If output has a stdout field (run_command, run_script), show that directly
  if (output && typeof output === 'object' && 'stdout' in (output as object)) {
    const out = output as { stdout?: string; stderr?: string; exitCode?: number }
    const stdout = (out.stdout ?? '').trim()
    const stderr = (out.stderr ?? '').trim()
    const exit = out.exitCode ?? 0

    if (isError || exit !== 0) {
      println(`${GRAY}  ${icon} ${name} (exit ${exit})${RESET}`)
      if (stderr) {
        for (const line of stderr.split('\n').slice(0, 8)) {
          println(`${RED}     ${line}${RESET}`)
        }
      }
      if (stdout) {
        for (const line of stdout.split('\n').slice(0, 8)) {
          println(`${GRAY}     ${line}${RESET}`)
        }
      }
    } else {
      println(`${GRAY}  ${icon} ${name}${RESET}`)
      if (stdout) {
        for (const line of stdout.split('\n').slice(0, 20)) {
          println(`${GRAY}     ${line}${RESET}`)
        }
        if (stdout.split('\n').length > 20) {
          println(`${GRAY}     … (truncated)${RESET}`)
        }
      }
    }
    return
  }

  // Generic output: compact JSON
  const raw = JSON.stringify(output)
  const truncated = raw.length > 300 ? raw.slice(0, 300) + '…' : raw
  println(`${GRAY}  ${icon} ${name} → ${truncated}${RESET}`)
}

/** Print Agent intermediate thinking text (shown between tool calls) */
function printThinking(text: string): void {
  const lines = text.trim().split('\n')
  println(`${MAGENTA}  💭 ${ITALIC}${lines[0]}${RESET}`)
  for (const line of lines.slice(1)) {
    if (line.trim()) println(`${MAGENTA}     ${ITALIC}${line}${RESET}`)
  }
}

/** Collect lines from stdin as an async iterable */
function readLines(): AsyncIterableIterator<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
    terminal: false,
  })

  const buf: string[] = []
  let done = false
  const waiters: Array<(value: IteratorResult<string>) => void> = []

  rl.on('line', (line: string) => {
    if (waiters.length > 0) {
      waiters.shift()!({ value: line, done: false })
    } else {
      buf.push(line)
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
    [Symbol.asyncIterator]() { return this },
    next(): Promise<IteratorResult<string>> {
      if (buf.length > 0) return Promise.resolve({ value: buf.shift()!, done: false })
      if (done) return Promise.resolve({ value: '', done: true })
      return new Promise((resolve) => { waiters.push(resolve) })
    },
  }
}

async function runTurn(
  client: ReturnType<typeof createOpenKinClient>,
  sessionId: string,
  text: string,
): Promise<void> {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  let frameIdx = 0
  let spinning = true

  const spinnerInterval = setInterval(() => {
    if (!spinning) return
    process.stdout.write(`\r${YELLOW}${frames[frameIdx % frames.length]} Thinking…${RESET}  `)
    frameIdx++
  }, 80)

  const stopSpinner = (): void => {
    if (!spinning) return
    spinning = false
    clearInterval(spinnerInterval)
    process.stdout.write('\r\x1b[K')
  }

  try {
    await client.streamRun(
      { sessionId, input: { text } },
      (event: StreamEvent) => {
        // Each event arrives in real time as the run progresses

        if (event.type === 'tool_call') {
          stopSpinner()
          for (const tc of event.payload as Array<{ name: string; input: unknown }>) {
            printToolCall(tc.name, tc.input)
          }
          // Restart spinner to show we're waiting for the tool result
          spinning = true
          frameIdx = 0

        } else if (event.type === 'tool_result') {
          stopSpinner()
          const result = event.payload as { name: string; output: unknown; isError?: boolean }
          printToolResult(result.name, result.output, result.isError ?? false)
          // Restart spinner — Agent will now process the result and think again
          spinning = true
          frameIdx = 0

        } else if (event.type === 'message') {
          // Intermediate Agent reasoning text (emitted before/between tool calls)
          stopSpinner()
          const payload = event.payload as { text?: string; role?: string }
          const msg = payload.text?.trim()
          if (msg) printThinking(msg)
          // Restart spinner if more work is expected
          spinning = true
          frameIdx = 0

        } else if (event.type === 'run_completed') {
          stopSpinner()
          const payload = event.payload as {
            output?: { content: Array<{ type: string; text?: string }> }
          }
          const finalText = (payload.output?.content ?? [])
            .filter((p) => p.type === 'text')
            .map((p) => p.text ?? '')
            .join('')
            .trim()
          if (finalText) {
            println(`${BOLD}${GREEN}Agent${RESET}${BOLD}: ${RESET}${finalText}`)
          }

        } else if (event.type === 'run_failed') {
          stopSpinner()
          const payload = event.payload as {
            error?: { message?: string; code?: string }
            message?: string
          }
          const errMsg = payload.error?.message ?? payload.message ?? 'Unknown error'
          const code = payload.error?.code ? ` [${payload.error.code}]` : ''
          println(`${RED}✗ Run failed${code}: ${errMsg}${RESET}`)
        }
      },
    )
  } finally {
    stopSpinner()
  }
}

async function chat(): Promise<void> {
  const client = createOpenKinClient({ baseUrl: BASE_URL })

  println()
  println(`${BOLD}${CYAN}OpenKin Chat${RESET}  ${DIM}(server: ${BASE_URL})${RESET}`)
  println(`${DIM}Type your message and press Enter. Ctrl+C or "exit" to quit.${RESET}`)
  println()

  let sessionId: string
  try {
    const session = await client.createSession({ kind: 'chat' })
    sessionId = session.id
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    println(`${RED}✗ Cannot connect to server: ${msg}${RESET}`)
    println(`${DIM}  Make sure the server is running: pnpm dev:server${RESET}`)
    process.exit(1)
  }
  println(`${DIM}Session: ${sessionId}${RESET}`)
  println()

  const lines = readLines()
  writePrompt()

  for await (const line of lines) {
    const text = line.trim()

    if (!text) {
      writePrompt()
      continue
    }

    if (text.toLowerCase() === 'exit' || text.toLowerCase() === 'quit') {
      println()
      println(`${DIM}Bye!${RESET}`)
      process.exit(0)
    }

    println()

    try {
      await runTurn(client, sessionId, text)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      println(`${RED}✗ Error: ${msg}${RESET}`)
    }

    println()
    writePrompt()
  }

  println()
  println(`${DIM}Bye!${RESET}`)
  process.exit(0)
}

chat().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  process.stderr.write(`chat error: ${msg}\n`)
  process.exit(1)
})
