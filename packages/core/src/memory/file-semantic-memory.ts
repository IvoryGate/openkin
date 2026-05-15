/**
 * Semantic memory from workspace MEMORY.md (208 / thesis §5).
 * Read-only; episodic write stays with L3 or InMemoryMemoryPort.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Message } from '@theworld/shared-contracts'
import type { MemoryPort, MemoryReadRequest, MemoryWriteRequest } from '../context.js'

export interface FileSemanticMemoryPortOptions {
  /** Max characters read from MEMORY.md (token-ish guard). */
  maxChars?: number
}

export class FileSemanticMemoryPort implements MemoryPort {
  private readonly maxChars: number

  constructor(
    private readonly workspaceDir: string,
    options: FileSemanticMemoryPortOptions = {},
  ) {
    this.maxChars = options.maxChars ?? 12_000
  }

  async read(_request: MemoryReadRequest): Promise<Message[]> {
    const file = join(this.workspaceDir, 'MEMORY.md')
    if (!existsSync(file)) {
      return []
    }
    const raw = readFileSync(file, 'utf8').trim()
    if (!raw) return []
    const text = raw.length > this.maxChars ? `${raw.slice(0, this.maxChars)}\n…[truncated]` : raw
    return [
      {
        role: 'system',
        content: [{ type: 'text', text: `Memory summary (MEMORY.md):\n${text}` }],
      },
    ]
  }

  async write(_request: MemoryWriteRequest): Promise<void> {
    // Semantic file is maintained by consolidation / human; L1 port does not auto-append here.
  }
}
