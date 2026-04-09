import { spawn } from 'node:child_process'
import type { ToolDefinition, ToolExecutor, ToolExecutionContext } from '../tool-runtime.js'
import type { ToolResult } from '@theworld/shared-contracts'
import { createRunError } from '@theworld/shared-contracts'
import { readCompatEnv } from '../env.js'

const MAX_OUTPUT_BYTES = 64 * 1024  // 64 KB per stream
const CMD_TIMEOUT_MS  = 30_000     // 30 s

/** Allowed env vars forwarded to subprocess */
const ENV_ALLOWLIST = ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'USER', 'LANG', 'LC_ALL', 'NODE_ENV']

function buildEnv(): Record<string, string> {
  const safe: Record<string, string> = {}
  for (const key of ENV_ALLOWLIST) {
    const val = process.env[key]
    if (val !== undefined) safe[key] = val
  }
  return safe
}

function runProcess(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve_) => {
    const child = spawn(command, args, {
      env: buildEnv(),
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    })

    let stdoutBuf = ''
    let stderrBuf = ''
    let stdoutTruncated = false
    let stderrTruncated = false

    child.stdout.on('data', (chunk: Buffer) => {
      const rem = MAX_OUTPUT_BYTES - Buffer.byteLength(stdoutBuf)
      if (rem <= 0) { stdoutTruncated = true; return }
      stdoutBuf += chunk.toString('utf8', 0, Math.min(chunk.length, rem))
      if (Buffer.byteLength(stdoutBuf) >= MAX_OUTPUT_BYTES) stdoutTruncated = true
    })

    child.stderr.on('data', (chunk: Buffer) => {
      const rem = MAX_OUTPUT_BYTES - Buffer.byteLength(stderrBuf)
      if (rem <= 0) { stderrTruncated = true; return }
      stderrBuf += chunk.toString('utf8', 0, Math.min(chunk.length, rem))
      if (Buffer.byteLength(stderrBuf) >= MAX_OUTPUT_BYTES) stderrTruncated = true
    })

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolve_({
        stdout: stdoutBuf + (stdoutTruncated ? '\n[truncated]' : ''),
        stderr: stderrBuf + '\n[TIMEOUT: command exceeded 30 seconds]',
        exitCode: 124,
      })
    }, CMD_TIMEOUT_MS)

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

/** Split a shell command string into [executable, ...args], respecting quotes. */
function shellSplit(cmd: string): string[] {
  const result: string[] = []
  let current = ''
  let inSingle = false
  let inDouble = false

  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i]
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble
    } else if (ch === ' ' && !inSingle && !inDouble) {
      if (current) { result.push(current); current = '' }
    } else {
      current += ch
    }
  }
  if (current) result.push(current)
  return result
}

export const runCommandToolDefinition: ToolDefinition = {
  name: 'run_command',
  description:
    'Execute a shell command and return stdout, stderr, and exit code. ' +
    'Use this to run scripts (e.g. `python3 file.py`), list directories (`ls -la /path`), ' +
    'check files (`cat file.txt`), or any other CLI task. ' +
    'Provide `cwd` to set the working directory; if omitted, defaults to the server process root (NOT /workspace). ' +
    'Always use absolute paths — the system prompt tells you the exact workspaceDir and projectDir. ' +
    'Timeout: 30 seconds.',
  inputSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to run, e.g. "python3 script.py" or "ls -la /tmp"',
      },
      cwd: {
        type: 'string',
        description:
          'Working directory for the command (must be an absolute path). ' +
          'If omitted, defaults to the server process root — usually not what you want. ' +
          'Use the workspaceDir value from the system prompt instead.',
      },
    },
    required: ['command'],
  },
}

export const runCommandToolExecutor: ToolExecutor = {
  async execute(input: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const raw = input.command
    if (typeof raw !== 'string' || !raw.trim()) {
      return {
        toolCallId: `run_command-${context.stepIndex}`,
        name: 'run_command',
        output: createRunError('TOOL_INVALID_INPUT', 'run_command: command must be a non-empty string', 'tool'),
        isError: true,
      }
    }

    const parts = shellSplit(raw.trim())
    if (parts.length === 0) {
      return {
        toolCallId: `run_command-${context.stepIndex}`,
        name: 'run_command',
        output: createRunError('TOOL_INVALID_INPUT', 'run_command: empty command', 'tool'),
        isError: true,
      }
    }

    // Reject command chaining / injection metacharacters: | ; & ` $() but NOT plain hyphens or flags
    // Specifically: block pipe, semicolon, ampersand, backtick, subshell $()
    if (/[|;&`]/.test(raw) || /\$\(/.test(raw)) {
      return {
        toolCallId: `run_command-${context.stepIndex}`,
        name: 'run_command',
        output: createRunError(
          'TOOL_PERMISSION_DENIED',
          'run_command: shell metacharacters (|, ;, &, `, $()) are not allowed. ' +
          'Create a Skill script instead if you need piping or redirection.',
          'tool',
        ),
        isError: true,
      }
    }

    const workspaceDir =
      readCompatEnv('THEWORLD_WORKSPACE_DIR', 'OPENKIN_WORKSPACE_DIR') ?? (process.cwd() + '/workspace')
    const cwd = typeof input.cwd === 'string' && input.cwd.trim() ? input.cwd.trim() : process.cwd()

    const [executable, ...args] = parts
    const { stdout, stderr, exitCode } = await runProcess(executable, args, cwd)

    return {
      toolCallId: `run_command-${context.stepIndex}`,
      name: 'run_command',
      output: { stdout, stderr, exitCode, cwd },
      isError: exitCode !== 0,
    }
  },
}
