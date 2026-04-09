import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { join, resolve, normalize, basename } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { createRunError } from '@theworld/shared-contracts'
import type { ToolDefinition, ToolExecutor, ToolExecutionContext } from '../tool-runtime.js'
import type { ToolResult } from '@theworld/shared-contracts'
import { mirrorCompatEnv, readCompatEnv } from '../env.js'

const MAX_OUTPUT_BYTES = 64 * 1024 // 64 KB per stream
const SCRIPT_TIMEOUT_MS = 30_000   // 30 seconds

// ─── Deno availability (cached) ─────────────────────────────────────────────

/** `undefined` = not yet checked, `string` = deno binary path, `null` = not available */
let denoPathCache: string | null | undefined = undefined

/**
 * Locate the `deno` binary.
 * Checks PATH first, then common installation locations (~/.deno/bin/deno).
 * Result is cached for the lifetime of the process.
 */
function getDenoPath(): string | null {
  if (denoPathCache !== undefined) return denoPathCache

  // Try common explicit locations before relying on PATH
  // Check common explicit install locations first (existsSync is synchronous and fast)
  const fileCandidates = [
    process.env.DENO_INSTALL ? `${process.env.DENO_INSTALL}/bin/deno` : null,
    `${process.env.HOME ?? ''}/.deno/bin/deno`,
    '/usr/local/bin/deno',
    '/usr/bin/deno',
  ].filter(Boolean) as string[]

  for (const candidate of fileCandidates) {
    if (existsSync(candidate)) {
      denoPathCache = candidate
      return denoPathCache
    }
  }

  // Fallback: try PATH-based `deno`
  try {
    const probe = spawnSync('deno', ['--version'], { timeout: 5000, encoding: 'utf8' })
    if (probe.status === 0) {
      denoPathCache = 'deno'
      return denoPathCache
    }
  } catch {
    // ignore
  }

  denoPathCache = null
  return null
}

// ─── Workspace helpers ───────────────────────────────────────────────────────

function getWorkspaceDir(): string {
  return readCompatEnv('THEWORLD_WORKSPACE_DIR', 'OPENKIN_WORKSPACE_DIR') ?? join(process.cwd(), 'workspace')
}

function getSkillsDir(): string {
  return join(getWorkspaceDir(), 'skills')
}

// ─── SKILL.md frontmatter parser ────────────────────────────────────────────

interface SkillPermissions {
  read: string[]
  net: string[]
  write: string[]
  env: string[]
}

const DEFAULT_PERMISSIONS: SkillPermissions = {
  read: ['.'],
  net: [],
  write: [],
  env: ['SKILL_ARGS', 'SKILL_ID'],
}

/**
 * Parse YAML-ish frontmatter from SKILL.md.
 * Only extracts the `permissions` block; does NOT require a full YAML parser.
 * Format:
 *   ---
 *   permissions:
 *     read: ["."]
 *     net: ["api.example.com:443"]
 *     write: []
 *     env: ["MY_KEY"]
 *   ---
 */
function parsePermissions(skillMdContent: string): SkillPermissions {
  // Extract frontmatter block
  const fmMatch = skillMdContent.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!fmMatch) return { ...DEFAULT_PERMISSIONS }

  const fmText = fmMatch[1]

  // Find permissions block
  const permMatch = fmText.match(/permissions:\s*\n([\s\S]*?)(?=\n\S|$)/)
  if (!permMatch) return { ...DEFAULT_PERMISSIONS }

  const permBlock = permMatch[1]

  function parseArrayField(fieldName: string): string[] | null {
    // Match:  read: ["."]   or  read:\n    - "."
    const inlineMatch = permBlock.match(new RegExp(`${fieldName}:\\s*\\[([^\\]]*)\\]`))
    if (inlineMatch) {
      const raw = inlineMatch[1]
      if (!raw.trim()) return []
      return raw
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
    }
    // Multi-line list
    const multiRe = new RegExp(`${fieldName}:\\s*\\n((?:\\s+-[^\\n]*\\n?)*)`)
    const multiMatch = permBlock.match(multiRe)
    if (multiMatch) {
      return multiMatch[1]
        .split('\n')
        .map((l) => l.replace(/^\s+-\s*/, '').trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
    }
    return null
  }

  return {
    read: parseArrayField('read') ?? [...DEFAULT_PERMISSIONS.read],
    net: parseArrayField('net') ?? [],
    write: parseArrayField('write') ?? [],
    env: parseArrayField('env') ?? [...DEFAULT_PERMISSIONS.env],
  }
}

