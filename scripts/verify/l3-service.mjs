import { spawnSync } from 'node:child_process'

const steps = [
  'test:server',
  'test:persistence',
  'test:auth-health',
  'test:session-message',
  'test:observability',
  'test:agent-config',
  'test:scheduler',
  'test:introspection',
  'test:approval',
  'test:context-descriptors',
  'test:multimodal',
]
for (const step of steps) {
  const result = spawnSync('pnpm', [step], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
console.log('L3 verify passed.')
