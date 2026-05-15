/**
 * Episodic → semantic consolidation with archive-first rollback (208 / thesis §5).
 */
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Message } from '@theworld/shared-contracts'

export interface ConsolidationOptions {
  workspaceDir: string
  sessionId: string
  messages: Message[]
  /** Produce summary text to append to MEMORY.md */
  summarize: (messages: Message[]) => Promise<string>
  /** When true, simulates summarize failure (tests only). */
  forceFailure?: boolean
}

export interface ConsolidationResult {
  ok: boolean
  archivedPath: string
  memoryUpdated: boolean
  error?: string
}

function safeJsonLine(obj: unknown): string {
  return `${JSON.stringify(obj)}\n`
}

export async function archiveAndConsolidateEpisodic(
  options: ConsolidationOptions,
): Promise<ConsolidationResult> {
  const archiveDir = join(options.workspaceDir, 'memory', 'archive')
  mkdirSync(archiveDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const archivedPath = join(archiveDir, `${options.sessionId}-${stamp}.jsonl`)
  for (const m of options.messages) {
    appendFileSync(archivedPath, safeJsonLine(m), 'utf8')
  }

  if (options.forceFailure) {
    return { ok: false, archivedPath, memoryUpdated: false, error: 'forced_failure' }
  }

  try {
    const summary = await options.summarize(options.messages)
    ensureMemoryFileSeed(options.workspaceDir)
    const memoryFile = join(options.workspaceDir, 'MEMORY.md')
    const header = '\n\n## Consolidated session notes\n'
    appendFileSync(memoryFile, `${header}${summary}\n`, 'utf8')
    return { ok: true, archivedPath, memoryUpdated: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, archivedPath, memoryUpdated: false, error: msg }
  }
}

/** Initialize MEMORY.md if missing (idempotent). */
export function ensureMemoryFileSeed(workspaceDir: string): void {
  const memoryFile = join(workspaceDir, 'MEMORY.md')
  if (existsSync(memoryFile)) return
  mkdirSync(join(workspaceDir, 'memory', 'archive'), { recursive: true })
  writeFileSync(
    memoryFile,
    `# MEMORY.md\n\nLong-lived facts the operator wants the agent to recall.\nFilled by consolidation or edited manually.\n`,
    'utf8',
  )
}
