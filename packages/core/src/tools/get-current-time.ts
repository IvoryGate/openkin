import type { ToolDefinition, ToolExecutor, ToolExecutionContext } from '../tool-runtime.js'
import type { ToolResult } from '@openkin/shared-contracts'

export const getCurrentTimeToolDefinition: ToolDefinition = {
  name: 'get_current_time',
  description: 'Returns the current UTC time as an ISO 8601 string.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
}

export const getCurrentTimeToolExecutor: ToolExecutor = {
  async execute(_input: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    return {
      toolCallId: `get_current_time-${context.stepIndex}`,
      name: 'get_current_time',
      output: { utc: new Date().toISOString() },
      isError: false,
    }
  },
}
