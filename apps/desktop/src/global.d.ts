export {}

declare global {
  interface TheworldDesktopSession {
    id: string
    kind?: 'chat' | 'task' | 'channel'
    displayName?: string | null
    agentId?: string | null
    updatedAt?: number | null
    createdAt?: number | null
  }

  interface TheworldDesktopMessage {
    id: string
    sessionId: string
    role: 'user' | 'assistant' | 'tool' | 'system'
    content: string
    createdAt: number
  }

  interface TheworldDesktopAgent {
    id: string
    name?: string | null
    displayName?: string | null
    avatarUrl?: string | null
    avatar?: string | null
    iconUrl?: string | null
    imageUrl?: string | null
    description?: string | null
    systemPrompt?: string | null
    model?: string | null
    enabled?: boolean
    isBuiltin?: boolean
  }

  interface TheworldDesktopTask {
    id: string
    name: string
    triggerType: string
    triggerConfig: Record<string, unknown>
    agentId: string
    enabled: boolean
    createdBy: string
    createdAt: number
    nextRunAt: number | null
    webhookUrl?: string | null
  }

  interface TheworldDesktopTaskRun {
    id: string
    taskId: string | null
    status: string
    progress: number | null
    output: unknown | null
    error: unknown | null
    traceId: string | null
    sessionId: string | null
    retryCount: number
    startedAt: number
    completedAt: number | null
  }

  interface TheworldDesktopBridge {
    platform: string
    appName: string
    session: {
      listSessions: (baseUrl: string, apiKey?: string) => Promise<TheworldDesktopSession[]>
      probeRunSurface: (baseUrl: string, apiKey?: string) => Promise<boolean>
      createSessionMessage: (
        baseUrl: string,
        sessionId: string,
        content: string,
        role?: 'user' | 'assistant' | 'system',
        apiKey?: string,
      ) => Promise<TheworldDesktopMessage>
      createSession: (
        baseUrl: string,
        apiKey?: string,
      ) => Promise<{ id: string; kind: 'chat' | 'task' | 'channel' }>
      getSessionMessages: (
        baseUrl: string,
        sessionId: string,
        apiKey?: string,
      ) => Promise<TheworldDesktopMessage[]>
      getSessionMessagesPaged: (
        baseUrl: string,
        sessionId: string,
        apiKey?: string,
        before?: number,
      ) => Promise<{ messages: TheworldDesktopMessage[]; hasMore: boolean }>
      getSession: (
        baseUrl: string,
        sessionId: string,
        apiKey?: string,
      ) => Promise<TheworldDesktopSession | null>
      patchSession: (
        baseUrl: string,
        sessionId: string,
        patch: { displayName?: string },
        apiKey?: string,
      ) => Promise<TheworldDesktopSession | null>
      deleteSession: (
        baseUrl: string,
        sessionId: string,
        apiKey?: string,
      ) => Promise<void>
      createRun: (
        baseUrl: string,
        sessionId: string,
        text: string,
        apiKey?: string,
        options?: {
          agentId?: string
          executionMode?: string
          streamAttachment?: 'attached' | 'detached'
          attachments?: Array<
            | {
                kind: 'image'
                url: string
                mimeType?: string
                detail?: 'auto' | 'low' | 'high'
              }
            | {
                kind: 'file'
                ref: string
                name?: string
                mimeType?: string
                sizeBytes?: number
              }
          >
        },
      ) => Promise<{ traceId: string }>
      waitRunTerminal: (baseUrl: string, traceId: string, apiKey?: string) => Promise<void>
      streamRunUntilTerminal: (
        baseUrl: string,
        traceId: string,
        apiKey: string | undefined,
        onEvent: (event: { type: string; traceId: string; payload: unknown }) => void,
      ) => Promise<void>
      getRunContext: (
        baseUrl: string,
        traceId: string,
        apiKey?: string,
      ) => Promise<Record<string, unknown> | null>
      listApprovals: (
        baseUrl: string,
        apiKey?: string,
      ) => Promise<
        Array<{
          id: string
          traceId: string
          sessionId: string
          summary: string
          status: string
          toolName?: string
        }>
      >
      approveApproval: (
        baseUrl: string,
        approvalId: string,
        apiKey?: string,
        body?: { reason?: string },
      ) => Promise<{ ok: boolean }>
      denyApproval: (
        baseUrl: string,
        approvalId: string,
        apiKey?: string,
        body?: { reason?: string },
      ) => Promise<{ ok: boolean }>
      getRunTrace: (baseUrl: string, traceId: string, apiKey?: string) => Promise<unknown | null>
      cancelRun: (baseUrl: string, traceId: string, apiKey?: string) => Promise<{ cancelled: boolean }>
      pickFile?: () => Promise<{ ref: string; name: string; mimeType: string }>
      pickImage?: () => Promise<{ url: string; mimeType: string }>
    }
    agent: {
      listAgents: (baseUrl: string, apiKey?: string) => Promise<TheworldDesktopAgent[]>
      createAgent: (
        baseUrl: string,
        payload: {
          id?: string
          name: string
          description?: string
          systemPrompt: string
          model?: string
        },
        apiKey?: string,
      ) => Promise<TheworldDesktopAgent>
      updateAgent: (
        baseUrl: string,
        agentId: string,
        payload: {
          name?: string
          description?: string
          systemPrompt?: string
          model?: string
        },
        apiKey?: string,
      ) => Promise<TheworldDesktopAgent>
      deleteAgent: (baseUrl: string, agentId: string, apiKey?: string) => Promise<void>
      enableAgent: (baseUrl: string, agentId: string, apiKey?: string) => Promise<void>
      disableAgent: (baseUrl: string, agentId: string, apiKey?: string) => Promise<void>
    }
    task: {
      listTasks: (baseUrl: string, apiKey?: string) => Promise<TheworldDesktopTask[]>
      createTask: (
        baseUrl: string,
        payload: Record<string, unknown>,
        apiKey?: string,
      ) => Promise<{ id: string; name: string }>
      deleteTask: (baseUrl: string, taskId: string, apiKey?: string) => Promise<void>
      enableTask: (baseUrl: string, taskId: string, apiKey?: string) => Promise<void>
      disableTask: (baseUrl: string, taskId: string, apiKey?: string) => Promise<void>
      triggerTask: (
        baseUrl: string,
        taskId: string,
        apiKey?: string,
      ) => Promise<{ runId: string; traceId: string; sessionId: string }>
      listTaskRuns: (
        baseUrl: string,
        taskId: string,
        apiKey?: string,
      ) => Promise<TheworldDesktopTaskRun[]>
    }
    system: {
      getSystemStatus: (
        baseUrl: string,
        apiKey?: string,
      ) => Promise<{
        taskScheduler?: {
          active?: boolean
          stale?: boolean
          lastTickAt?: number
        }
        heartbeat?: {
          schedulerLastBeatAt?: number
          taskSseLastBeatAt?: number
        }
      }>
      getHealth: (
        baseUrl: string,
        apiKey?: string,
      ) => Promise<{ ok: boolean; version?: string }>
      listTools: (baseUrl: string, apiKey?: string) => Promise<Array<{ id: string; name?: string; description?: string }>>
      listSkills: (baseUrl: string, apiKey?: string) => Promise<Array<{ id: string; name?: string; description?: string }>>
      getConfig: (baseUrl: string, apiKey?: string) => Promise<Record<string, unknown> | null>
    }
  }

  interface Window {
    theworldDesktop?: TheworldDesktopBridge
    openkinDesktop?: TheworldDesktopBridge
  }
}
