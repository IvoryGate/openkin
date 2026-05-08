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
      createRun: (
        baseUrl: string,
        sessionId: string,
        text: string,
        apiKey?: string,
        options?: {
          agentId?: string
          executionMode?: 'foreground' | 'background'
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
      getRunTrace: (baseUrl: string, traceId: string, apiKey?: string) => Promise<unknown | null>
      cancelRun: (baseUrl: string, traceId: string, apiKey?: string) => Promise<{ cancelled: boolean }>
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
    }
  }

  interface Window {
    theworldDesktop?: TheworldDesktopBridge
    openkinDesktop?: TheworldDesktopBridge
  }
}
