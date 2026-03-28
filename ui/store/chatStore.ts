import { create } from 'zustand'
import type { Message } from '../types'

interface ChatState {
  messages: Message[]
  isStreaming: boolean
  sessionId: string | null
  
  // Actions
  setMessages: (messages: Message[]) => void
  appendMessage: (msg: Message) => void
  updateMessage: (id: string, patch: Partial<Message>) => void
  clearMessages: () => void
  setStreaming: (streaming: boolean) => void
  setSessionId: (id: string | null) => void
  
  // 生成唯一ID
  generateId: () => string
  
  // 发送消息
  sendMessage: (agentId: string, content: string) => Promise<void>
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  sessionId: null,

  setMessages: (messages) => set({ messages }),
  appendMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  updateMessage: (id, patch) => set((state) => ({
    messages: state.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
  })),
  clearMessages: () => set({ messages: [], sessionId: null }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  setSessionId: (id) => set({ sessionId: id }),

  generateId: () => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  },

  sendMessage: async (agentId, content) => {
    const { sessionId, generateId, appendMessage, updateMessage, setStreaming } = get()
    
    // 创建会话ID（如果是新会话）
    const currentSessionId = sessionId || generateId()
    if (!sessionId) {
      set({ sessionId: currentSessionId })
    }
    
    // 创建用户消息
    const userMessageId = generateId()
    const userMessage: Message = {
      id: userMessageId,
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'done',
      sessionId: currentSessionId,
      agentId,
    }
    appendMessage(userMessage)
    
    // 创建助手消息占位
    const assistantMessageId = generateId()
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'streaming',
      sessionId: currentSessionId,
      agentId,
    }
    appendMessage(assistantMessage)
    
    setStreaming(true)
    
    // 构建历史消息（不含当前用户消息和助手占位）
    const currentMessages = get().messages
    const history = currentMessages
      .filter((m) => m.id !== userMessageId && m.id !== assistantMessageId && m.status === 'done')
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      await window.electronAPI.chat.send({
        agentId,
        message: content,
        sessionId: currentSessionId,
        history,
      })
    } catch (error) {
      updateMessage(assistantMessageId, { 
        status: 'error',
        content: '发送失败，请重试'
      })
      setStreaming(false)
    }
  },
}))
