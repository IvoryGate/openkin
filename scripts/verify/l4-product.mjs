import { spawnSync } from 'node:child_process'

const steps = [
  'test:l4-shell-map',
  'test:l4-onboarding',
  'test:l4-context',
  'test:l4-memory',
  'test:l4-approval',
  'test:l4-background',
  'test:l4-plan',
  'test:l4-polish',
]
for (const step of steps) {
  const result = spawnSync('pnpm', [step], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
console.log('L4 verify passed.')
