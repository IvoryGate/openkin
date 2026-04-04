import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve, normalize, dirname } from 'node:path'
import { createRunError } from '@openkin/shared-contracts'
import type { ToolDefinition, ToolExecutor, ToolExecutionContext } from '../tool-runtime.js'
import type { ToolResult } from '@openkin/shared-contracts'

const SKILL_ID_RE = /^[a-z0-9-]+$/

function getSkillsDir(): string {
  const workspaceDir = process.env.OPENKIN_WORKSPACE_DIR ?? join(process.cwd(), 'workspace')
  return join(workspaceDir, 'skills')
}

/**
 * Safely resolve a file path within `<skillsDir>/<skillId>/`.
 * Returns null if the resolved path escapes the skill directory.
 */
function safeResolveInSkill(skillsDir: string, skillId: string, filename: string): string | null {
  const skillDir = resolve(join(skillsDir, skillId))
  const filePath = resolve(join(skillDir, filename))
  const normalizedSkillDir = normalize(skillDir) + '/'
  const normalizedFile = normalize(filePath)
  if (!normalizedFile.startsWith(normalizedSkillDir) && normalizedFile !== normalize(skillDir)) {
    return null
  }
  return filePath
}

export const writeSkillToolDefinition: ToolDefinition = {
  name: 'write_skill',
  description: `Create or update a Skill under workspace/skills/. Writes SKILL.md (with YAML frontmatter) and optional script files. After writing, call read_skill to verify, then run_script to test. skillId must match [a-z0-9-]+.

CRITICAL: Skill scripts run with tsx (TypeScript/ESM). They MUST follow these rules:
1. Only import Node.js built-in modules (node:child_process, node:fs, node:path, node:url, etc.) — NO custom shared utilities exist.
2. Read args from: const args = JSON.parse(process.env.SKILL_ARGS || '{}')
3. Use __dirname via: import { fileURLToPath } from 'node:url'; import { dirname, join } from 'node:path'; const __dirname = dirname(fileURLToPath(import.meta.url));
4. To run an external command (e.g. python3), use node:child_process spawn — do NOT import any helper like run_command/commandUtils (they don't exist).

Minimal working script template (run.ts):
---
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
const __dirname = dirname(fileURLToPath(import.meta.url))
const args = JSON.parse(process.env.SKILL_ARGS || '{}')
const n = args.n ?? 10
const child = spawn('python3', [join(__dirname, 'script.py'), String(n)], { stdio: ['ignore','pipe','pipe'] })
child.stdout.on('data', (c) => process.stdout.write(c))
child.stderr.on('data', (c) => process.stderr.write(c))
child.on('close', (code) => process.exit(code ?? 0))
child.on('error', (e) => { process.stderr.write(e.message); process.exit(1) })
---

Pure-TypeScript skill (no subprocess):
---
const args = JSON.parse(process.env.SKILL_ARGS || '{}')
const result = { answer: 42 }
process.stdout.write(JSON.stringify(result) + '\\n')
---`,
  inputSchema: {
    type: 'object',
    properties: {
      skillId: {
        type: 'string',
        description: 'Skill directory name. Must match [a-z0-9-]+.',
      },
      skillMd: {
        type: 'string',
        description: 'Full contents of SKILL.md including YAML frontmatter.',
      },
      scripts: {
        type: 'array',
        description: 'Optional list of script files to write alongside SKILL.md.',
        items: {
          type: 'object',
          properties: {
            filename: { type: 'string', description: 'Filename relative to skill directory (e.g. run.ts)' },
            content: { type: 'string', description: 'File contents' },
          },
          required: ['filename', 'content'],
        },
      },
    },
    required: ['skillId', 'skillMd'],
  },
}

