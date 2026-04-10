/**
 * smoke test: 017 Deno Sandbox
 *
 * 场景 A：正常 Skill（weather）在 Deno 沙箱中正确执行
 * 场景 B：脚本尝试读取 skills/ 目录外的文件 → Deno 拒绝（exitCode 非 0）
 * 场景 C：脚本尝试建立未声明的网络连接 → Deno 拒绝
 * 场景 D：inline 合法代码执行成功
 * 场景 E：inline 代码尝试读取文件 → Deno 拒绝
 *
 * 前置条件：需要 Deno 已安装。
 * 若 Deno 不可用，所有场景 SKIP，脚本退出 0（不导致 verify 失败）。
 */

import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { writeFileSync, mkdirSync, existsSync, rmSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import net from 'node:net'
import path from 'node:path'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const skillsDir = path.join(root, 'workspace', 'skills')

// ─── Deno availability check ─────────────────────────────────────────────────

function findDeno() {
  const candidates = [
    process.env.DENO_INSTALL ? `${process.env.DENO_INSTALL}/bin/deno` : null,
    `${process.env.HOME ?? ''}/.deno/bin/deno`,
    '/usr/local/bin/deno',
    '/usr/bin/deno',
  ].filter(Boolean)

  for (const p of candidates) {
    try {
      if (existsSync(p)) return p
    } catch { /* ignore */ }
  }
  // Try PATH
  try {
    const probe = spawnSync('deno', ['--version'], { timeout: 5000, encoding: 'utf8' })
    if (probe.status === 0) return 'deno'
  } catch { /* ignore */ }
  return null
}

const denoPath = findDeno()

if (!denoPath) {
  console.log('test:sandbox SKIP – Deno not installed. Install from https://deno.land to run sandbox tests.')
  process.exit(0)
}

console.log(`[sandbox] Deno found: ${denoPath}`)

// ─── Direct Deno execution helper ────────────────────────────────────────────

function runDenoScript(scriptPath, skillArgs, extraDenoFlags) {
  return new Promise((resolve) => {
    const denoArgs = ['run', '--no-prompt', ...extraDenoFlags, scriptPath]
    const child = spawn(denoPath, denoArgs, {
      env: {
        SKILL_ARGS: JSON.stringify(skillArgs),
        SKILL_ID: 'test',
        HOME: process.env.HOME ?? '',
        PATH: process.env.PATH ?? '',
        DENO_NO_UPDATE_CHECK: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: root,
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c) => { stdout += c.toString() })
    child.stderr.on('data', (c) => { stderr += c.toString() })

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolve({ stdout, stderr, exitCode: 124 })
    }, 20_000)

    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ stdout, stderr, exitCode: code ?? 1 })
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({ stdout: '', stderr: err.message, exitCode: 1 })
    })
  })
}

async function runDenoInline(code, extraDenoFlags) {
  const tmpFile = path.join(tmpdir(), `theworld-sandbox-test-${randomBytes(6).toString('hex')}.ts`)
  try {
    writeFileSync(tmpFile, code, 'utf8')
    return await runDenoScript(tmpFile, {}, extraDenoFlags)
  } finally {
    try { unlinkSync(tmpFile) } catch { /* ignore */ }
  }
}

// ─── Temp skill helpers ───────────────────────────────────────────────────────

const testSkillDir = path.join(skillsDir, '__sandbox_test__')

function setupTestSkill(scriptName, scriptContent, permissionsBlock = '') {
  mkdirSync(testSkillDir, { recursive: true })
  const skillMd = [
    '---',
    'skill-id: __sandbox_test__',
    'description: sandbox test skill',
    permissionsBlock,
    '---',
    '# Sandbox Test Skill',
  ].filter(Boolean).join('\n') + '\n'
  writeFileSync(path.join(testSkillDir, 'SKILL.md'), skillMd)
  writeFileSync(path.join(testSkillDir, scriptName), scriptContent)
}

