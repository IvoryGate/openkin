import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

const errors = []

const sharedContracts = read('packages/shared/contracts/src/index.ts')
if (sharedContracts.includes('@theworld/core') || sharedContracts.includes('@theworld/server')) {
  errors.push('shared/contracts must not depend on core or server.')
}

const sdkClient = read('packages/sdk/client/src/index.ts')
if (sdkClient.includes('@theworld/server') || sdkClient.includes('../server') || sdkClient.includes('/server/')) {
  errors.push('sdk/client must not depend on server internals.')
}

for (const rel of [
  'packages/channel-core/src/index.ts',
  'packages/channel-core/src/types.ts',
  'packages/channel-core/src/channel-adapter.ts',
  'packages/channel-core/src/channel-manager.ts',
  'packages/channel-core/src/service-gateway.ts',
]) {
  const channelSrc = read(rel)
  if (channelSrc.includes('@theworld/core')) {
    errors.push('channel-core must not depend on core (use service HTTP contract only).')
    break
  }
}

const runEngine = read('packages/core/src/run-engine.ts')
if (!runEngine.includes('assertRunNotYetFinished')) {
  errors.push('RunEngine must call assertRunNotYetFinished before finishing a run.')
}
if (!runEngine.includes('getRuntimeView')) {
  errors.push('RunEngine must obtain tools through ToolRuntime.getRuntimeView().')
}
if (runEngine.includes('toolRuntime.execute(')) {
  errors.push('RunEngine must not execute tools directly via toolRuntime.execute().')
}
if (!runEngine.includes('beforeToolCall') || !runEngine.includes('afterToolCall')) {
  errors.push('RunEngine must call hook runner before and after tool execution.')
}
if (!runEngine.includes('maxPromptTokens')) {
  errors.push('RunEngine must pass prompt budget settings into RunState.')
}

for (const required of ['completed', 'aborted', 'cancelled', 'budget_exhausted', 'failed']) {
  if (!sharedContracts.includes(`'${required}'`)) {
    errors.push(`Shared runtime contract is missing final status: ${required}`)
  }
}

const toolRuntime = read('packages/core/src/tool-runtime.ts')
for (const required of ['ToolAccessPolicy', 'ToolRuntimeView', 'AllowAllToolAccessPolicy']) {
  if (!toolRuntime.includes(required)) {
    errors.push(`Tool runtime contract missing: ${required}`)
  }
}

const contextRuntime = read('packages/core/src/context.ts')
for (const required of ['ContextBlock', 'CompressionPolicy', 'TrimCompressionPolicy', 'protection', 'tokenEstimate']) {
  if (!contextRuntime.includes(required)) {
    errors.push(`Context runtime contract missing: ${required}`)
  }
}

const lifecycle = read('packages/core/src/lifecycle.ts')
if (!lifecycle.includes('onRunStart') || !lifecycle.includes('onRunEnd') || !lifecycle.includes('onRunError')) {
  errors.push('Hook lifecycle is missing required run-level hooks.')
}

if (errors.length > 0) {
  console.error('Architecture lint failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Architecture lint passed.')
