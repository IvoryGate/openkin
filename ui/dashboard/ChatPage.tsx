import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Sidebar } from '../components'
import { useAgentStore, useChatStore } from '../store'
import { MessageList } from './MessageList'
import { InputBar } from './InputBar'

export default function ChatPage() {
  const { agentId } = useParams()
  const navigate = useNavigate()
  const { agents, activeAgentId, setActiveAgent, fetchAgents } = useAgentStore()
  const { messages, clearMessages, sendMessage, setSessionId } = useChatStore()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [rightPanelOpen, setRightPanelOpen] = useState(false)

  // 当前 Agent
  const currentAgent = agents.find((a) => a.id === agentId || a.id === activeAgentId)

  // 初始化
  useEffect(() => {
    fetchAgents()

    // 设置 WebSocket 事件监听
    const unsubToken = window.electronAPI.chat.onToken((data) => {
      const { updateMessage } = useChatStore.getState()
      const currentMessages = useChatStore.getState().messages
      // 优先按 messageId 查找，找不到则找最后一条 streaming 状态的 assistant 消息
      const msg = currentMessages.find((m) => m.id === data.messageId)
        ?? [...currentMessages].reverse().find((m) => m.role === 'assistant' && m.status === 'streaming')
      if (msg) {
        updateMessage(msg.id, {
          content: msg.content + (data.content || ''),
        })
      }
    })

    const unsubDone = window.electronAPI.chat.onDone((data) => {
      const { updateMessage, setStreaming } = useChatStore.getState()
      const currentMessages = useChatStore.getState().messages
      // 优先按 messageId 查找，找不到则找最后一条 streaming 状态的 assistant 消息
      const msg = currentMessages.find((m) => m.id === data.messageId)
        ?? [...currentMessages].reverse().find((m) => m.role === 'assistant' && m.status === 'streaming')
      if (msg) {
        updateMessage(msg.id, { status: 'done' })
      }
      setStreaming(false)
    })

    const unsubError = window.electronAPI.chat.onError((data) => {
      const { updateMessage, setStreaming } = useChatStore.getState()
      // 找到最后一条 streaming 状态的 assistant 消息
      const currentMessages = useChatStore.getState().messages
      const lastAssistantMsg = [...currentMessages].reverse().find((m) => m.role === 'assistant' && m.status === 'streaming')
        ?? [...currentMessages].reverse().find((m) => m.role === 'assistant')
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
      {/* 左侧栏 - 导航 (Layer 1) */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* 中间栏 - The Study (Layer 0) */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* 顶部栏 - 毛玻璃效果 */}
        <header className="glass sticky top-0 z-10 flex items-center justify-between px-8 py-5 border-b border-transparent">
          <div className="flex items-center gap-4">
            {currentAgent && (
              <>
                <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-on-primary font-manrope font-medium text-lg">
                  {currentAgent.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-notoSerif text-headline-md text-on-surface">{currentAgent.name}</h2>
                  <p className="text-label-md text-secondary font-manrope mt-0.5">{currentAgent.role}</p>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* 记忆管理按钮 */}
            <button
              onClick={() => navigate('/memories')}
              className="p-2 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container-high transition-colors"
              title="记忆管理"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </button>

            {/* 任务管理按钮 */}
            <button
              onClick={() => navigate('/tasks')}
              className="p-2 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container-high transition-colors"
              title="任务管理"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </button>

            {/* 用户画像按钮 */}
            <button
              onClick={() => navigate('/profile')}
              className="p-2 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container-high transition-colors"
              title="用户画像"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>

            {currentAgent && (
              <button
                onClick={handleSettings}
                className="p-2 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container-high transition-colors"
                title="设置"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
          </div>
        </header>

        {/* 消息列表 - 书籍布局风格 */}
        <MessageList messages={messages} />

        {/* 输入栏 - 浮动胶囊样式 */}
        <InputBar onSend={handleSend} />
      </main>

      {/* 右侧栏 - 工具/上下文 (Layer 1) */}
      {rightPanelOpen && (
        <aside className="w-72 bg-surface-container-low border-l border-transparent flex flex-col">
          <div className="flex items-center justify-between px-5 py-4">
            <h3 className="font-notoSerif text-on-surface">项目技能</h3>
            <button
              onClick={() => setRightPanelOpen(false)}
              className="p-1.5 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container-high transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 技能列表 */}
          <div className="flex-1 overflow-y-auto px-5 py-2 space-y-3">
            {/* 示例技能项 */}
            <div className="card-interactive rounded-lg p-3">
              <h4 className="font-manrope font-medium text-on-surface text-sm">代码分析</h4>
              <p className="text-xs text-secondary mt-1">分析代码结构和逻辑</p>
            </div>
            <div className="card-interactive rounded-lg p-3">
              <h4 className="font-manrope font-medium text-on-surface text-sm">文档生成</h4>
              <p className="text-xs text-secondary mt-1">自动生成项目文档</p>
            </div>
            <div className="card-interactive rounded-lg p-3">
              <h4 className="font-manrope font-medium text-on-surface text-sm">单元测试</h4>
              <p className="text-xs text-secondary mt-1">生成测试用例</p>
            </div>
          </div>

          {/* 文件列表 */}
          <div className="border-t border-transparent px-5 py-4">
            <h3 className="font-notoSerif text-on-surface mb-3">文件</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-secondary hover:text-on-surface cursor-pointer transition-colors p-2 hover:bg-surface-container-high rounded-md">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-xs font-manrope">README.md</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-secondary hover:text-on-surface cursor-pointer transition-colors p-2 hover:bg-surface-container-high rounded-md">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-xs font-manrope">package.json</span>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* 右侧栏切换按钮 */}
      {!rightPanelOpen && (
        <button
          onClick={() => setRightPanelOpen(true)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 p-2 rounded-l-lg bg-surface-container-low text-secondary hover:text-on-surface hover:bg-surface-container-high transition-colors border border-transparent border-r-0 shadow-ghost"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  )
}
