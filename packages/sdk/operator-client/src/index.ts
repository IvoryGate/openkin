import {
  type ApiEnvelope,
  type CreateTaskRequest,
  type CreateTaskResponseBody,
  type ListLogsRequest,
  type ListLogsResponseBody,
  type ListSkillsApiResponseBody,
  type ListTaskRunsResponseBody,
  type ListTasksResponseBody,
  type ListToolsResponseBody,
  type ToolSurfaceCategoryDto,
  type ListSessionRunsRequest,
  type ListSessionRunsResponseBody,
  type SystemStatusResponseBody,
  type TraceSummaryDto,
  type TaskDto,
  type TriggerTaskResponseBody,
  type RiskClassDto,
  type ApprovalStatusDto,
  type ApprovalRecordDto,
  type ApprovalEventDto,
  type CreateApprovalRequestBody,
  type ResolveApprovalRequestBody,
  type ContextBuildReportDto,
  type GetRunContextResponseBody,
  type GetApprovalResponseBody,
  type ListApprovalsResponseBody,
  type CreateApprovalResponseBody,
  type ContextBlockDescriptorDto,
  type ContextBlockLayerDto,
  type MemorySourceKindDto,
  apiPathLogs,
  apiPathRunContext,
  apiPathSkills,
  apiPathSystemStatus,
  apiPathTask,
  apiPathTaskDisable,
  apiPathTaskEnable,
  apiPathTaskRuns,
  apiPathTaskTrigger,
  apiPathTasks,
  apiPathTools,
  apiPathSessionRuns,
  apiPathApprovals,
  apiPathApproval,
  apiPathApprovalApprove,
  apiPathApprovalDeny,
  apiPathApprovalCancel,
  createRunError,
} from '@theworld/shared-contracts'

export type {
  CreateRunRequest,
  RunInputDto,
  RunAttachmentInputDto,
  ToolSurfaceCategoryDto,
  CreateTaskRequest,
  ListLogsRequest,
  ListLogsResponseBody,
  ListSessionRunsRequest,
  ListSessionRunsResponseBody,
  TraceSummaryDto,
  ListSkillsApiResponseBody,
  ListTaskRunsResponseBody,
  ListTasksResponseBody,
  ListToolsResponseBody,
  SystemStatusResponseBody,
  TaskDto,
  TriggerTaskResponseBody,
  RunId,
  RunExecutionMode,
  RunStreamAttachment,
  EventPlaneDomain,
  EventPlaneSubject,
  EventPlaneEnvelopeV1,
  TaskRunSourceDto,
  RiskClassDto,
  ApprovalStatusDto,
  ApprovalRecordDto,
  ApprovalEventDto,
  CreateApprovalRequestBody,
  ResolveApprovalRequestBody,
  ContextBuildReportDto,
  GetRunContextResponseBody,
  GetApprovalResponseBody,
  ListApprovalsResponseBody,
  CreateApprovalResponseBody,
  ContextBlockDescriptorDto,
  ContextBlockLayerDto,
  MemorySourceKindDto,
} from '@theworld/shared-contracts'

export {
  apiPathApprovals,
  apiPathApprovalEvents,
  apiPathApproval,
  apiPathApprovalApprove,
  apiPathApprovalDeny,
  apiPathApprovalCancel,
  apiPathRunContext,
} from '@theworld/shared-contracts'

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

function throwFromEnvelope<T>(env: ApiEnvelope<T>, httpStatus: number): never {
  if (env.error) {
    throw env.error
  }
  throw createRunError('RUN_INTERNAL_ERROR', `Request failed (HTTP ${httpStatus})`, 'runtime')
}

export interface TheWorldOperatorClientOptions {
  baseUrl: string
  apiKey?: string
  fetch?: typeof fetch
}

export interface TheWorldOperatorClient {
  getSystemStatus(): Promise<SystemStatusResponseBody>
  listLogs(params?: ListLogsRequest): Promise<ListLogsResponseBody>
  listTools(): Promise<ListToolsResponseBody>
  listSkills(): Promise<ListSkillsApiResponseBody>
  listTasks(): Promise<ListTasksResponseBody>
  getTask(taskId: string): Promise<TaskDto>
  createTask(request: CreateTaskRequest): Promise<TaskDto>
  triggerTask(taskId: string): Promise<TriggerTaskResponseBody>
  enableTask(taskId: string): Promise<void>
  disableTask(taskId: string): Promise<void>
  listTaskRuns(taskId: string): Promise<ListTaskRunsResponseBody>
  /** List runs (traces) for a session. Operator surface — exec plan 046. */
  listSessionRuns(sessionId: string, params?: ListSessionRunsRequest): Promise<ListSessionRunsResponseBody>
  /** L3 094 / L4 101: prompt assembly report per run step. */
  getRunContext(traceId: string): Promise<GetRunContextResponseBody>
  /** L3 093 / L4 103: in-memory approval queue. */
  listApprovals(): Promise<ListApprovalsResponseBody>
  getApproval(approvalId: string): Promise<ApprovalRecordDto>
  createApproval(request: CreateApprovalRequestBody): Promise<ApprovalRecordDto>
  approveApproval(approvalId: string, body?: ResolveApprovalRequestBody): Promise<ApprovalRecordDto>
  denyApproval(approvalId: string, body?: ResolveApprovalRequestBody): Promise<ApprovalRecordDto>
  cancelApproval(approvalId: string): Promise<ApprovalRecordDto>
}

