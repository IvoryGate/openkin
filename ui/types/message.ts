/**
 * 消息类型定义
 */
export type MessageRole = 'user' | 'assistant' | 'system'
export type MessageStatus = 'sending' | 'streaming' | 'done' | 'error'

export interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: number
  status: MessageStatus
  agentId?: string
  sessionId?: string
}

export interface ChatSession {
  id: string
  agentId: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}
