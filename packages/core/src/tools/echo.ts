import type { ToolDefinition, ToolExecutor, ToolExecutionContext } from '../tool-runtime.js'
import { createRunError } from '@theworld/shared-contracts'
import type { ToolResult } from '@theworld/shared-contracts'

export const echoToolDefinition: ToolDefinition = {
  name: 'echo',
  description: 'Echo back the input text as-is. Useful for verifying tool call routing.',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'The text to echo back' },
    },
    required: ['text'],
  },
}

export const echoToolExecutor: ToolExecutor = {
  async execute(input: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const text = input.text
    if (typeof text !== 'string') {
      return {
        toolCallId: `echo-${context.stepIndex}`,
        name: 'echo',
        output: createRunError('TOOL_EXECUTION_FAILED', 'echo: input.text must be a string', 'tool', { input }),
        isError: true,
      }
    }
    return {
      toolCallId: `echo-${context.stepIndex}`,
      name: 'echo',
      output: { text },
      isError: false,
    }
  },
}
