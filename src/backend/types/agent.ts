export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  createdAt: string; // ISO 8601
  soulMdPath: string;
}

export interface AgentMeta {
  id: string;
  name: string;
  role: string;
  description: string;
  createdAt: string;
  templateId?: string;
}

export interface CreateAgentParams {
  name: string;
  role?: string;
  description?: string;
  templateId?: 'general' | 'tech' | 'writer';
  systemPrompt?: string;
}
