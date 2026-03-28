import { useState, useCallback, useEffect } from 'react'
import { useAgentStore } from '@renderer/store'
import type { Agent, CreateAgentParams } from '@renderer/types'

/**
 * Agent 操作 Hook
 * 封装 Agent 相关的常用操作
 */
export function useAgent(agentId?: string) {
  const {
    agents,
    activeAgentId,
    isLoading,
    fetchAgents,
    createAgent,
    setActiveAgent,
    updateAgent,
    removeAgent,
  } = useAgentStore()
  
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null)
  
  // 根据 ID 获取当前 Agent
  useEffect(() => {
    if (agentId) {
      const agent = agents.find((a) => a.id === agentId)
      setCurrentAgent(agent || null)
    } else if (activeAgentId) {
      const agent = agents.find((a) => a.id === activeAgentId)
      setCurrentAgent(agent || null)
    } else {
      setCurrentAgent(null)
    }
  }, [agentId, activeAgentId, agents])
  
  // 创建新 Agent
  const create = useCallback(
    async (params: CreateAgentParams) => {
      const agent = await createAgent(params)
      return agent
    },
    [createAgent]
  )
  
  // 删除 Agent
  const remove = useCallback(
    async (id: string) => {
      try {
        await window.electronAPI.agent.delete(id)
        removeAgent(id)
        return true
      } catch (error) {
        console.error('Failed to delete agent:', error)
        return false
      }
    },
    [removeAgent]
  )
  
  // 获取 Soul 内容
  const getSoul = useCallback(async (id: string) => {
    try {
      const content = await window.electronAPI.agent.getSoul(id)
      return content
    } catch (error) {
      console.error('Failed to get soul:', error)
      return null
    }
  }, [])
  
  // 保存 Soul 内容
  const saveSoul = useCallback(async (id: string, content: string) => {
    try {
      await window.electronAPI.agent.saveSoul(id, content)
      return true
    } catch (error) {
      console.error('Failed to save soul:', error)
      return false
    }
  }, [])
  
  return {
    agents,
    currentAgent,
    activeAgentId,
    isLoading,
    fetchAgents,
    create,
    remove,
    setActiveAgent,
    updateAgent,
    getSoul,
    saveSoul,
  }
}

/**
 * 初始化 Agent 列表
 */
export function useAgentList() {
  const { agents, isLoading, fetchAgents } = useAgentStore()
  
  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])
  
  return { agents, isLoading, refetch: fetchAgents }
}
