import * as readline from 'node:readline'
import * as tty from 'node:tty'
import { completeSlashLine } from './slash-complete.js'

export function isInteractiveChatInput(): boolean {
  return Boolean(
    tty.isatty(0) &&
      (tty.isatty(1) || tty.isatty(2)) &&
      !process.env.CI &&
      process.env.THEWORLD_CHAT_PLAIN_INPUT !== '1',
  )
}

/**
 * Async line iterator for chat REPL.
 * TTY: readline with history + slash tab completion (054 Phase C/D).
 * Non-TTY: same behaviour as legacy `readLines()` (pipes / tests).
 */
export function createChatLineReader(): AsyncIterableIterator<string> {
  if (!isInteractiveChatInput()) {
    return createPipeLineReader()
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
    terminal: true,
    historySize: 500,
    completer: (line: string, callback: (err: null, result: [string[], string]) => void) => {
      callback(null, completeSlashLine(line))
    },
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
    for (const w of waiters) {
      w({ value: '', done: true })
    }
    waiters.length = 0
  })

  rl.setPrompt('You: ')

  return {
    [Symbol.asyncIterator]() {
      return this
    },
    next(): Promise<IteratorResult<string>> {
      if (buffer.length > 0) {
        const line = buffer.shift()!
        rl.prompt(true)
        return Promise.resolve({ value: line, done: false })
      }
      if (done) {
        return Promise.resolve({ value: '', done: true })
      }
      rl.prompt(true)
      return new Promise((resolve) => {
        waiters.push((result) => {
          if (!result.done) {
            rl.prompt(true)
          }
          resolve(result)
        })
      })
    },
  }
}

function createPipeLineReader(): AsyncIterableIterator<string> {
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
      return new Promise((resolve) => {
        waiters.push(resolve)
      })
    },
  }
}
