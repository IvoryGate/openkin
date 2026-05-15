import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const layers = ['l1-core', 'l2-tools', 'l3-service', 'l4-product', 'l5-sdk-channels']

for (const layer of layers) {
  const script = path.join(dir, `${layer}.mjs`)
  const result = spawnSync(process.execPath, [script], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

console.log('Layer verify passed (skeleton).')
