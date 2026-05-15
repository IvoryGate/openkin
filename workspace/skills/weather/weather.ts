/**
 * Weather Skill script
 * Reads SKILL_ARGS env var (JSON string) with { city: string }
 * Outputs JSON to stdout: { city, forecast }
 */

const rawArgs = process.env.SKILL_ARGS
if (!rawArgs) {
  process.stderr.write('Error: SKILL_ARGS environment variable is required\n')
  process.exit(1)
}

let args: { city?: string }
try {
  args = JSON.parse(rawArgs) as { city?: string }
} catch {
  process.stderr.write(`Error: SKILL_ARGS is not valid JSON: ${rawArgs}\n`)
  process.exit(1)
}

const city = typeof args.city === 'string' ? args.city.trim() : ''

const weatherTable: Record<string, string> = {
  Beijing: '晴，25°C',
  beijing: '晴，25°C',
  北京: '晴，25°C',
  Shanghai: '多云，28°C',
  shanghai: '多云，28°C',
  上海: '多云，28°C',
  Guangzhou: '阵雨，30°C',
  guangzhou: '阵雨，30°C',
  广州: '阵雨，30°C',
  Shenzhen: '晴转多云，32°C',
  shenzhen: '晴转多云，32°C',
  深圳: '晴转多云，32°C',
}

const forecast = weatherTable[city] ?? '未知城市'
const result = { city: city || 'Unknown', forecast }

process.stdout.write(JSON.stringify(result) + '\n')
process.exit(0)
