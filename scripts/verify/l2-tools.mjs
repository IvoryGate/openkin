import { spawnSync } from 'node:child_process'

const steps = ['test:tools', 'test:mcp', 'test:skills', 'test:self-management', 'test:sandbox']
for (const step of steps) {
  const result = spawnSync('pnpm', [step], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
console.log('L2 verify passed.')
