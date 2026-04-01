import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const requiredPaths = [
  'package.json',
  'pnpm-workspace.yaml',
  'tsconfig.base.json',
  'packages/shared/contracts/src/index.ts',
  'packages/core/src/index.ts',
  'packages/server/src/index.ts',
  'packages/sdk/client/src/index.ts',
  'packages/channel-core/src/index.ts',
  'apps/dev-console/src/index.ts',
  'apps/dev-console/src/scenarios.ts',
  'scripts/lint-docs.mjs',
  'scripts/lint-architecture.mjs',
  'scripts/test-server.mjs',
  'scripts/test-sdk.mjs',
  'scripts/test-channels.mjs',
]

const errors = []
for (const rel of requiredPaths) {
  if (!existsSync(path.join(root, rel))) {
    errors.push(`Missing required workspace path: ${rel}`)
  }
}

const workspace = readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8')
for (const expected of ['packages/*', 'packages/*/*', 'apps/*']) {
  if (!workspace.includes(expected)) {
    errors.push(`pnpm-workspace.yaml is missing package pattern: ${expected}`)
  }
}

const packageJson = readFileSync(path.join(root, 'package.json'), 'utf8')
for (const requiredScript of [
  'lint:docs',
  'lint:architecture',
  'lint:workspace',
  'test:server',
  'test:sdk',
  'test:channels',
  'test:scenarios',
  'verify',
]) {
  if (!packageJson.includes(`"${requiredScript}"`)) {
    errors.push(`Root package.json is missing script: ${requiredScript}`)
  }
}

if (errors.length > 0) {
  console.error('Workspace lint failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Workspace lint passed.')
