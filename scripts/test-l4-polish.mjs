/**
 * L4 106: discoverability strings + NO_COLOR help still works; shell map / polish doc.
 */
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const cli = join(root, 'packages/cli/src/index.ts')

function runHelp(args, env = {}) {
  const r = spawnSync(
    process.execPath,
    ['--import=tsx/esm', cli, ...args],
    { encoding: 'utf8', cwd: root, maxBuffer: 6 * 1024 * 1024, env: { ...process.env, ...env, THEWORLD_API_KEY: '' } },
  )
  return `${r.stdout ?? ''}${r.stderr ?? ''}`
}

const h = runHelp(['help'], { NO_COLOR: '1' })
if (!h.includes('First run') || !h.includes('L4 104') || !h.includes('L4 105')) {
  console.error('help under NO_COLOR missing stable L4 lines\n', h.slice(0, 1200))
  process.exit(1)
}
const p = runHelp(['help', 'plan'])
if (!p.includes('105') || !p.includes('plan init')) {
  console.error('help plan\n', p.slice(0, 500))
  process.exit(1)
}

const banner = readFileSync(join(root, 'packages/cli/src/chat-banner.ts'), 'utf8')
if (!banner.includes('sessions runs') && !banner.includes('theworld plan')) {
  console.error('chat-banner should mention sessions runs or plan (106 discoverability)')
  process.exit(1)
}

const doc = readFileSync(
  join(root, 'docs/architecture-docs-for-agent/fourth-layer/L4_TERMINAL_POLISH.md'),
  'utf8',
)
if (!doc.includes('106')) {
  console.error('L4_TERMINAL_POLISH.md should reference 106')
  process.exit(1)
}

console.log('test:l4-polish passed')
