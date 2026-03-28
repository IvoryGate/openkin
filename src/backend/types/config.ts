export interface ApiKeyConfig {
  openai: string;
  anthropic: string;
  customEndpoint: string;
}

export interface AppConfig {
  version: string;
  initialized: boolean;
  active_agent_id: string | null;
  api_keys: {
    openai: string;      // encrypted
    anthropic: string;   // encrypted
    custom_endpoint: string;
  };
  ui: {
    theme: 'dark' | 'light';
    language: string;
  };
}
