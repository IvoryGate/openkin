import { useRef, useEffect } from 'react'
import type { Message } from '../types'
import { MessageBubble } from './MessageBubble'

interface MessageListProps {
  messages: Message[]
}

export function MessageList({ messages }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="empty-state">
          <div className="text-6xl opacity-50">📚</div>
          <div className="text-center space-y-2">
            <h2 className="font-notoSerif text-headline-md text-on-surface">开始你的研究之旅</h2>
            <p className="font-manrope text-secondary max-w-md">
              在下方输入框中输入消息，开始与 AI Agent 对话
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto book-layout"
    >
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
