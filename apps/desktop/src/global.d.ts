export {}

declare global {
  interface OpenKinDesktopSession {
    id: string
    displayName?: string | null
    agentId?: string | null
    updatedAt?: number | null
    createdAt?: number | null
  }

  interface OpenKinDesktopMessage {
    id: string
    sessionId: string
    role: 'user' | 'assistant' | 'tool' | 'system'
    content: string
    createdAt: number
  }

  interface Window {
    openkinDesktop?: {
      platform: string
      appName: string
      session: {
        listSessions: (baseUrl: string, apiKey?: string) => Promise<OpenKinDesktopSession[]>
        getSessionMessages: (
          baseUrl: string,
          sessionId: string,
          apiKey?: string,
        ) => Promise<OpenKinDesktopMessage[]>
        createRun: (
          baseUrl: string,
          sessionId: string,
          text: string,
          apiKey?: string,
        ) => Promise<{ traceId: string }>
        waitRunTerminal: (baseUrl: string, traceId: string, apiKey?: string) => Promise<void>
      }
    }
  }
}
