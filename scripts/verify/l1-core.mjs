import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')
const evalScript = path.join(root, 'scripts/evals/l1-run.mjs')

const result = spawnSync(process.execPath, [evalScript], { stdio: 'inherit', cwd: root })
if (result.status !== 0) process.exit(result.status ?? 1)
console.log('L1 verify passed.')
