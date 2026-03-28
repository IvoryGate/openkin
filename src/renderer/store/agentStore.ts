import { create } from 'zustand'
import type { Agent, CreateAgentParams, AgentTemplate } from '@renderer/types'

// Agent 预置模板
export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'general',
    name: '通用助手',
    icon: '🤖',
    description: '全能型助手，适合日常问答和通用任务',
    systemPrompt: '你是一个全能型AI助手，友好、高效，能处理各类问题。',
  },
  {
    id: 'tech',
    name: '技术专家',
    icon: '💻',
    description: '专注技术问题，擅长代码、架构和调试',
    systemPrompt: '你是一个资深技术专家，擅长编程、系统设计和技术分析，回答严谨、有条理。',
  },
  {
    id: 'writer',
    name: '写作助手',
    icon: '✍️',
    description: '创意写作、文案优化和内容生成',
    systemPrompt: '你是一个专业写作助手，擅长各类文字创作，文笔流畅、富有创意。',
  },
]

interface AgentState {
  agents: Agent[]
  activeAgentId: string | null
  isLoading: boolean
  
  // Actions
  setAgents: (agents: Agent[]) => void
  setActiveAgent: (id: string | null) => void
  addAgent: (agent: Agent) => void
  removeAgent: (id: string) => void
  updateAgent: (id: string, patch: Partial<Agent>) => void
  setLoading: (loading: boolean) => void
  
  // 异步操作
  fetchAgents: () => Promise<void>
  createAgent: (params: CreateAgentParams) => Promise<Agent | null>
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  activeAgentId: null,
  isLoading: false,

  setAgents: (agents) => set({ agents }),
  setActiveAgent: (id) => set({ activeAgentId: id }),
  addAgent: (agent) => set((state) => ({ agents: [...state.agents, agent] })),
  removeAgent: (id) => set((state) => ({ 
    agents: state.agents.filter((a) => a.id !== id),
    activeAgentId: state.activeAgentId === id ? null : state.activeAgentId
  })),
  updateAgent: (id, patch) => set((state) => ({
    agents: state.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)),
  })),
  setLoading: (loading) => set({ isLoading: loading }),

  fetchAgents: async () => {
    set({ isLoading: true })
    try {
      const agents = await window.electronAPI.agent.list()
      set({ agents, isLoading: false })
    } catch (error) {
      console.error('Failed to fetch agents:', error)
      set({ isLoading: false })
    }
  },

  createAgent: async (params) => {
    try {
      const agent = await window.electronAPI.agent.create(params)
      set((state) => ({ 
        agents: [...state.agents, agent],
        activeAgentId: agent.id 
      }))
      return agent
    } catch (error) {
      console.error('Failed to create agent:', error)
      return null
    }
  },
}))
