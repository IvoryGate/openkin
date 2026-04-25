/**
 * L4 100: ensure help + slash help contain stable onboarding / discoverability strings.
 */
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const cli = join(root, 'packages/cli/src/index.ts')

function runHelp(args) {
  const r = spawnSync(
    process.execPath,
    ['--import=tsx/esm', cli, ...args],
    { encoding: 'utf8', cwd: root, maxBuffer: 10 * 1024 * 1024 },
  )
  return `${r.stdout ?? ''}${r.stderr ?? ''}`
}

const rootHelp = runHelp(['help'])
for (const needle of [
  'First run',
  'pnpm dev:server',
  'inspect tools',
  'inspect skills',
  'L3 093',
  'L4 104',
  'theworld inspect resume',
  'theworld plan',
]) {
  if (!rootHelp.includes(needle)) {
    console.error(`test:l4-onboarding: missing in "theworld help": ${needle}`)
    process.exit(1)
  }
}

// Slash help is only visible in chat; smoke the string in source (stable contract).
const slashSrc = readFileSync(join(root, 'packages/cli/src/slash-chat.ts'), 'utf8')
if (!slashSrc.includes('inspect tools')) {
  console.error('test:l4-onboarding: slash-chat.ts should mention inspect tools')
  process.exit(1)
}

console.log('test:l4-onboarding passed')
