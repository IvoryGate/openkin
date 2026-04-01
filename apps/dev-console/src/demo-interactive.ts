/**
 * 中文交互式第一层 demo：多轮对话、同一 session 保留上下文。
 * 系统提示注入 OPENAI_MODEL，用户可问「你是什么模型」。
 */
import { config as loadEnv } from 'dotenv'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OpenAiCompatibleChatProvider, OpenKinAgent } from '@openkin/core'
import {
  assistantReplyText,
  buildInteractiveAgentDefinition,
  createDemoToolRuntime,
  demoInteractiveVerboseHooks,
} from './demo-shared.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '../../../.env'), quiet: true })
loadEnv({ path: resolve(__dirname, '../../.env'), override: true, quiet: true })

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v || !v.trim()) {
    console.error(`缺少环境变量 ${name}，请配置仓库根目录 .env（见 .env.example）`)
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

const agent = new OpenKinAgent(
  buildInteractiveAgentDefinition(model, baseUrl),
  llm,
  createDemoToolRuntime(),
  undefined,
  demoInteractiveVerboseHooks,
)

const SESSION_ID = 'interactive-zh'
const rl = createInterface({ input, output })

console.log('')
console.log('OpenKin 第一层 · 中文交互（输入 exit / quit / q 退出）')
console.log('────────────────────────────────────────────────────────')
console.log('')

for (;;) {
  const line = await rl.question('你：')
  const text = line.trim()
  if (!text) continue
  if (/^(exit|quit|q)$/i.test(text)) break

  const result = await agent.run(SESSION_ID, text)
  console.log(`助手：${assistantReplyText(result)}`)
  console.log('')
}

rl.close()
