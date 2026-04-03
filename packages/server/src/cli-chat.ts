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

const RESET  = '\x1b[0m'
const BOLD   = '\x1b[1m'
const DIM    = '\x1b[2m'
const CYAN   = '\x1b[36m'
const GREEN  = '\x1b[32m'
const YELLOW = '\x1b[33m'
const GRAY   = '\x1b[90m'
const RED    = '\x1b[31m'

function println(text = ''): void {
  process.stdout.write(text + '\n')
}

function writePrompt(): void {
  process.stdout.write(`${BOLD}${CYAN}You${RESET}${BOLD}: ${RESET}`)
}

function printToolCall(name: string, input: unknown): void {
  const inputStr = JSON.stringify(input)
  const truncated = inputStr.length > 120 ? inputStr.slice(0, 120) + '…' : inputStr
  println(`${GRAY}  ⚙  ${name}(${truncated})${RESET}`)
}

function printToolResult(name: string, output: unknown, isError: boolean): void {
  const raw = JSON.stringify(output)
  const truncated = raw.length > 200 ? raw.slice(0, 200) + '…' : raw
  const icon = isError ? `${RED}✗${RESET}` : `${GREEN}✓${RESET}`
  println(`${GRAY}  ${icon} ${name} → ${truncated}${RESET}`)
}

/** Collect lines from stdin as an async iterable; resolves null on EOF */
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
      if (buf.length > 0) {
        return Promise.resolve({ value: buf.shift()!, done: false })
      }
      if (done) {
        return Promise.resolve({ value: '', done: true })
      }
      return new Promise((resolve) => {
        waiters.push(resolve)
      })
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
    spinning = false
    clearInterval(spinnerInterval)
    process.stdout.write('\r\x1b[K')
  }

  try {
    await client.streamRun(
      { sessionId, input: { text } },
      (event: StreamEvent) => {
        if (event.type === 'tool_call') {
          stopSpinner()
          for (const tc of event.payload as Array<{ name: string; input: unknown }>) {
            printToolCall(tc.name, tc.input)
          }
        } else if (event.type === 'tool_result') {
          const result = event.payload as { name: string; output: unknown; isError?: boolean }
          printToolResult(result.name, result.output, result.isError ?? false)
        } else if (event.type === 'run_completed') {
          stopSpinner()
          const payload = event.payload as {
            output?: { content: Array<{ type: string; text?: string }> }
          }
          const finalText = (payload.output?.content ?? [])
            .filter((p) => p.type === 'text')
            .map((p) => p.text ?? '')
            .join('')
          if (finalText) {
            println(`${BOLD}${GREEN}Agent${RESET}${BOLD}: ${RESET}${finalText}`)
          }
        } else if (event.type === 'run_failed') {
          stopSpinner()
          const payload = event.payload as { message?: string; error?: { message?: string } }
          println(
            `${RED}✗ Run failed: ${payload.error?.message ?? payload.message ?? 'Unknown error'}${RESET}`,
          )
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

  // Connect to server
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

  // EOF (Ctrl+D)
  println()
  println(`${DIM}Bye!${RESET}`)
  process.exit(0)
}

chat().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  process.stderr.write(`chat error: ${msg}\n`)
  process.exit(1)
})
