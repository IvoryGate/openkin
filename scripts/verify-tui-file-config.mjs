/**
 * Smoked by test-project-cli: load `loadTuiFileConfig` for a given cwd.
 * Usage: node --import=tsx/esm scripts/verify-tui-file-config.mjs <absoluteOrRelativeCwd>
 */
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { loadTuiFileConfig } = await import(
  pathToFileURL(join(root, 'packages/cli/src/tui-config.ts')).href
)

const cwd = process.argv[2]
if (!cwd) {
  console.error('usage: verify-tui-file-config.mjs <cwd>')
  process.exit(1)
}

const c = loadTuiFileConfig(cwd)
process.stdout.write(`${JSON.stringify(c)}\n`, () => process.exit(0))
