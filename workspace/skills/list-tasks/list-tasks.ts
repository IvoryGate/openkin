/**
 * list-tasks skill — 列出所有定时任务
 *
 * 通过 TheWorld 服务器 API 获取定时任务列表
 */

function getEnv(key: string): string {
  if (typeof Deno !== 'undefined') {
    return Deno.env.get(key) ?? ''
  }
  return process.env[key] ?? ''
}

async function main() {
  // 获取服务器配置
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

  console.error(`[list-tasks] 连接到 ${serverUrl}/v1/tasks`)

  try {
    const response = await fetch(`${serverUrl}/v1/tasks`, {
      method: 'GET',
      headers,
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`错误: 服务器返回 ${response.status}: ${text.slice(0, 500)}`)
      if (typeof Deno !== 'undefined') Deno.exit(1)
      else process.exit(1)
    }

    const result = await response.json() as {
      ok: boolean
      data?: { tasks: Array<{
        id: string
        name: string
        agentId: string
        triggerType: string
        triggerConfig: Record<string, unknown>
        nextRunAt: number | null
        enabled: boolean
        createdAt: number
      }> }
      error?: unknown
    }

    if (!result.ok || !result.data) {
      console.error('错误: 响应格式不正确:', JSON.stringify(result))
      if (typeof Deno !== 'undefined') Deno.exit(1)
      else process.exit(1)
    }

    const tasks = result.data.tasks

    if (tasks.length === 0) {
      console.log('📋 当前没有定时任务')
      console.log('')
      console.log('使用 create-task skill 创建新的定时任务:')
      console.log('示例: run_script("create-task", "create-task.ts", {') 
      console.log('  name: "每日提醒",')
      console.log('  agentId: "default",')
      console.log('  input: "请提醒我喝水",')
      console.log('  triggerType: "interval",')
      console.log('  triggerConfig: { interval_seconds: 3600 }')
      console.log('})')
      return
    }

    console.log(`📋 当前共有 ${tasks.length} 个定时任务:\n`)

    tasks.forEach((task, index) => {
      const nextRunStr = task.nextRunAt
        ? new Date(task.nextRunAt).toLocaleString('zh-CN', { 
            timeZone: 'Asia/Shanghai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        : '待计算'

      const createdStr = new Date(task.createdAt).toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })

      const status = task.enabled ? '✅ 启用' : '❌ 禁用'

      console.log(`${index + 1}. ${task.name}`)
      console.log(`   ID: ${task.id}`)
      console.log(`   状态: ${status}`)
      console.log(`   触发类型: ${task.triggerType}`)
      console.log(`   下次执行: ${nextRunStr}`)
      console.log(`   创建时间: ${createdStr}`)
      
      // 显示触发配置详情
      if (task.triggerType === 'cron' && task.triggerConfig.cron) {
        console.log(`   Cron表达式: ${task.triggerConfig.cron}`)
      } else if (task.triggerType === 'interval' && task.triggerConfig.interval_seconds) {
        const seconds = task.triggerConfig.interval_seconds
        const minutes = Math.floor(seconds / 60)
        const hours = Math.floor(minutes / 60)
        if (hours > 0) {
          console.log(`   间隔: 每${hours}小时${minutes % 60}分钟`)
        } else if (minutes > 0) {
          console.log(`   间隔: 每${minutes}分钟`)
        } else {
          console.log(`   间隔: 每${seconds}秒`)
        }
      } else if (task.triggerType === 'once' && task.triggerConfig.once_at) {
        console.log(`   执行时间: ${new Date(task.triggerConfig.once_at as number).toLocaleString('zh-CN')}`)
      }

      console.log('')
    })

    // 输出 JSON 格式结果
    console.log(JSON.stringify({ 
      success: true, 
      taskCount: tasks.length,
      tasks: tasks.map(t => ({
        id: t.id,
        name: t.name,
        status: t.enabled ? 'enabled' : 'disabled',
        triggerType: t.triggerType,
        nextRunAt: t.nextRunAt,
        createdAt: t.createdAt
      }))
    }))

  } catch (error) {
    console.error('请求失败:', error instanceof Error ? error.message : String(error))
    if (typeof Deno !== 'undefined') Deno.exit(1)
    else process.exit(1)
  }
}

main().catch((err) => {
  console.error('未知错误:', err instanceof Error ? err.message : String(err))
  if (typeof Deno !== 'undefined') Deno.exit(1)
  else process.exit(1)
})