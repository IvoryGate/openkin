import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { writeFile, readFile } from 'node:fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const args = JSON.parse(process.env.SKILL_ARGS || '{}')
const action = args.action || 'start'

const TASK_NAME = 'drink-water-reminder'
const TASK_FILE = join(__dirname, 'task.json')

async function createReminderTask() {
  const taskConfig = {
    name: TASK_NAME,
    type: 'interval',
    interval: 60, // 60秒 = 1分钟
    script: join(__dirname, 'reminder.js'),
    message: '💧 该喝水了！保持水分很重要哦~'
  }
  
  await writeFile(TASK_FILE, JSON.stringify(taskConfig, null, 2))
  
  // 创建提醒脚本
  const reminderScript = `
const message = process.env.MESSAGE || '💧 该喝水了！保持水分很重要哦~';
console.log(message);
// 在终端中显示提醒
process.stdout.write('\\x1b[36m' + message + '\\x1b[0m\\n');
`
  
  await writeFile(join(__dirname, 'reminder.js'), reminderScript)
  
  console.log('✅ 喝水提醒任务已创建，将每分钟提醒一次')
  console.log('要停止提醒，请使用: run_script drink-reminder run.ts --args \'{"action":"stop"}\'')
}

async function removeReminderTask() {
  try {
    await require('node:fs').promises.unlink(TASK_FILE)
    await require('node:fs').promises.unlink(join(__dirname, 'reminder.js'))
    console.log('✅ 喝水提醒任务已停止')
  } catch (error) {
    console.log('⚠️  未找到运行的提醒任务')
  }
}

if (action === 'start') {
  createReminderTask()
} else if (action === 'stop') {
  removeReminderTask()
} else {
  console.log('❌ 未知操作。使用 "start" 或 "stop"')
}
