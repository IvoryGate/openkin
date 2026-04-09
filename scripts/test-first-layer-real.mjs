/**
 * Non-default acceptance path for exec plan 011: one real OpenAI-compatible run.
 * Not part of `pnpm verify`. Requires OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL.
 * Loads repo-root `.env` when present (same as demo-live).
 */
import { config as loadEnv } from 'dotenv'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
loadEnv({ path: path.join(root, '.env'), quiet: true })
const required = ['OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_MODEL']

function printMissingHelp() {
  console.error('')
  console.error('  test:first-layer-real requires all of:')
  for (const name of required) {
    const ok = Boolean(process.env[name]?.trim())
    console.error(`    ${ok ? 'set' : 'MISSING'}  ${name}`)
  }
  console.error('')
  console.error('  Example:')
  console.error('    export OPENAI_API_KEY=sk-...')
  console.error('    export OPENAI_BASE_URL=https://api.openai.com/v1')
  console.error('    export OPENAI_MODEL=gpt-4o-mini')
  console.error('    pnpm test:first-layer-real')
  console.error('')
  console.error('  Mock-only (no API key): pnpm demo:first-layer:mock')
  console.error('')
}

for (const name of required) {
  if (!process.env[name]?.trim()) {
    printMissingHelp()
    process.exit(1)
  }
}

const result = spawnSync(
  'pnpm',
  ['--filter', '@theworld/dev-console', 'demo:live'],
  { cwd: root, stdio: 'inherit', env: process.env, shell: false },
)

const code = result.status
if (code === null) {
  console.error('test:first-layer-real: failed to spawn pnpm')
  process.exit(1)
}
process.exit(code)
