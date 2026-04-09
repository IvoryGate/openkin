import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createRunError } from '@theworld/shared-contracts'
import type { ToolDefinition, ToolExecutor, ToolExecutionContext } from '../tool-runtime.js'
import { readCompatEnv } from '../env.js'
import type { ToolResult } from '@theworld/shared-contracts'

function getSkillsDir(): string {
  const workspaceDir =
    readCompatEnv('THEWORLD_WORKSPACE_DIR', 'OPENKIN_WORKSPACE_DIR') ?? join(process.cwd(), 'workspace')
  return join(workspaceDir, 'skills')
}

export const readSkillToolDefinition: ToolDefinition = {
  name: 'read_skill',
  description:
    'Read the full SKILL.md content of a specific Skill. Use this to understand how to invoke the Skill before calling run_script.',
  inputSchema: {
    type: 'object',
    properties: {
      skillId: { type: 'string', description: 'The skill-id as listed in the System Prompt or list_skills output' },
    },
    required: ['skillId'],
  },
}

export const readSkillToolExecutor: ToolExecutor = {
  async execute(input: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const skillId = input.skillId
    if (typeof skillId !== 'string' || !skillId) {
      return {
        toolCallId: `read_skill-${context.stepIndex}`,
        name: 'read_skill',
        output: createRunError('TOOL_INVALID_INPUT', 'read_skill: skillId must be a non-empty string', 'tool'),
        isError: true,
      }
    }

    // Security: skillId must not contain path separators
    if (skillId.includes('/') || skillId.includes('\\') || skillId.includes('..')) {
      return {
        toolCallId: `read_skill-${context.stepIndex}`,
        name: 'read_skill',
        output: createRunError('TOOL_PERMISSION_DENIED', `read_skill: invalid skillId "${skillId}"`, 'tool'),
        isError: true,
      }
    }

    const skillsDir = getSkillsDir()
    const mdPath = join(skillsDir, skillId, 'SKILL.md')

    try {
      const content = await readFile(mdPath, 'utf8')
      return {
        toolCallId: `read_skill-${context.stepIndex}`,
        name: 'read_skill',
        output: { skillId, content },
        isError: false,
      }
    } catch {
      return {
        toolCallId: `read_skill-${context.stepIndex}`,
        name: 'read_skill',
        output: createRunError(
          'TOOL_EXECUTION_FAILED',
          `read_skill: Skill "${skillId}" not found or SKILL.md unreadable`,
          'tool',
        ),
        isError: true,
      }
    }
  },
}
