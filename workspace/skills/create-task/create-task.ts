/**
 * create-task skill — Deno-compatible
 *
 * Creates a scheduled task via the TheWorld server API.
 *
 * Env (set by run_script sandbox):
 *   SKILL_ARGS              — JSON with task parameters
 *   THEWORLD_INTERNAL_PORT  — server port (set by cli.ts at startup)
 *   THEWORLD_SERVER_URL     — optional full base URL override
 *   THEWORLD_API_KEY        — optional API key
 */

interface TaskArgs {
  name: string
  agentId: string
  input: string
  triggerType: 'cron' | 'interval' | 'once'
  triggerConfig: Record<string, unknown>
  enabled?: boolean
}

function getEnv(key: string): string {
  // Works in both Deno and Node
  if (typeof Deno !== 'undefined') {
    return Deno.env.get(key) ?? ''
  }
  return process.env[key] ?? ''
}

async function main() {
  const args = JSON.parse(getEnv('SKILL_ARGS') || '{}') as Partial<TaskArgs>

  // Validate required fields
  const missing: string[] = []
  if (!args.name) missing.push('name')
  if (!args.agentId) missing.push('agentId')
  if (!args.input) missing.push('input')
  if (!args.triggerType) missing.push('triggerType')
  if (!args.triggerConfig) missing.push('triggerConfig')

  if (missing.length > 0) {
    console.error(`Error: Missing required fields: ${missing.join(', ')}`)
    console.error('Provide SKILL_ARGS with: name, agentId, input, triggerType, triggerConfig')
    console.error('')
    console.error('Example:')
    console.error(JSON.stringify({
      name: '每日日报',
      agentId: 'default',
      input: '请生成今日工作日报',
      triggerType: 'cron',
      triggerConfig: { cron: '0 9 * * 1-5' }
    }, null, 2))
    if (typeof Deno !== 'undefined') Deno.exit(1)
    else process.exit(1)
  }

  const validTriggerTypes = ['cron', 'interval', 'once']
  if (!validTriggerTypes.includes(args.triggerType!)) {
    console.error(`Error: triggerType must be one of: ${validTriggerTypes.join(', ')}`)
    if (typeof Deno !== 'undefined') Deno.exit(1)
    else process.exit(1)
  }

  // Validate triggerConfig
  const tc = args.triggerConfig!
  if (args.triggerType === 'cron' && typeof tc.cron !== 'string') {
    console.error('Error: triggerConfig.cron (string) is required for triggerType=cron')
    console.error('Example: { "cron": "0 9 * * 1-5" }')
    if (typeof Deno !== 'undefined') Deno.exit(1)
    else process.exit(1)
  }
  if (args.triggerType === 'interval' && typeof tc.interval_seconds !== 'number') {
    console.error('Error: triggerConfig.interval_seconds (number, seconds) is required for triggerType=interval')
    console.error('Example: { "interval_seconds": 300 } means every 5 minutes')
    if (typeof Deno !== 'undefined') Deno.exit(1)
    else process.exit(1)
  }
  if (args.triggerType === 'once' && typeof tc.once_at !== 'number') {
    console.error('Error: triggerConfig.once_at (unix ms timestamp) is required for triggerType=once')
    console.error(`Example: { "once_at": ${Date.now() + 60000} } means 1 minute from now`)
    if (typeof Deno !== 'undefined') Deno.exit(1)
    else process.exit(1)
  }

  // Resolve server URL: THEWORLD_SERVER_URL > THEWORLD_INTERNAL_PORT > default
  const serverUrlEnv = getEnv('THEWORLD_SERVER_URL').replace(/\/+$/, '')
  const internalPort = getEnv('THEWORLD_INTERNAL_PORT') || '3333'
  const serverUrl = serverUrlEnv || `http://127.0.0.1:${internalPort}`
  const apiKey = getEnv('THEWORLD_API_KEY')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  const body = {
    name: args.name,
    agentId: args.agentId,
    input: { text: args.input },
    triggerType: args.triggerType,
    triggerConfig: args.triggerConfig,
    enabled: args.enabled !== false,
    createdBy: 'agent',
  }

  console.error(`[create-task] Connecting to ${serverUrl}/v1/tasks`)

  const response = await fetch(`${serverUrl}/v1/tasks`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    console.error(`Error: Server returned ${response.status}: ${text.slice(0, 500)}`)
    if (typeof Deno !== 'undefined') Deno.exit(1)
    else process.exit(1)
  }

  const result = await response.json() as {
    ok: boolean
    data?: { task: { id: string; name: string; nextRunAt: number | null; triggerType: string } }
    error?: unknown
  }

  if (!result.ok || !result.data) {
    console.error('Error: Unexpected response:', JSON.stringify(result))
    if (typeof Deno !== 'undefined') Deno.exit(1)
    else process.exit(1)
  }

  const task = result.data.task
  const nextRunStr = task.nextRunAt
    ? new Date(task.nextRunAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
    : '待计算'

  console.log('✅ 定时任务创建成功！')
  console.log(`   ID:       ${task.id}`)
  console.log(`   名称:     ${task.name}`)
  console.log(`   触发类型: ${task.triggerType}`)
  console.log(`   下次执行: ${nextRunStr}`)
  console.log('')
  console.log('可以在 Web Console「定时任务」页面查看和管理此任务。')
  console.log('任务执行结果会记录在「定时任务」→「执行记录」中。')
  console.log('')
  console.log(JSON.stringify({ success: true, taskId: task.id, name: task.name, nextRunAt: task.nextRunAt }))
}

main().catch((err) => {
  console.error('Unexpected error:', err instanceof Error ? err.message : String(err))
  if (typeof Deno !== 'undefined') Deno.exit(1)
  else process.exit(1)
})
