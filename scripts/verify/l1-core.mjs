import { spawnSync } from 'node:child_process'

const steps = ['test:scenarios', 'test:first-layer-audit']
for (const step of steps) {
  const result = spawnSync('pnpm', [step], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
console.log('L1 verify passed.')
