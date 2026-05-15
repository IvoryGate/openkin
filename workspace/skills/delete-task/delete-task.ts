/**
 * delete-task skill — 删除指定的定时任务
 *
 * 通过 TheWorld 服务器 API 删除定时任务
 */

function getEnv(key: string): string {
  if (typeof Deno !== 'undefined') {
    return Deno.env.get(key) ?? ''
  }
  return process.env[key] ?? ''
}

async function main() {
  const args = JSON.parse(getEnv('SKILL_ARGS') || '{}')
  const taskId = args.taskId as string

  if (!taskId) {
    console.error('错误: 必须提供 taskId 参数')
    console.error('示例: run_script("delete-task", "delete-task.ts", { taskId: "任务ID" })')
    if (typeof Deno !== 'undefined') Deno.exit(1)
    else process.exit(1)
  }

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

  console.error(`[delete-task] 正在删除任务: ${taskId}`)

  try {
    const response = await fetch(`${serverUrl}/v1/tasks/${taskId}`, {
      method: 'DELETE',
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
      data?: { deleted: boolean }
      error?: unknown
    }

    if (!result.ok) {
      console.error('错误: 删除失败:', JSON.stringify(result))
      if (typeof Deno !== 'undefined') Deno.exit(1)
      else process.exit(1)
    }

    if (result.data?.deleted) {
      console.log(`✅ 任务 ${taskId} 已成功删除`)
    } else {
      console.log(`⚠️  任务 ${taskId} 可能不存在或已被删除`)
    }

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