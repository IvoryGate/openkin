/**
 * Agent 类型定义
 */
export interface Agent {
  id: string
  name: string
  role: string
  description: string
  createdAt: string
  soulMdPath: string
}

export interface CreateAgentParams {
  name: string
  role: string
  description?: string
  templateId?: string
}

export interface AgentTemplate {
  id: string
  name: string
  icon: string
  description: string
  systemPrompt: string
}
