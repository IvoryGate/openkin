/**
 * Live first-layer demo using OpenAI-compatible `chat/completions`.
 * Requires OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL.
 * Optionally loads repo-root `.env` or `apps/dev-console/.env` (gitignored).
 * @see docs/first-layer/DEMO_FIRST_LAYER.md
 */
import { config as loadEnv } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OpenAiCompatibleChatProvider, TheWorldAgent } from '@theworld/core'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '../../../.env'), quiet: true })
loadEnv({ path: resolve(__dirname, '../../.env'), override: true, quiet: true })
import {
  createDemoToolRuntime,
  demoLiveAgentDefinition,
  demoLiveUserPrompt,
  demoVerboseRoundHooks,
} from './demo-shared.js'

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v || !v.trim()) {
    console.error('')
    console.error(`  Missing required environment variable: ${name}`)
    console.error('')
    console.error('  The live first-layer demo needs all of:')
    console.error('    OPENAI_API_KEY')
    console.error('    OPENAI_BASE_URL   (must include /v1 for OpenAI-compatible roots)')
    console.error('    OPENAI_MODEL      (e.g. gpt-4o-mini or LongCat-Flash-Chat)')
    console.error('')
    console.error('  Or copy .env.example to .env at repo root and fill values.')
    console.error('')
    console.error('  Example:')
    console.error('    export OPENAI_API_KEY=sk-...')
    console.error('    export OPENAI_BASE_URL=https://api.openai.com/v1')
    console.error('    export OPENAI_MODEL=gpt-4o-mini')
    console.error('    pnpm test:first-layer-real')
    console.error('    # or: pnpm dev:first-layer')
    console.error('')
    console.error('  For deterministic mock (no API key), run:')
    console.error('    pnpm demo:first-layer:mock')
    console.error('')
    process.exit(1)
  }
  return v.trim()
}

const apiKey = requireEnv('OPENAI_API_KEY')
const baseUrl = requireEnv('OPENAI_BASE_URL')
const model = requireEnv('OPENAI_MODEL')

const llm = new OpenAiCompatibleChatProvider({
  apiKey,
  baseUrl,
  model,
  timeoutMs: 120_000,
})

const agent = new TheWorldAgent(
  demoLiveAgentDefinition,
  llm,
  createDemoToolRuntime(),
  undefined,
  demoVerboseRoundHooks,
)

console.error('Task (user message):')
console.error(`  ${demoLiveUserPrompt}`)
console.error('')
console.error('Trace below is stderr; final JSON is stdout (for piping).')
console.error('')

const result = await agent.run('demo-session-live', demoLiveUserPrompt)
console.log(JSON.stringify(result, null, 2))