function teardownTestSkill() {
  try { rmSync(testSkillDir, { recursive: true, force: true }) } catch { /* ignore */ }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let passed = 0
  let failed = 0
  const errors = []

  function pass(name) {
    passed++
    console.log(`  ✓ ${name}`)
  }

  function fail(name, reason) {
    failed++
    errors.push({ name, reason })
    console.log(`  ✗ ${name}: ${reason}`)
  }

  // ── Scene A: Normal Skill in Deno sandbox ─────────────────────────────────
  console.log('\n[A] Normal Skill execution via Deno sandbox')
  try {
    const weatherScript = path.join(skillsDir, 'weather', 'weather.ts')
    const weatherDir = path.join(skillsDir, 'weather')
    const result = await runDenoScript(
      weatherScript,
      { city: 'Beijing' },
      [
        `--allow-read=${weatherDir}`,
        '--allow-env=SKILL_ARGS,SKILL_ID,NODE_ENV',
      ],
    )
    if (result.exitCode !== 0) {
      fail('A', `exitCode=${result.exitCode} stderr=${result.stderr.slice(0, 300)}`)
    } else {
      let parsed
      try { parsed = JSON.parse(result.stdout.trim()) } catch { /* ignore */ }
      if (parsed && parsed.city === 'Beijing' && typeof parsed.forecast === 'string') {
        pass(`A – weather skill returns correct JSON in Deno sandbox (${parsed.forecast})`)
      } else {
        fail('A', `unexpected output: ${result.stdout.slice(0, 200)}`)
      }
    }
  } catch (e) {
    fail('A', e.message)
  }

  // ── Scene B: Read outside skills/ blocked by Deno ────────────────────────
  console.log('\n[B] Read outside skills/ directory is blocked')
  try {
    // Script that tries to read /etc/hosts (or package.json in root) using Deno API
    const readOutsideScript = `
try {
  const content = Deno.readTextFileSync("/etc/hosts");
  console.log("READ_SUCCESS:" + content.slice(0, 10));
  Deno.exit(0);
} catch (e) {
  console.error("READ_BLOCKED:" + e.message);
  Deno.exit(1);
}
`
    setupTestSkill(
      'read-outside.ts',
      readOutsideScript,
      'permissions:\n  read: ["."]\n  net: []\n  write: []\n  env: ["SKILL_ARGS", "SKILL_ID"]',
    )

    const result = await runDenoScript(
      path.join(testSkillDir, 'read-outside.ts'),
      {},
      [
        `--allow-read=${testSkillDir}`,  // only test skill dir, not /etc
        '--allow-env=SKILL_ARGS,SKILL_ID,NODE_ENV',
      ],
    )

    if (result.stdout.includes('READ_SUCCESS')) {
      fail('B', 'Deno DID NOT block read outside skills dir – security issue!')
    } else {
      // exitCode non-0 means Deno blocked it
      pass(`B – reading /etc/hosts blocked by Deno sandbox (exitCode=${result.exitCode})`)
    }
  } catch (e) {
    fail('B', e.message)
  } finally {
    teardownTestSkill()
  }

  // ── Scene C: Undeclared network connection blocked ────────────────────────
  console.log('\n[C] Undeclared network connection is blocked')
  try {
    const netScript = `
try {
  const conn = await Deno.connect({ hostname: "1.1.1.1", port: 443 });
  conn.close();
  console.log("NET_SUCCESS");
  Deno.exit(0);
} catch (e) {
  console.error("NET_BLOCKED:" + e.message);
  Deno.exit(1);
}
`
    setupTestSkill(
      'net-outside.ts',
      netScript,
      'permissions:\n  read: ["."]\n  net: []\n  write: []\n  env: ["SKILL_ARGS", "SKILL_ID"]',
    )

    const result = await runDenoScript(
      path.join(testSkillDir, 'net-outside.ts'),
      {},
      [
        `--allow-read=${testSkillDir}`,
        '--allow-env=SKILL_ARGS,SKILL_ID,NODE_ENV',
        // deliberately NO --allow-net
      ],
    )

    if (result.stdout.includes('NET_SUCCESS')) {
      fail('C', 'Deno DID NOT block undeclared network connection – security issue!')
    } else {
      pass(`C – undeclared network connection blocked by Deno sandbox (exitCode=${result.exitCode})`)
    }
  } catch (e) {
    fail('C', e.message)
  } finally {
    teardownTestSkill()
  }

  // ── Scene D: Inline code execution (pure compute) ─────────────────────────
  console.log('\n[D] Inline code: pure compute succeeds')
  try {
    const inlineCode = `
const raw = Deno.env.get("SKILL_ARGS") ?? "{}";
const args = JSON.parse(raw);
const n = Number(args.n ?? 10);
const fib = [];
let a = 0, b = 1;
for (let i = 0; i < n; i++) { fib.push(a); [a, b] = [b, a + b]; }
console.log(JSON.stringify({ fib, count: fib.length }));
`
    const result = await runDenoInline(inlineCode, [
      '--allow-env=SKILL_ARGS,SKILL_ID',
    ])

    if (result.exitCode !== 0) {
      fail('D', `exitCode=${result.exitCode} stderr=${result.stderr.slice(0, 300)}`)
    } else {
      let parsed
      try { parsed = JSON.parse(result.stdout.trim()) } catch { /* ignore */ }
      if (parsed && Array.isArray(parsed.fib) && parsed.fib[0] === 0 && parsed.count === 10) {
        pass(`D – inline compute code executed in Deno (fib[0..2]=${parsed.fib.slice(0, 3).join(',')})`)
      } else {
        fail('D', `unexpected output: ${result.stdout.slice(0, 200)}`)
      }
    }
  } catch (e) {
    fail('D', e.message)
  }

  // ── Scene E: Inline code trying to read a file → blocked ─────────────────
  console.log('\n[E] Inline code: read file is blocked')
  try {
    const inlineCode = `
try {
  const data = Deno.readTextFileSync("package.json");
  console.log("READ_SUCCESS:" + data.slice(0, 10));
  Deno.exit(0);
} catch (e) {
  console.error("READ_BLOCKED:" + e.message);
  Deno.exit(1);
}
`
    // strictest: --deny-read, no net, no write
    const result = await runDenoInline(inlineCode, [
      '--allow-env=SKILL_ARGS,SKILL_ID',
      '--deny-read',
    ])

    if (result.stdout.includes('READ_SUCCESS')) {
      fail('E', 'Deno DID NOT block file read in inline mode – security issue!')
    } else {
      pass(`E – inline code cannot read files in Deno strict mode (exitCode=${result.exitCode})`)
    }
  } catch (e) {
    fail('E', e.message)
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\ntest:sandbox summary: ${passed} passed, ${failed} failed`)
  if (failed > 0) {
    console.error('\nFailed scenarios:')
    for (const { name, reason } of errors) {
      console.error(`  ✗ ${name}: ${reason}`)
    }
    process.exit(1)
  } else {
    console.log('test:sandbox PASSED ✓')
  }
}

main().catch((err) => {
  console.error('test:sandbox FAILED (unexpected):', err.message)
  process.exit(1)
})
