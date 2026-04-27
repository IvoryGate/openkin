export {}

declare global {
  interface TheworldDesktopSession {
    id: string
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
      ) => Promise<{ traceId: string }>
      waitRunTerminal: (baseUrl: string, traceId: string, apiKey?: string) => Promise<void>
    }
    agent: {
      listAgents: (baseUrl: string, apiKey?: string) => Promise<TheworldDesktopAgent[]>
    }
  }

  interface Window {
    theworldDesktop?: TheworldDesktopBridge
    openkinDesktop?: TheworldDesktopBridge
  }
}