// ─── Permission validator ────────────────────────────────────────────────────

interface ValidationError {
  field: string
  message: string
}

/**
 * Validate permissions declared in SKILL.md.
 * Returns list of errors (empty = valid).
 */
function validatePermissions(perms: SkillPermissions, skillDir: string): ValidationError[] {
  const errors: ValidationError[] = []
  const wsDir = getWorkspaceDir()

  // net: disallow wildcard "*"
  for (const host of perms.net) {
    if (host === '*') {
      errors.push({ field: 'net', message: 'net: ["*"] is not allowed – specify explicit hosts' })
    }
  }

  // read/write: resolve paths and validate they stay within workspace
  for (const field of ['read', 'write'] as const) {
    for (const raw of perms[field]) {
      const resolved = expandPermPath(raw, skillDir)
      if (!resolved) continue
      const norm = normalize(resolve(resolved))
      // Must be within workspace
      if (!norm.startsWith(normalize(wsDir) + '/') && norm !== normalize(wsDir)) {
        // Allow skill dir itself
        if (!norm.startsWith(normalize(skillDir))) {
          errors.push({
            field,
            message: `${field}: "${raw}" resolves outside workspace – blocked`,
          })
        }
      }
      // Must not point to source code
      const cwd = process.cwd()
      const forbiddenPrefixes = [
        join(cwd, 'packages'),
        join(cwd, 'node_modules'),
        join(cwd, '.git'),
      ]
      for (const forbidden of forbiddenPrefixes) {
        if (norm.startsWith(normalize(forbidden))) {
          errors.push({
            field,
            message: `${field}: "${raw}" points to protected directory "${basename(forbidden)}"`,
          })
        }
      }
    }
  }

  return errors
}

/**
 * Expand a permission path token to an absolute path.
 * "." → skillDir
 * "workspace" → workspaceDir
 * absolute path → as-is
 */
function expandPermPath(raw: string, skillDir: string): string | null {
  if (raw === '.') return skillDir
  if (raw === 'workspace') return getWorkspaceDir()
  if (raw.startsWith('/')) return raw
  // relative to skillDir
  return join(skillDir, raw)
}

// ─── Deno command builder ────────────────────────────────────────────────────

function buildDenoArgs(
  scriptPath: string,
  perms: SkillPermissions,
  skillDir: string,
): string[] {
  const args = ['run', '--no-prompt']

  // --allow-read
  const readPaths = perms.read.map((r) => expandPermPath(r, skillDir)).filter(Boolean) as string[]
  if (readPaths.length > 0) {
    args.push(`--allow-read=${readPaths.join(',')}`)
  } else {
    // No read access
    args.push('--deny-read')
  }

  // --allow-net
  if (perms.net.length > 0) {
    args.push(`--allow-net=${perms.net.join(',')}`)
  }
  // else: no --allow-net → network blocked by default

  // --allow-write
  if (perms.write.length > 0) {
    const writePaths = perms.write.map((w) => expandPermPath(w, skillDir)).filter(Boolean) as string[]
    args.push(`--allow-write=${writePaths.join(',')}`)
  }
  // else: no write access

  // --allow-env
  const defaultEnvKeys = ['SKILL_ARGS', 'SKILL_ID', 'NODE_ENV']
  const extraEnvKeys = perms.env.filter((k) => !defaultEnvKeys.includes(k))
  const allEnvKeys = [...defaultEnvKeys, ...extraEnvKeys]
  args.push(`--allow-env=${allEnvKeys.join(',')}`)

  args.push(scriptPath)
  return args
}

/** Inline mode: strictest permissions – no read/net/write, only env */
function buildDenoInlineArgs(scriptPath: string): string[] {
  return [
    'run',
    '--no-prompt',
    '--deny-read',
    '--allow-env=SKILL_ARGS,SKILL_ID',
    scriptPath,
  ]
}

// ─── Process runner ──────────────────────────────────────────────────────────

/** Allowed environment variable keys forwarded to Skill subprocess (tsx fallback) */
const ENV_ALLOWLIST = [
  'SKILL_ARGS', 'SKILL_ID', 'NODE_ENV',
  'PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP',
  // OpenKin server access (for skills that call back to the server API)
  'THEWORLD_INTERNAL_PORT', 'THEWORLD_SERVER_URL', 'THEWORLD_API_KEY',
  'OPENKIN_INTERNAL_PORT', 'OPENKIN_SERVER_URL', 'OPENKIN_API_KEY',
]