export function createTheWorldOperatorClient(
  options: TheWorldOperatorClientOptions,
): TheWorldOperatorClient {
  const base = normalizeBaseUrl(options.baseUrl)
  const fetchFn = options.fetch ?? globalThis.fetch

  function authHeaders(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { ...extra }
    if (options.apiKey) {
      h.Authorization = `Bearer ${options.apiKey}`
    }
    return h
  }

  async function readEnvelope<T>(res: Response): Promise<ApiEnvelope<T>> {
    const text = await res.text()
    try {
      return JSON.parse(text) as ApiEnvelope<T>
    } catch {
      throw createRunError('RUN_INTERNAL_ERROR', `Invalid JSON response (HTTP ${res.status})`, 'runtime')
    }
  }

  return {
    async getSystemStatus(): Promise<SystemStatusResponseBody> {
      const res = await fetchFn(`${base}${apiPathSystemStatus()}`, { method: 'GET', headers: authHeaders() })
      const env = await readEnvelope<SystemStatusResponseBody>(res)
      if (!res.ok || !env.ok || !env.data) {
        throwFromEnvelope(env, res.status)
      }
      return env.data
    },

    async listLogs(params?: ListLogsRequest): Promise<ListLogsResponseBody> {
      const q = new URLSearchParams()
      if (params?.date) q.set('date', params.date)
      if (params?.level) q.set('level', params.level)
      if (params?.limit != null) q.set('limit', String(params.limit))
      if (params?.before != null) q.set('before', String(params.before))
      if (params?.search) q.set('search', params.search)
      const qs = q.toString()
      const path = `${apiPathLogs()}${qs ? `?${qs}` : ''}`
      const res = await fetchFn(`${base}${path}`, { method: 'GET', headers: authHeaders() })
      const env = await readEnvelope<ListLogsResponseBody>(res)
      if (!res.ok || !env.ok || env.data?.logs === undefined) {
        throwFromEnvelope(env, res.status)
      }
      return env.data
    },

    async listTools(): Promise<ListToolsResponseBody> {
      const res = await fetchFn(`${base}${apiPathTools()}`, { method: 'GET', headers: authHeaders() })
      const env = await readEnvelope<ListToolsResponseBody>(res)
      if (!res.ok || !env.ok || env.data?.tools === undefined) {
        throwFromEnvelope(env, res.status)
      }
      return env.data
    },

    async listSkills(): Promise<ListSkillsApiResponseBody> {
      const res = await fetchFn(`${base}${apiPathSkills()}`, { method: 'GET', headers: authHeaders() })
      const env = await readEnvelope<ListSkillsApiResponseBody>(res)
      if (!res.ok || !env.ok || env.data?.skills === undefined) {
        throwFromEnvelope(env, res.status)
      }
      return env.data
    },

    async listTasks(): Promise<ListTasksResponseBody> {
      const res = await fetchFn(`${base}${apiPathTasks()}`, { method: 'GET', headers: authHeaders() })
      const env = await readEnvelope<ListTasksResponseBody>(res)
      if (!res.ok || !env.ok || env.data?.tasks === undefined) {
        throwFromEnvelope(env, res.status)
      }
      return env.data
    },

    async getTask(taskId: string): Promise<TaskDto> {
      const res = await fetchFn(`${base}${apiPathTask(taskId)}`, { method: 'GET', headers: authHeaders() })
      const env = await readEnvelope<{ task: TaskDto }>(res)
      if (!res.ok || !env.ok || !env.data?.task) {
        throwFromEnvelope(env, res.status)
      }
      return env.data.task
    },

    async createTask(request: CreateTaskRequest): Promise<TaskDto> {
      const res = await fetchFn(`${base}${apiPathTasks()}`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json; charset=utf-8' }),
        body: JSON.stringify(request),
      })
      const env = await readEnvelope<CreateTaskResponseBody>(res)
      if (!res.ok || !env.ok || !env.data?.task) {
        throwFromEnvelope(env, res.status)
      }
      return env.data.task
    },

    async triggerTask(taskId: string): Promise<TriggerTaskResponseBody> {
      const res = await fetchFn(`${base}${apiPathTaskTrigger(taskId)}`, {
        method: 'POST',
        headers: authHeaders(),
      })
      const env = await readEnvelope<TriggerTaskResponseBody>(res)
      if (!res.ok || !env.ok || !env.data?.traceId) {
        throwFromEnvelope(env, res.status)
      }
      return env.data
    },

    async enableTask(taskId: string): Promise<void> {
      const res = await fetchFn(`${base}${apiPathTaskEnable(taskId)}`, {
        method: 'POST',
        headers: authHeaders(),
      })
      const env = await readEnvelope<{ id: string; enabled: boolean }>(res)
      if (!res.ok || !env.ok) {
        throwFromEnvelope(env, res.status)
      }
    },

    async disableTask(taskId: string): Promise<void> {
      const res = await fetchFn(`${base}${apiPathTaskDisable(taskId)}`, {
        method: 'POST',
        headers: authHeaders(),
      })
      const env = await readEnvelope<{ id: string; enabled: boolean }>(res)
      if (!res.ok || !env.ok) {
        throwFromEnvelope(env, res.status)
      }
    },

    async listTaskRuns(taskId: string): Promise<ListTaskRunsResponseBody> {
      const res = await fetchFn(`${base}${apiPathTaskRuns(taskId)}`, { method: 'GET', headers: authHeaders() })
      const env = await readEnvelope<ListTaskRunsResponseBody>(res)
      if (!res.ok || !env.ok || env.data?.runs === undefined) {
        throwFromEnvelope(env, res.status)
      }
      return env.data
    },

    async listSessionRuns(sessionId: string, params?: ListSessionRunsRequest): Promise<ListSessionRunsResponseBody> {
      const q = new URLSearchParams()
      if (params?.status) q.set('status', params.status)
      if (params?.limit != null) q.set('limit', String(params.limit))
      if (params?.before != null) q.set('before', String(params.before))
      const qs = q.toString()
      const path = `${apiPathSessionRuns(sessionId)}${qs ? `?${qs}` : ''}`
      const res = await fetchFn(`${base}${path}`, { method: 'GET', headers: authHeaders() })
      const env = await readEnvelope<ListSessionRunsResponseBody>(res)
      if (!res.ok || !env.ok || env.data?.runs === undefined) {
        throwFromEnvelope(env, res.status)
      }
      return env.data
    },

    async getRunContext(traceId: string): Promise<GetRunContextResponseBody> {
      const path = apiPathRunContext(traceId)
      const res = await fetchFn(`${base}${path}`, { method: 'GET', headers: authHeaders() })
      const env = await readEnvelope<GetRunContextResponseBody>(res)
      if (!res.ok || !env.ok || env.data?.steps === undefined) {
        throwFromEnvelope(env, res.status)
      }
      return env.data
    },

    async listApprovals(): Promise<ListApprovalsResponseBody> {
      const res = await fetchFn(`${base}${apiPathApprovals()}`, { method: 'GET', headers: authHeaders() })
      const env = await readEnvelope<ListApprovalsResponseBody>(res)
      if (!res.ok || !env.ok || !Array.isArray(env.data?.approvals)) {
        throwFromEnvelope(env, res.status)
      }
      return env.data
    },

    async getApproval(approvalId: string): Promise<ApprovalRecordDto> {
      const res = await fetchFn(`${base}${apiPathApproval(approvalId)}`, { method: 'GET', headers: authHeaders() })
      const env = await readEnvelope<GetApprovalResponseBody>(res)
      if (!res.ok || !env.ok || !env.data?.approval) {
        throwFromEnvelope(env, res.status)
      }
      return env.data.approval
    },

    async createApproval(request: CreateApprovalRequestBody): Promise<ApprovalRecordDto> {
      const res = await fetchFn(`${base}${apiPathApprovals()}`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json; charset=utf-8' }),
        body: JSON.stringify(request),
      })
      const env = await readEnvelope<CreateApprovalResponseBody>(res)
      if (!res.ok || !env.ok || !env.data?.approval) {
        throwFromEnvelope(env, res.status)
      }
      return env.data.approval
    },

    async approveApproval(approvalId: string, body?: ResolveApprovalRequestBody): Promise<ApprovalRecordDto> {
      const res = await fetchFn(`${base}${apiPathApprovalApprove(approvalId)}`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json; charset=utf-8' }),
        body: JSON.stringify(body ?? {}),
      })
      const env = await readEnvelope<GetApprovalResponseBody>(res)
      if (!res.ok || !env.ok || !env.data?.approval) {
        throwFromEnvelope(env, res.status)
      }
      return env.data.approval
    },

    async denyApproval(approvalId: string, body?: ResolveApprovalRequestBody): Promise<ApprovalRecordDto> {
      const res = await fetchFn(`${base}${apiPathApprovalDeny(approvalId)}`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json; charset=utf-8' }),
        body: JSON.stringify(body ?? {}),
      })
      const env = await readEnvelope<GetApprovalResponseBody>(res)
      if (!res.ok || !env.ok || !env.data?.approval) {
        throwFromEnvelope(env, res.status)
      }
      return env.data.approval
    },

    async cancelApproval(approvalId: string): Promise<ApprovalRecordDto> {
      const res = await fetchFn(`${base}${apiPathApprovalCancel(approvalId)}`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json; charset=utf-8' }),
        body: '{}',
      })
      const env = await readEnvelope<GetApprovalResponseBody>(res)
      if (!res.ok || !env.ok || !env.data?.approval) {
        throwFromEnvelope(env, res.status)
      }
      return env.data.approval
    },
  }
}