export const writeSkillToolExecutor: ToolExecutor = {
  async execute(input: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const skillId = input.skillId
    const skillMd = input.skillMd
    const scripts = input.scripts

    // Validate skillId
    if (typeof skillId !== 'string' || !skillId) {
      return {
        toolCallId: `write_skill-${context.stepIndex}`,
        name: 'write_skill',
        output: createRunError('TOOL_INVALID_INPUT', 'write_skill: skillId must be a non-empty string', 'tool'),
        isError: true,
      }
    }
    if (!SKILL_ID_RE.test(skillId)) {
      return {
        toolCallId: `write_skill-${context.stepIndex}`,
        name: 'write_skill',
        output: createRunError(
          'TOOL_INVALID_INPUT',
          `write_skill: skillId "${skillId}" is invalid. Must match [a-z0-9-]+.`,
          'tool',
        ),
        isError: true,
      }
    }

    if (typeof skillMd !== 'string' || !skillMd.trim()) {
      return {
        toolCallId: `write_skill-${context.stepIndex}`,
        name: 'write_skill',
        output: createRunError('TOOL_INVALID_INPUT', 'write_skill: skillMd must be a non-empty string', 'tool'),
        isError: true,
      }
    }

    // Validate scripts array shape
    type ScriptEntry = { filename: string; content: string }
    let scriptEntries: ScriptEntry[] = []
    if (scripts !== undefined) {
      if (!Array.isArray(scripts)) {
        return {
          toolCallId: `write_skill-${context.stepIndex}`,
          name: 'write_skill',
          output: createRunError('TOOL_INVALID_INPUT', 'write_skill: scripts must be an array', 'tool'),
          isError: true,
        }
      }
      for (const s of scripts as unknown[]) {
        const entry = s as Record<string, unknown>
        if (typeof entry.filename !== 'string' || typeof entry.content !== 'string') {
          return {
            toolCallId: `write_skill-${context.stepIndex}`,
            name: 'write_skill',
            output: createRunError(
              'TOOL_INVALID_INPUT',
              'write_skill: each script entry must have filename (string) and content (string)',
              'tool',
            ),
            isError: true,
          }
        }
        if (entry.filename.includes('..') || entry.filename.startsWith('/')) {
          return {
            toolCallId: `write_skill-${context.stepIndex}`,
            name: 'write_skill',
            output: createRunError(
              'TOOL_PERMISSION_DENIED',
              `write_skill: script filename "${entry.filename}" contains path traversal`,
              'tool',
            ),
            isError: true,
          }
        }
        scriptEntries.push({ filename: entry.filename, content: entry.content })
      }
    }

    const skillsDir = getSkillsDir()
    const skillDir = resolve(join(skillsDir, skillId))

    // Write all files
    const filesWritten: string[] = []
    try {
      // Write SKILL.md
      const mdPath = join(skillDir, 'SKILL.md')
      await mkdir(dirname(mdPath), { recursive: true })
      await writeFile(mdPath, skillMd, 'utf8')
      filesWritten.push('SKILL.md')

      // Write optional scripts
      for (const entry of scriptEntries) {
        const filePath = safeResolveInSkill(skillsDir, skillId, entry.filename)
        if (!filePath) {
          return {
            toolCallId: `write_skill-${context.stepIndex}`,
            name: 'write_skill',
            output: createRunError(
              'TOOL_PERMISSION_DENIED',
              `write_skill: path traversal detected for script "${entry.filename}"`,
              'tool',
            ),
            isError: true,
          }
        }
        await mkdir(dirname(filePath), { recursive: true })
        await writeFile(filePath, entry.content, 'utf8')
        filesWritten.push(entry.filename)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        toolCallId: `write_skill-${context.stepIndex}`,
        name: 'write_skill',
        output: createRunError('TOOL_EXECUTION_FAILED', `write_skill: failed to write files: ${msg}`, 'tool'),
        isError: true,
      }
    }

    return {
      toolCallId: `write_skill-${context.stepIndex}`,
      name: 'write_skill',
      output: {
        path: skillDir,
        filesWritten,
      },
      isError: false,
    }
  },
}
