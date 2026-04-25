import * as readline from 'node:readline'
import { createTheWorldClient, type SessionDto } from '@theworld/client-sdk'
import { createTheWorldOperatorClient } from '@theworld/operator-client'
import type { CliContext } from './args.js'
import type { ParsedChatArgs } from './chat-args.js'
import { println } from './io.js'
import { getSessionAlias, resolveSessionRef } from './session-alias.js'
import { shortSessionIdLabel } from './chat-status.js'
import { S } from './style.js'

function formatSessionPickLine(s: SessionDto): string {
  const display = s.displayName?.trim()
  const alias = getSessionAlias(s.id)
  const sid = shortSessionIdLabel(s.id)
  if (display) {
    if (alias && alias !== display) {
      return `${display}  ·  ${alias}  ·  ${sid}`
    }
    return `${display}  ·  ${sid}`
  }
  if (alias) {
    return `${alias}  ·  ${sid}`
  }
  return sid
}

/**
 * TTY-only: list recent chat sessions; user picks by 1-based index.
 */
export async function pickRecentChatSession(ctx: CliContext): Promise<string> {
  const client = createTheWorldClient({
    baseUrl: ctx.baseUrl,
    apiKey: ctx.apiKey,
  })
  const { sessions } = await client.listSessions({ kind: 'chat', limit: 20 })
  if (sessions.length === 0) {
    println(`${S.dim}No chat sessions yet. Starting a new session.${S.reset}`)
    const session = await client.createSession({ kind: 'chat' })
    return session.id
  }

  println(`${S.bold}Attach to a thread${S.reset}`)
  println(`${S.dim}Recent chat sessions (displayName · alias · short id)${S.reset}`)
  for (let i = 0; i < sessions.length; i++) {
    println(`  ${i + 1}. ${formatSessionPickLine(sessions[i]!)}`)
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stderr })
  const answer: string = await new Promise(resolve => {
    rl.question(`Choose thread 1–${sessions.length}: `, line => {
      rl.close()
      resolve(line)
    })
  })
  const n = Number.parseInt(answer.trim(), 10)
  if (!Number.isFinite(n) || n < 1 || n > sessions.length) {
    throw new Error(`Invalid choice: expected 1–${sessions.length}`)
  }
  return sessions[n - 1]!.id
}

/**
 * Resolve or create chat session id (shared by line-mode `cmd-chat` and TUI).
 */
export async function resolveChatSessionId(ctx: CliContext, parsed: ParsedChatArgs): Promise<string> {
  const { sessionId: explicitId, continueLatest, pick } = parsed
  if (pick) {
    return pickRecentChatSession(ctx)
  }
  const client = createTheWorldClient({
    baseUrl: ctx.baseUrl,
    apiKey: ctx.apiKey,
  })

  if (explicitId) {
    const resolved = resolveSessionRef(explicitId)
    if (resolved !== explicitId.trim()) {
      println(`${S.dim}Resolved "${explicitId}" → session ${resolved}${S.reset}`)
    }
    await client.getSession(resolved)
    return resolved
  }

  if (continueLatest) {
    const op = createTheWorldOperatorClient({
      baseUrl: ctx.baseUrl,
      apiKey: ctx.apiKey,
    })
    let latestId: string | undefined
    try {
      const data = await client.listSessions({ kind: 'chat', limit: 1 })
      latestId = data.sessions[0]?.id
    } catch {
      const data = await op.getSystemStatus()
      void data
    }
    if (latestId) {
      println(`${S.dim}Continuing latest session: ${latestId}${S.reset}`)
      return latestId
    }
    println(`${S.dim}No recent session found, starting new session.${S.reset}`)
    const session = await client.createSession({ kind: 'chat' })
    return session.id
  }

  const session = await client.createSession({ kind: 'chat' })
  return session.id
}
