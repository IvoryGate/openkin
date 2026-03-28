export interface ApiKeyConfig {
  openai: string;
  anthropic: string;
  customEndpoint: string;
  /** 自定义端点使用的模型名，默认 LongCat-Flash-Chat */
  customModel?: string;
}

export interface AppConfig {
  version: string;
  initialized: boolean;
  active_agent_id: string | null;
  api_keys: {
    openai: string;      // encrypted
    anthropic: string;   // encrypted
    custom_endpoint: string;
    custom_model?: string;
  };
  ui: {
    theme: 'dark' | 'light';
    language: string;
  };
}
