import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createRunError } from '@theworld/shared-contracts'
import type { ToolDefinition, ToolExecutor, ToolExecutionContext } from '../tool-runtime.js'
import { readEnv } from '../env.js'
import type { ToolResult } from '@theworld/shared-contracts'

export interface SkillEntry {
  skillId: string
  description: string
  path: string
}

/**
 * Parse YAML frontmatter from SKILL.md content.
 * Returns { 'skill-id': ..., description: ... } or null if not found.
 */
function parseFrontmatter(content: string): Record<string, string> | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!match) return null
  const fm: Record<string, string> = {}
  const lines = match[1].split('\n')
  let currentKey = ''
  let multilineValue = ''
  let inMultiline = false
  for (const line of lines) {
    if (inMultiline) {
      if (line.startsWith('  ') || line.startsWith('\t')) {
        multilineValue += (multilineValue ? '\n' : '') + line.trim()
        continue
      } else {
        fm[currentKey] = multilineValue
        inMultiline = false
        multilineValue = ''
      }
    }
    const colonIdx = line.indexOf(':')
    if (colonIdx < 0) continue
    const key = line.slice(0, colonIdx).trim()
    const val = line.slice(colonIdx + 1).trim()
    if (val === '|') {
      currentKey = key
      inMultiline = true
      multilineValue = ''
    } else {
      fm[key] = val
    }
  }
  if (inMultiline && currentKey) {
    fm[currentKey] = multilineValue
  }
  return fm
}

function getSkillsDir(): string {
  const workspaceDir =
    readEnv('THEWORLD_WORKSPACE_DIR') ?? join(process.cwd(), 'workspace')
  return join(workspaceDir, 'skills')
}

export async function listSkills(): Promise<SkillEntry[]> {
  const skillsDir = getSkillsDir()
  let entries: string[] = []
  try {
    entries = await readdir(skillsDir)
  } catch {
    return []
  }
  const skills: SkillEntry[] = []
  for (const entry of entries) {
    const skillPath = join(skillsDir, entry)
    const mdPath = join(skillPath, 'SKILL.md')
    try {
      const content = await readFile(mdPath, 'utf8')
      const fm = parseFrontmatter(content)
      const skillId = fm?.['skill-id'] ?? entry
      const description = fm?.description?.trim() ?? ''
      skills.push({ skillId, description, path: resolve(skillPath) })
    } catch {
      // Skip skills with no readable SKILL.md
    }
  }
  return skills
}

export const listSkillsToolDefinition: ToolDefinition = {
  name: 'list_skills',
  description:
    'List all available Skills and their short descriptions (fallback tool; normally Skill descriptions are injected into System Prompt).',
  metadata: { surfaceCategory: 'skill' },
  inputSchema: {
    type: 'object',
    properties: {},
  },
}

export const listSkillsToolExecutor: ToolExecutor = {
  async execute(_input: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const skills = await listSkills()
      return {
        toolCallId: `list_skills-${context.stepIndex}`,
        name: 'list_skills',
        output: { skills },
        isError: false,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        toolCallId: `list_skills-${context.stepIndex}`,
        name: 'list_skills',
        output: createRunError('TOOL_EXECUTION_FAILED', `list_skills failed: ${msg}`, 'tool'),
        isError: true,
      }
    }
  },
}
