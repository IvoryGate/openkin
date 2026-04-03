import { createRunError } from '@openkin/shared-contracts'
import type { ToolDefinition, ToolExecutor } from '../tool-runtime.js'

export const echoToolDefinition: ToolDefinition = {
  name: 'echo',
  description: 'Echoes the input text back as output. Useful for verifying the tool call pipeline.',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'The text to echo back' },
    },
    required: ['text'],
  },
}

export const echoToolExecutor: ToolExecutor = {
  async execute(input, context) {
    if (typeof input.text !== 'string') {
      return {
        toolCallId: `echo-${context.stepIndex}`,
        name: 'echo',
        output: createRunError('TOOL_EXECUTION_FAILED', 'echo: input.text must be a string', 'tool'),
        isError: true,
      }
    }
    return {
      toolCallId: `echo-${context.stepIndex}`,
      name: 'echo',
      output: { text: input.text },
    }
  },
}
