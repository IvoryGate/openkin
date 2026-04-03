import type { ToolDefinition, ToolExecutor } from '../tool-runtime.js'

export const getCurrentTimeToolDefinition: ToolDefinition = {
  name: 'get_current_time',
  description: 'Returns the current UTC time as an ISO 8601 timestamp string.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
}

export const getCurrentTimeToolExecutor: ToolExecutor = {
  async execute(_input, context) {
    return {
      toolCallId: `get_current_time-${context.stepIndex}`,
      name: 'get_current_time',
      output: { utc: new Date().toISOString() },
    }
  },
}
