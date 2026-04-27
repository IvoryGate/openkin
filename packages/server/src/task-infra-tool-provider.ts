import { randomUUID } from 'node:crypto'
import { StaticToolProvider, type ToolDefinition, type ToolExecutionContext, type ToolExecutor } from '@theworld/core'
import { createRunError, type ToolResult } from '@theworld/shared-contracts'
import type { Db } from './db/index.js'
import type { TaskTriggerType } from './db/repositories.js'
import { computeInitialNextRun, validateTaskTrigger } from './scheduler.js'

interface CreateTaskToolInput {
  name?: unknown
  agentId?: unknown
  input?: unknown
  triggerType?: unknown
  triggerConfig?: unknown
  enabled?: unknown
  createdBy?: unknown
}

const createTaskToolDefinition: ToolDefinition = {
  name: 'create_task',
  description:
    'Create an infrastructure-level scheduled task (cron/interval/once) in server DB. Use this for reminders or recurring executions; do not create temporary Skills for scheduling.',
  metadata: { surfaceCategory: 'other' },
  inputSchema: {
    type: 'object',
    required: ['name', 'agentId', 'input', 'triggerType', 'triggerConfig'],
    properties: {
      name: { type: 'string', description: 'Human-readable task name.' },
      agentId: { type: 'string', description: 'Agent id to execute at runtime (usually "default").' },
      input: { type: 'string', description: 'Text sent to the agent when the task fires.' },
      triggerType: { type: 'string', enum: ['cron', 'interval', 'once'] },
      triggerConfig: {
        type: 'object',
        description: 'cron={cron}, interval={interval_seconds}, once={once_at}.',
      },
      enabled: { type: 'boolean', description: 'Defaults to true.' },
      createdBy: { type: 'string', enum: ['user', 'agent'], description: 'Defaults to "agent".' },
    },
  },
}

function parseInput(input: Record<string, unknown>): CreateTaskToolInput {
  return input as CreateTaskToolInput
}

function buildValidationError(context: ToolExecutionContext, message: string): ToolResult {
  return {
    toolCallId: `create_task-${context.stepIndex}`,
    name: 'create_task',
    output: createRunError('TOOL_INVALID_INPUT', `create_task: ${message}`, 'tool'),
    isError: true,
  }
}

function resolveTriggerType(raw: unknown): TaskTriggerType | null {
  if (raw === 'cron' || raw === 'interval' || raw === 'once') return raw
  return null
}

function createTaskToolExecutor(db: Db): ToolExecutor {
  return {
    async execute(input: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
      const parsed = parseInput(input)
      const name = typeof parsed.name === 'string' ? parsed.name.trim() : ''
      const agentId = typeof parsed.agentId === 'string' ? parsed.agentId.trim() : ''
      const inputText = typeof parsed.input === 'string' ? parsed.input.trim() : ''
      const triggerType = resolveTriggerType(parsed.triggerType)
      const triggerConfig =
        parsed.triggerConfig && typeof parsed.triggerConfig === 'object'
          ? (parsed.triggerConfig as Record<string, unknown>)
          : null

      if (!name) return buildValidationError(context, 'name is required')
      if (!agentId) return buildValidationError(context, 'agentId is required')
      if (!inputText) return buildValidationError(context, 'input is required')
      if (!triggerType) return buildValidationError(context, 'triggerType must be cron | interval | once')
      if (!triggerConfig) return buildValidationError(context, 'triggerConfig must be an object')
      if (!db.agents.findById(agentId)) return buildValidationError(context, `agent not found: ${agentId}`)

      const triggerErr = validateTaskTrigger(triggerType, triggerConfig)
      if (triggerErr) return buildValidationError(context, triggerErr)

      const now = Date.now()
      const id = randomUUID()
      const cfgStr = JSON.stringify(triggerConfig)
      const nextRunAt = computeInitialNextRun(triggerType, cfgStr, now)
      const enabled = parsed.enabled !== false
      const createdBy = parsed.createdBy === 'user' ? 'user' : 'agent'

      db.tasks.insert({
        id,
        name,
        triggerType,
        triggerConfig: cfgStr,
        agentId,
        input: JSON.stringify({ text: inputText }),
        enabled,
        createdBy,
        createdAt: now,
        nextRunAt,
        webhookUrl: null,
      })

      return {
        toolCallId: `create_task-${context.stepIndex}`,
        name: 'create_task',
        output: {
          task: {
            id,
            name,
            agentId,
            triggerType,
            triggerConfig,
            enabled,
            createdBy,
            nextRunAt,
          },
        },
        isError: false,
      }
    },
  }
}

export function createTaskInfraToolProvider(db: Db): StaticToolProvider {
  return new StaticToolProvider(
    'task-infra',
    'builtin',
    [createTaskToolDefinition],
    { create_task: createTaskToolExecutor(db) },
  )
}
