import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

const errors = []

const boundaryChecks = [
  {
    file: 'packages/shared/contracts/src/index.ts',
    forbidden: ['@theworld/core', '@theworld/server'],
    message: 'shared/contracts must not depend on core or server',
  },
  {
    file: 'packages/sdk/client/src/index.ts',
    forbidden: ['@theworld/server', '../server', '/server/'],
    message: 'sdk/client must not depend on server internals',
  },
  {
    file: 'packages/channel-core/src/index.ts',
    forbidden: ['@theworld/core'],
    message: 'channel-core must not depend on core',
  },
]

for (const { file, forbidden, message } of boundaryChecks) {
  if (!existsSync(path.join(root, file))) {
    errors.push(`Missing architecture file: ${file}`)
    continue
  }
  const content = read(file)
  for (const token of forbidden) {
    if (content.includes(token)) {
      errors.push(message)
      break
    }
  }
}

if (existsSync(path.join(root, 'packages/core/src/run-engine.ts'))) {
  const runEngine = read('packages/core/src/run-engine.ts')
  if (!runEngine.includes('assertRunNotYetFinished')) {
    errors.push('RunEngine must call assertRunNotYetFinished before finishing a run')
  }
  if (!runEngine.includes('getRuntimeView')) {
    errors.push('RunEngine must obtain tools through ToolRuntime.getRuntimeView()')
  }
  if (!runEngine.includes('beforeToolCall') || !runEngine.includes('afterToolCall')) {
    errors.push('RunEngine must call hook runner before and after tool execution')
  }
  if (!runEngine.includes('maxPromptTokens')) {
    errors.push('RunEngine must pass prompt budget settings into RunState')
  }
}

const sharedContracts = read('packages/shared/contracts/src/index.ts')
for (const required of ['completed', 'aborted', 'cancelled', 'budget_exhausted', 'failed']) {
  if (!sharedContracts.includes(`'${required}'`)) {
    errors.push(`Shared runtime contract is missing final status: ${required}`)
  }
}

const toolRuntime = read('packages/core/src/tool-runtime.ts')
for (const required of ['ToolAccessPolicy', 'ToolRuntimeView', 'AllowAllToolAccessPolicy']) {
  if (!toolRuntime.includes(required)) {
    errors.push(`tool-runtime is missing required symbol: ${required}`)
  }
}

if (errors.length > 0) {
  console.error('Architecture lint failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Architecture lint passed.')
