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
      cancelRun: (baseUrl: string, traceId: string, apiKey?: string) => Promise<{ cancelled: boolean }>
    }
    agent: {
      listAgents: (baseUrl: string, apiKey?: string) => Promise<TheworldDesktopAgent[]>
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
