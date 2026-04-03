import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve, normalize } from 'node:path'
import { createRunError } from '@openkin/shared-contracts'
import type { ToolDefinition, ToolExecutor, ToolExecutionContext } from '../tool-runtime.js'
import type { ToolResult } from '@openkin/shared-contracts'

const MAX_OUTPUT_BYTES = 64 * 1024 // 64 KB per stream
const SCRIPT_TIMEOUT_MS = 30_000   // 30 seconds

/** Allowed environment variable keys forwarded to Skill subprocess */
const ENV_ALLOWLIST = ['SKILL_ARGS', 'SKILL_ID', 'NODE_ENV', 'PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP']

function getSkillsDir(): string {
  const workspaceDir = process.env.OPENKIN_WORKSPACE_DIR ?? join(process.cwd(), 'workspace')
  return join(workspaceDir, 'skills')
}

function buildSafeEnv(skillId: string, args: Record<string, unknown>): Record<string, string> {
  const safe: Record<string, string> = {}
  for (const key of ENV_ALLOWLIST) {
    const val = process.env[key]
    if (val !== undefined) safe[key] = val
  }
  safe.SKILL_ID = skillId
  safe.SKILL_ARGS = JSON.stringify(args)
  return safe
}

function runProcess(scriptPath: string, env: Record<string, string>): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve_) => {
    const child = spawn('pnpm', ['exec', 'tsx', scriptPath], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd(),
    })

    let stdoutBuf = ''
    let stderrBuf = ''
    let stdoutTruncated = false
    let stderrTruncated = false

    child.stdout.on('data', (chunk: Buffer) => {
      const remaining = MAX_OUTPUT_BYTES - Buffer.byteLength(stdoutBuf)
      if (remaining <= 0) {
        stdoutTruncated = true
        return
      }
      stdoutBuf += chunk.toString('utf8', 0, Math.min(chunk.length, remaining))
      if (Buffer.byteLength(stdoutBuf) >= MAX_OUTPUT_BYTES) stdoutTruncated = true
    })

    child.stderr.on('data', (chunk: Buffer) => {
      const remaining = MAX_OUTPUT_BYTES - Buffer.byteLength(stderrBuf)
      if (remaining <= 0) {
        stderrTruncated = true
        return
      }
      stderrBuf += chunk.toString('utf8', 0, Math.min(chunk.length, remaining))
      if (Buffer.byteLength(stderrBuf) >= MAX_OUTPUT_BYTES) stderrTruncated = true
    })

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolve_({
        stdout: stdoutBuf + (stdoutTruncated ? '\n[truncated]' : ''),
        stderr: stderrBuf + '\n[TIMEOUT: script exceeded 30 seconds]',
        exitCode: 124,
      })
    }, SCRIPT_TIMEOUT_MS)

    child.on('close', (code) => {
      clearTimeout(timer)
      resolve_({
        stdout: stdoutBuf + (stdoutTruncated ? '\n[truncated]' : ''),
        stderr: stderrBuf + (stderrTruncated ? '\n[truncated]' : ''),
        exitCode: code ?? 1,
      })
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      resolve_({ stdout: '', stderr: err.message, exitCode: 1 })
    })
  })
}

export const runScriptToolDefinition: ToolDefinition = {
  name: 'run_script',
  description:
    'Execute a script file inside a Skill directory. Read the SKILL.md first to understand the expected args and script filename. Inline code execution is not supported in this version.',
  inputSchema: {
    type: 'object',
    properties: {
      skillId: { type: 'string', description: 'The skill-id whose directory contains the script' },
      script: { type: 'string', description: 'Script filename relative to the skill directory (e.g. weather.ts)' },
      args: {
        type: 'object',
        description: 'Arguments to pass to the script via SKILL_ARGS environment variable (JSON)',
        additionalProperties: true,
      },
    },
    required: ['skillId', 'script'],
  },
}

export const runScriptToolExecutor: ToolExecutor = {
  async execute(input: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const skillId = input.skillId
    const script = input.script
    const args = (input.args as Record<string, unknown>) ?? {}

    if (typeof skillId !== 'string' || !skillId) {
      return {
        toolCallId: `run_script-${context.stepIndex}`,
        name: 'run_script',
        output: createRunError('TOOL_INVALID_INPUT', 'run_script: skillId must be a non-empty string', 'tool'),
        isError: true,
      }
    }

    if (typeof script !== 'string' || !script) {
      return {
        toolCallId: `run_script-${context.stepIndex}`,
        name: 'run_script',
        output: createRunError('TOOL_INVALID_INPUT', 'run_script: script must be a non-empty string', 'tool'),
        isError: true,
      }
    }

    // inline mode: not supported yet (017 Deno sandbox)
    if ('inline' in input) {
      return {
        toolCallId: `run_script-${context.stepIndex}`,
        name: 'run_script',
        output: createRunError(
          'TOOL_PERMISSION_DENIED',
          'run_script: inline code execution is not supported in this version. Install Deno and upgrade to plan 017 to enable this feature.',
          'tool',
        ),
        isError: true,
      }
    }

    // Security: skillId must not contain path separators
    if (skillId.includes('/') || skillId.includes('\\') || skillId.includes('..')) {
      return {
        toolCallId: `run_script-${context.stepIndex}`,
        name: 'run_script',
        output: createRunError('TOOL_PERMISSION_DENIED', `run_script: invalid skillId "${skillId}"`, 'tool'),
        isError: true,
      }
    }

    const skillsDir = getSkillsDir()
    const skillDir = resolve(join(skillsDir, skillId))
    const scriptPath = resolve(join(skillDir, script))

    // Security: ensure scriptPath is within skillsDir
    const normalizedSkillsDir = normalize(resolve(skillsDir))
    const normalizedScript = normalize(scriptPath)
    if (!normalizedScript.startsWith(normalizedSkillsDir + '/') && normalizedScript !== normalizedSkillsDir) {
      return {
        toolCallId: `run_script-${context.stepIndex}`,
        name: 'run_script',
        output: createRunError(
          'TOOL_PERMISSION_DENIED',
          `run_script: path traversal detected – script must be within the skills directory`,
          'tool',
        ),
        isError: true,
      }
    }

    // Check file exists
    if (!existsSync(scriptPath)) {
      return {
        toolCallId: `run_script-${context.stepIndex}`,
        name: 'run_script',
        output: createRunError(
          'TOOL_EXECUTION_FAILED',
          `run_script: script file not found: ${script} in skill ${skillId}`,
          'tool',
        ),
        isError: true,
      }
    }

    const env = buildSafeEnv(skillId, args)

    const { stdout, stderr, exitCode } = await runProcess(scriptPath, env)

    return {
      toolCallId: `run_script-${context.stepIndex}`,
      name: 'run_script',
      output: { stdout, stderr, exitCode },
      isError: exitCode !== 0,
    }
  },
}
