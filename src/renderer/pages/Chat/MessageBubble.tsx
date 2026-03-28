import { clsx } from 'clsx'
import type { Message } from '@renderer/types'
import ReactMarkdown from 'react-markdown'

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isStreaming = message.status === 'streaming'
  const isError = message.status === 'error'
  
  return (
    <div
      className={clsx(
        'flex gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* 头像 */}
      <div
        className={clsx(
          'w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center',
          isUser ? 'bg-primary' : 'bg-surface-tertiary'
        )}
      >
        {isUser ? (
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
        ) : (
          <span className="text-sm">🤖</span>
        )}
      </div>
      
      {/* 消息内容 */}
      <div
        className={clsx(
          'max-w-[75%] rounded-lg px-4 py-3',
          isUser
            ? 'bg-primary text-white'
            : 'bg-surface-secondary text-text-primary',
          isError && 'border border-red-500'
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              components={{
                code({ className, children, ...props }) {
                  const isInline = !className
                  if (isInline) {
                    return (
                      <code className="bg-surface-tertiary px-1.5 py-0.5 rounded text-sm" {...props}>
                        {children}
                      </code>
                    )
                  }
                  return (
                    <code className={clsx('block bg-surface p-3 rounded-lg text-sm overflow-x-auto', className)} {...props}>
                      {children}
                    </code>
                  )
                },
              }}
            >
              {message.content || (isStreaming ? '' : '...')}
            </ReactMarkdown>
          </div>
        )}
        
        {/* 流式光标 */}
        {isStreaming && !isUser && (
          <span className="cursor-blink" />
        )}
        
        {/* 错误状态 */}
        {isError && (
          <div className="mt-2 flex items-center gap-2 text-xs text-red-400">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>发送失败</span>
          </div>
        )}
        
        {/* 加载动画 */}
        {message.status === 'sending' && !isUser && (
          <div className="dots-loading text-text-muted">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </div>
        )}
      </div>
    </div>
  )
}
