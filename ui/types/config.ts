/**
 * 配置类型定义
 */
export type Theme = 'light' | 'dark'
export type Language = 'zh-CN' | 'en-US'

export interface ApiKeyConfig {
  openai: string
  anthropic: string
  customEndpoint: string
}

export interface AppConfig {
  version: string
  initialized: boolean
  active_agent_id: string | null
  api_keys: ApiKeyConfig
  ui: {
    theme: Theme
    language: Language
  }
}

export interface ApiValidateResult {
  ok: boolean
  error?: string
}
