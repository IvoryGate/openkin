import { SkeletonRunEngine, SkeletonToolRuntime } from '@theworld/core'
import { RUN_FINAL_STATUSES } from '@theworld/shared-contracts'

async function main() {
  const engine = new SkeletonRunEngine(new SkeletonToolRuntime())
  const state = { maxPromptTokens: 8192, status: 'running' as const }
  const finished = await engine.finish(state, 'completed')
  if (finished.status !== 'completed') throw new Error('scenario failed')
  if (RUN_FINAL_STATUSES.length < 5) throw new Error('contract incomplete')
  console.log('dev-console scenarios passed (skeleton)')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
