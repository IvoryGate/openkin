import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Sidebar } from '@renderer/components'
import { useAgentStore, useChatStore } from '@renderer/store'
import { MessageList } from './MessageList'
import { InputBar } from './InputBar'

export default function ChatPage() {
  const { agentId } = useParams()
  const navigate = useNavigate()
  const { agents, activeAgentId, setActiveAgent, fetchAgents } = useAgentStore()
  const { messages, clearMessages, sendMessage, setSessionId } = useChatStore()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  
  // 当前 Agent
  const currentAgent = agents.find((a) => a.id === agentId || a.id === activeAgentId)
  
  // 初始化
  useEffect(() => {
    fetchAgents()
    
    // 设置 WebSocket 事件监听
    const unsubToken = window.electronAPI.chat.onToken((data) => {
      // 流式更新消息内容
      const { updateMessage } = useChatStore.getState()
      const currentMessages = useChatStore.getState().messages
      const msg = currentMessages.find((m) => m.id === data.messageId)
      if (msg) {
        updateMessage(data.messageId, {
          content: msg.content + data.content,
        })
      }
    })
    
    const unsubDone = window.electronAPI.chat.onDone((data) => {
      const { updateMessage, setStreaming } = useChatStore.getState()
      updateMessage(data.messageId, { status: 'done' })
      setStreaming(false)
    })
    
    const unsubError = window.electronAPI.chat.onError((data) => {
      const { updateMessage, setStreaming } = useChatStore.getState()
      // 找到最后一条 assistant 消息
      const currentMessages = useChatStore.getState().messages
      const lastAssistantMsg = [...currentMessages].reverse().find((m) => m.role === 'assistant')
      if (lastAssistantMsg) {
        updateMessage(lastAssistantMsg.id, {
          status: 'error',
          content: `错误: ${data.message}`,
        })
      }
      setStreaming(false)
    })
    
    return () => {
      unsubToken()
      unsubDone()
      unsubError()
    }
  }, [fetchAgents])
  
  // 切换 Agent 时重置会话
  useEffect(() => {
    if (agentId && agentId !== activeAgentId) {
      setActiveAgent(agentId)
      clearMessages()
      setSessionId(null)
    }
  }, [agentId, activeAgentId, setActiveAgent, clearMessages, setSessionId])
  
  const handleSend = (content: string) => {
    if (!currentAgent || !content.trim()) return
    sendMessage(currentAgent.id, content.trim())
  }
  
  const handleSettings = () => {
    if (currentAgent) {
      navigate(`/settings/${currentAgent.id}`)
    }
  }

  return (
    <div className="h-screen flex bg-surface">
      {/* 侧边栏 */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      
      {/* 主内容区 */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* 顶部栏 */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-secondary">
          <div className="flex items-center gap-3">
            {currentAgent && (
              <>
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-medium">
                  {currentAgent.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-semibold text-text-primary">{currentAgent.name}</h2>
                  <p className="text-xs text-text-muted">{currentAgent.role}</p>
                </div>
              </>
            )}
          </div>
          
          {currentAgent && (
            <button
              onClick={handleSettings}
              className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
              title="设置"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
        </header>
        
        {/* 消息列表 */}
        <MessageList messages={messages} />
        
        {/* 输入栏 */}
        <InputBar onSend={handleSend} />
      </main>
    </div>
  )
}
