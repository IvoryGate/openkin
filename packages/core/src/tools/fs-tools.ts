/**
 * fs-tools.ts — basic filesystem tools: read_file, write_file, list_dir
 *
 * These are intentionally simple and direct; security guards (path checks, size
 * limits) are applied inline.  The agent can use these for ad-hoc file
 * reading / writing outside of the Skill sandbox.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ToolDefinition, ToolExecutor, ToolExecutionContext } from '../tool-runtime.js'
import type { ToolResult } from '@theworld/shared-contracts'
import { createRunError } from '@theworld/shared-contracts'
import { assertPathAllowedForTools } from '../workspace-path.js'

const MAX_READ_BYTES = 256 * 1024   // 256 KB
const MAX_WRITE_BYTES = 1024 * 1024 // 1 MB

// ---------------------------------------------------------------------------
// read_file
// ---------------------------------------------------------------------------

export const readFileToolDefinition: ToolDefinition = {
  name: 'read_file',
  description:
    'Use when: you need file contents from an **absolute path** under the project or workspace roots. ' +
    "Don't use when: the path is outside allowed roots, binary inspection beyond 256KB, or secrets you should not load into context. " +
    'Returns text (or base64) up to 256 KB.',
  metadata: { surfaceCategory: 'filesystem' },
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute path to the file to read.' },
      encoding: {
        type: 'string',
        description: 'File encoding, default "utf8". Use "base64" for binary files.',
        enum: ['utf8', 'base64'],
      },
    },
    required: ['path'],
  },
}

export const readFileToolExecutor: ToolExecutor = {
  async execute(input: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const filePath = input.path
    if (typeof filePath !== 'string' || !filePath.trim()) {
      return {
        toolCallId: `read_file-${context.stepIndex}`,
        name: 'read_file',
        output: createRunError('TOOL_INVALID_INPUT', 'read_file: path must be a non-empty string', 'tool'),
        isError: true,
      }
    }

    const resolved = path.resolve(filePath)

    try {
      assertPathAllowedForTools(resolved)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        toolCallId: `read_file-${context.stepIndex}`,
        name: 'read_file',
        output: createRunError('TOOL_PERMISSION_DENIED', msg, 'tool', { path: resolved }),
        suggestion: 'Use absolute paths under THEWORLD_WORKSPACE_DIR or the project root (see system prompt).',
        isError: true,
      }
    }

    try {
      const stat = fs.statSync(resolved)
      if (stat.isDirectory()) {
        return {
          toolCallId: `read_file-${context.stepIndex}`,
          name: 'read_file',
          output: createRunError('TOOL_EXECUTION_FAILED', `read_file: ${resolved} is a directory, use list_dir instead`, 'tool'),
          isError: true,
        }
      }

      const encoding = input.encoding === 'base64' ? 'base64' : 'utf8'
      let content: string
      let truncated = false

      if (stat.size > MAX_READ_BYTES) {
        const buf = Buffer.alloc(MAX_READ_BYTES)
        const fd = fs.openSync(resolved, 'r')
        try {
          fs.readSync(fd, buf, 0, MAX_READ_BYTES, 0)
        } finally {
          fs.closeSync(fd)
        }
        content = buf.toString(encoding)
        truncated = true
      } else {
        content = fs.readFileSync(resolved, encoding)
      }

      return {
        toolCallId: `read_file-${context.stepIndex}`,
        name: 'read_file',
        output: { path: resolved, content, truncated, sizeBytes: stat.size },
        isError: false,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        toolCallId: `read_file-${context.stepIndex}`,
        name: 'read_file',
        output: createRunError('TOOL_EXECUTION_FAILED', `read_file: ${msg}`, 'tool'),
        isError: true,
      }
    }
  },
}

// ---------------------------------------------------------------------------
// write_file
// ---------------------------------------------------------------------------

export const writeFileToolDefinition: ToolDefinition = {
  name: 'write_file',
  description:
    'Use when: creating/updating a text file under workspace or project with explicit absolute path. ' +
    "Don't use when: path escapes allowed roots, content >1MB, or user did not ask for a file write. " +
    'Overwrites existing files.',
  metadata: { surfaceCategory: 'filesystem', riskClass: 'file_mutation' },
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute path to the file to write.' },
      content: { type: 'string', description: 'Text content to write.' },
    },
    required: ['path', 'content'],
  },
}

export const writeFileToolExecutor: ToolExecutor = {
  async execute(input: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const filePath = input.path
    const content = input.content

    if (typeof filePath !== 'string' || !filePath.trim()) {
      return {
        toolCallId: `write_file-${context.stepIndex}`,
        name: 'write_file',
        output: createRunError('TOOL_INVALID_INPUT', 'write_file: path must be a non-empty string', 'tool'),
        isError: true,
      }
    }
    if (typeof content !== 'string') {
      return {
        toolCallId: `write_file-${context.stepIndex}`,
        name: 'write_file',
        output: createRunError('TOOL_INVALID_INPUT', 'write_file: content must be a string', 'tool'),
        isError: true,
      }
    }
    if (Buffer.byteLength(content) > MAX_WRITE_BYTES) {
      return {
        toolCallId: `write_file-${context.stepIndex}`,
        name: 'write_file',
        output: createRunError('TOOL_INVALID_INPUT', 'write_file: content exceeds 1 MB limit', 'tool'),
        isError: true,
      }
    }

    const resolved = path.resolve(filePath)

    try {
      assertPathAllowedForTools(resolved)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        toolCallId: `write_file-${context.stepIndex}`,
        name: 'write_file',
        output: createRunError('TOOL_PERMISSION_DENIED', msg, 'tool', { path: resolved }),
        suggestion: 'Write only under workspace/ or project paths from the system prompt.',
        isError: true,
      }
    }

    try {
      fs.mkdirSync(path.dirname(resolved), { recursive: true })
      fs.writeFileSync(resolved, content, 'utf8')
      return {
        toolCallId: `write_file-${context.stepIndex}`,
        name: 'write_file',
        output: { path: resolved, bytesWritten: Buffer.byteLength(content) },
        isError: false,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        toolCallId: `write_file-${context.stepIndex}`,
        name: 'write_file',
        output: createRunError('TOOL_EXECUTION_FAILED', `write_file: ${msg}`, 'tool'),
        isError: true,
      }
    }
  },
}

// ---------------------------------------------------------------------------
// list_dir
// ---------------------------------------------------------------------------

export const listDirToolDefinition: ToolDefinition = {
  name: 'list_dir',
  description:
    'Use when: exploring directories before read/write. Absolute path under workspace or project. ' +
    "Don't use when: listing system directories outside allowed roots.",
  metadata: { surfaceCategory: 'filesystem' },
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute path to the directory to list.' },
    },
    required: ['path'],
  },
}

export const listDirToolExecutor: ToolExecutor = {
  async execute(input: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const dirPath = input.path
    if (typeof dirPath !== 'string' || !dirPath.trim()) {
      return {
        toolCallId: `list_dir-${context.stepIndex}`,
        name: 'list_dir',
        output: createRunError('TOOL_INVALID_INPUT', 'list_dir: path must be a non-empty string', 'tool'),
        isError: true,
      }
    }

    const resolved = path.resolve(dirPath)

    try {
      assertPathAllowedForTools(resolved)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        toolCallId: `list_dir-${context.stepIndex}`,
        name: 'list_dir',
        output: createRunError('TOOL_PERMISSION_DENIED', msg, 'tool', { path: resolved }),
        suggestion: 'List only directories under workspace or project roots.',
        isError: true,
      }
    }

    try {
      const stat = fs.statSync(resolved)
      if (!stat.isDirectory()) {
        return {
          toolCallId: `list_dir-${context.stepIndex}`,
          name: 'list_dir',
          output: createRunError('TOOL_EXECUTION_FAILED', `list_dir: ${resolved} is not a directory`, 'tool'),
          isError: true,
        }
      }

      const names = fs.readdirSync(resolved)
      const entries = names.map((name) => {
        try {
          const s = fs.statSync(path.join(resolved, name))
          return {
            name,
            type: s.isDirectory() ? 'directory' : 'file',
            sizeBytes: s.isDirectory() ? null : s.size,
            modifiedAt: s.mtime.toISOString(),
          }
        } catch {
          return { name, type: 'unknown', sizeBytes: null, modifiedAt: null }
        }
      })

      return {
        toolCallId: `list_dir-${context.stepIndex}`,
        name: 'list_dir',
        output: { path: resolved, count: entries.length, entries },
        isError: false,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        toolCallId: `list_dir-${context.stepIndex}`,
        name: 'list_dir',
        output: createRunError('TOOL_EXECUTION_FAILED', `list_dir: ${msg}`, 'tool'),
        isError: true,
      }
    }
  },
}
