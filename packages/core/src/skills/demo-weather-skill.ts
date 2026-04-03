import { createRunError } from '@openkin/shared-contracts'
import type { SkillManifest } from '../tools/skill-tool-provider.js'

function inferCity(input: Record<string, unknown>): string {
  const raw = typeof input.city === 'string' ? input.city : ''
  const lower = raw.toLowerCase()
  if (lower.includes('beijing') || raw.includes('北京')) return 'Beijing'
  if (lower.includes('shanghai') || raw.includes('上海')) return 'Shanghai'
  if (lower.includes('guangzhou') || raw.includes('广州')) return 'Guangzhou'
  return raw.trim() || 'Unknown'
}

const weatherTable: Record<string, { forecast: string }> = {
  Beijing: { forecast: 'Clear sky, 25°C' },
  Shanghai: { forecast: 'Humid, 28°C' },
  Guangzhou: { forecast: 'Warm rain, 26°C' },
  Unknown: { forecast: 'Partly cloudy, 22°C' },
}

const demoWeatherSkill: SkillManifest = {
  id: 'demo-weather',
  name: 'Demo Weather Skill',
  tools: [
    {
      definition: {
        name: 'get_weather',
        description:
          '查询单个城市的模拟天气。若要对比多个城市，请对每个城市各调用一次。城市名可用中文（如 北京）或英文。',
        inputSchema: {
          type: 'object',
          properties: {
            city: { type: 'string', description: '城市名，例如 北京、上海、Guangzhou' },
          },
          required: ['city'],
        },
      },
      executor: {
        async execute(input, context) {
          if (typeof input.city !== 'string') {
            return {
              toolCallId: `get_weather-${context.stepIndex}`,
              name: 'get_weather',
              output: createRunError('TOOL_EXECUTION_FAILED', 'get_weather: input.city must be a string', 'tool'),
              isError: true,
            }
          }
          const city = inferCity(input)
          const row = weatherTable[city] ?? weatherTable.Unknown
          return {
            toolCallId: `get_weather-${context.stepIndex}`,
            name: 'get_weather',
            output: { city, forecast: row.forecast },
          }
        },
      },
    },
  ],
}

export default demoWeatherSkill