function buildSafeEnv(skillId: string, args: Record<string, unknown>, extraEnvKeys: string[] = []): Record<string, string> {
  const safe: Record<string, string> = {}
  const allowlist = [...ENV_ALLOWLIST, ...extraEnvKeys]
  for (const key of allowlist) {
    const val = process.env[key]
    if (val !== undefined) safe[key] = val
  }
  mirrorCompatEnv(safe, 'THEWORLD_INTERNAL_PORT', 'OPENKIN_INTERNAL_PORT')
  mirrorCompatEnv(safe, 'THEWORLD_SERVER_URL', 'OPENKIN_SERVER_URL')
  mirrorCompatEnv(safe, 'THEWORLD_API_KEY', 'OPENKIN_API_KEY')
  safe.SKILL_ID = skillId
  safe.SKILL_ARGS = JSON.stringify(args)
  return safe
}

function runProcess(
  cmd: string,
  cmdArgs: string[],
  env: Record<string, string>,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve_) => {
    const child = spawn(cmd, cmdArgs, {
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
      if (remaining <= 0) { stdoutTruncated = true; return }
      stdoutBuf += chunk.toString('utf8', 0, Math.min(chunk.length, remaining))
      if (Buffer.byteLength(stdoutBuf) >= MAX_OUTPUT_BYTES) stdoutTruncated = true
    })

    child.stderr.on('data', (chunk: Buffer) => {
      const remaining = MAX_OUTPUT_BYTES - Buffer.byteLength(stderrBuf)
      if (remaining <= 0) { stderrTruncated = true; return }
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

// ─── Tool definition & executor ─────────────────────────────────────────────

export const runScriptToolDefinition: ToolDefinition = {
  name: 'run_script',
  description: (() => {
    const denoPath = getDenoPath()
    if (denoPath) {
      return [
        'Execute a Skill script or run TypeScript code inline in a Deno sandbox.',
        'Decision guide:',
        '- Use `inline` when: the task is one-off computation or transformation with no file/network I/O needed, and no Skill script exists for it. Examples: math calculations, data formatting, string manipulation.',
        '- Use `script` (with read_skill first) when: a Skill already has the right script file, or the task requires file access, network calls, or reusable logic.',
        'Scripts run in a Deno sandbox with permissions declared in SKILL.md (read/net/write/env). Inline runs in the strictest sandbox: no file or network access.',
      ].join(' ')
    }
    return 'Execute a script file inside a Skill directory. Read the SKILL.md first to understand the expected args and script filename. Sandbox unavailable (Deno not installed) – running in non-isolated tsx mode. Inline execution is disabled.'
  })(),
  inputSchema: {
    type: 'object',
    properties: {
      skillId: { type: 'string', description: 'The skill-id whose directory contains the script. Use "__inline__" when using inline mode without an existing Skill.' },
      script: { type: 'string', description: 'Script filename relative to the skill directory (e.g. weather.ts). Required when NOT using inline.' },
      args: {
        type: 'object',
        description: 'Arguments passed to the script via SKILL_ARGS environment variable (JSON).',
        additionalProperties: true,
      },
      inline: {
        type: 'string',
        description: [
          'TypeScript source code to execute directly (Deno sandbox, strictest permissions: no file read/write, no network).',
          'Use this for one-off computations that do not need an existing Skill script.',
          'Access args via: const args = JSON.parse(Deno.env.get("SKILL_ARGS") ?? "{}")',
          'Output results via: console.log(JSON.stringify({ result: ... }))',
        ].join(' '),
      },
    },
    required: ['skillId'],
  },
}

export const runScriptToolExecutor: ToolExecutor = {
  async execute(input: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const skillId = input.skillId
    const script = input.script as string | undefined
    const inlineCode = input.inline as string | undefined
    const args = (input.args as Record<string, unknown>) ?? {}

    if (typeof skillId !== 'string' || !skillId) {
      return errResult(context, 'TOOL_INVALID_INPUT', 'run_script: skillId must be a non-empty string')
    }

    // Security: skillId must not contain path separators
    if (skillId.includes('/') || skillId.includes('\\') || skillId.includes('..')) {
      return errResult(context, 'TOOL_PERMISSION_DENIED', `run_script: invalid skillId "${skillId}"`)
    }

    const skillsDir = getSkillsDir()
    const skillDir = resolve(join(skillsDir, skillId))

    // ── inline mode ──────────────────────────────────────────────────────────
    if (inlineCode !== undefined) {
      const denoPath = getDenoPath()
      if (!denoPath) {
        return errResult(
          context,
          'TOOL_PERMISSION_DENIED',
          'run_script: inline execution requires Deno. Install Deno (https://deno.land) to enable this feature.',
        )
      }
      if (typeof inlineCode !== 'string' || !inlineCode.trim()) {
        return errResult(context, 'TOOL_INVALID_INPUT', 'run_script: inline must be a non-empty TypeScript string')
      }

      // Write to temp file
      const tmpFile = join(tmpdir(), `openkin-inline-${randomBytes(8).toString('hex')}.ts`)
      let execResult: { stdout: string; stderr: string; exitCode: number }
      try {
        const { writeFileSync } = await import('node:fs')
        writeFileSync(tmpFile, inlineCode, 'utf8')

        const denoArgs = buildDenoInlineArgs(tmpFile)
        const env = buildSafeEnv('__inline__', args)
        execResult = await runProcess(denoPath, denoArgs, env)
      } finally {
        // Always clean up temp file
        try { unlinkSync(tmpFile) } catch { /* ignore cleanup errors */ }
      }

      return {
        toolCallId: `run_script-${context.stepIndex}`,
        name: 'run_script',
        output: { ...execResult, mode: 'inline', sandbox: 'deno' },
        isError: execResult.exitCode !== 0,
      }
    }

    // ── file-based mode ──────────────────────────────────────────────────────
    if (typeof script !== 'string' || !script) {
      return errResult(context, 'TOOL_INVALID_INPUT', 'run_script: script filename is required (or use inline)')
    }

    const scriptPath = resolve(join(skillDir, script))

    // Security: ensure scriptPath is within skillsDir
    const normalizedSkillsDir = normalize(resolve(skillsDir))
    const normalizedScript = normalize(scriptPath)
    if (!normalizedScript.startsWith(normalizedSkillsDir + '/') && normalizedScript !== normalizedSkillsDir) {
      return errResult(
        context,
        'TOOL_PERMISSION_DENIED',
        'run_script: path traversal detected – script must be within the skills directory',
      )
    }

    if (!existsSync(scriptPath)) {
      return errResult(
        context,
        'TOOL_EXECUTION_FAILED',
        `run_script: script file not found: ${script} in skill ${skillId}`,
      )
    }

    // Read and parse SKILL.md permissions
    const skillMdPath = join(skillDir, 'SKILL.md')
    const skillMdContent = existsSync(skillMdPath) ? readFileSync(skillMdPath, 'utf8') : ''
    const perms = parsePermissions(skillMdContent)

    // Validate permissions
    const validationErrors = validatePermissions(perms, skillDir)
    if (validationErrors.length > 0) {
      return errResult(
        context,
        'TOOL_PERMISSION_DENIED',
        `run_script: invalid permissions in SKILL.md: ${validationErrors.map((e) => e.message).join('; ')}`,
      )
    }

    const denoPath = getDenoPath()

    let execResult: { stdout: string; stderr: string; exitCode: number }
    let sandboxMode: string

    if (denoPath && scriptPath.endsWith('.ts')) {
      // ── Deno sandbox mode ──
      const denoArgs = buildDenoArgs(scriptPath, perms, skillDir)
      // Extra declared env keys to forward from process.env
      const extraEnvKeys = perms.env.filter((k) => !['SKILL_ARGS', 'SKILL_ID'].includes(k))
      const env = buildSafeEnv(skillId, args, extraEnvKeys)
      execResult = await runProcess(denoPath, denoArgs, env)
      sandboxMode = 'deno'
    } else if (scriptPath.endsWith('.py')) {
      // ── Python scripts: run with python3 directly ──
      const env = buildSafeEnv(skillId, args)
      execResult = await runProcess('python3', [scriptPath], env)
      sandboxMode = 'python3'
    } else {
      // ── tsx fallback (non-TS files or Deno unavailable) ──
      const env = buildSafeEnv(skillId, args)
      execResult = await runProcess('pnpm', ['exec', 'tsx', scriptPath], env)
      sandboxMode = denoPath ? 'tsx' : 'tsx (no-sandbox: install Deno for sandboxing)'
    }

    return {
      toolCallId: `run_script-${context.stepIndex}`,
      name: 'run_script',
      output: { ...execResult, mode: 'file', sandbox: sandboxMode },
      isError: execResult.exitCode !== 0,
    }
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function errResult(
  context: ToolExecutionContext,
  code: Parameters<typeof createRunError>[0],
  msg: string,
): ToolResult {
  return {
    toolCallId: `run_script-${context.stepIndex}`,
    name: 'run_script',
    output: createRunError(code, msg, 'tool'),
    isError: true,
  }
}
