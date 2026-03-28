import type { Agent, CreateAgentParams } from './agent'
import type { ApiKeyConfig, ApiValidateResult } from './config'

/**
 * Electron IPC API 类型定义
 */
export interface ElectronAPI {
  // 配置相关
  config: {
    getInitialized(): Promise<boolean>
    getApiKeys(): Promise<ApiKeyConfig>
    saveApiKeys(keys: Partial<ApiKeyConfig>): Promise<void>
  }
  // API Key 验证
  api: {
    validate(params: { type: 'openai' | 'anthropic'; key: string }): Promise<ApiValidateResult>
  }
  // Agent 相关
  agent: {
    list(): Promise<Agent[]>
    create(params: CreateAgentParams): Promise<Agent>
    getSoul(agentId: string): Promise<string>
    saveSoul(agentId: string, content: string): Promise<void>
    delete(agentId: string): Promise<void>
  }
  // 对话相关
  chat: {
    send(params: { agentId: string; message: string; sessionId: string }): Promise<void>
    onToken(callback: (data: { messageId: string; content: string }) => void): () => void
    onDone(callback: (data: { messageId: string }) => void): () => void
    onError(callback: (data: { code: string; message: string }) => void): () => void
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
