import { clsx } from 'clsx'
import type { Message } from '../types'
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
        'flex gap-4',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* 头像 */}
      <div
        className={clsx(
          'w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center font-manrope',
          isUser ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface'
        )}
      >
        {isUser ? (
          <svg className="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )}
      </div>

      {/* 消息内容 - 纸质书布局风格 */}
      <div
        className={clsx(
          'flex-1 max-w-3xl',
          !isUser && 'pt-1'
        )}
      >
        {/* 消息体 */}
        {isUser ? (
          <div className="bg-surface-container-low rounded-lg px-5 py-3.5 inline-block">
            <p className="font-manrope text-on-surface whitespace-pre-wrap break-words leading-relaxed">
              {message.content}
            </p>
          </div>
        ) : (
          <div className="prose prose-stone prose-lg max-w-none font-manrope text-on-surface leading-relaxed">
            <ReactMarkdown
              components={{
                code({ className, children, ...props }) {
                  const isInline = !className
                  if (isInline) {
                    return (
                      <code className="bg-surface-container-low px-2 py-0.5 rounded text-sm text-primary" {...props}>
                        {children}
                      </code>
                    )
                  }
                  return (
                    <code className={clsx('block code-block font-mono text-sm', className)} {...props}>
                      {children}
                    </code>
                  )
                },
                h1: ({ children }) => <h1 className="font-notoSerif text-2xl text-on-surface mt-8 mb-4">{children}</h1>,
                h2: ({ children }) => <h2 className="font-notoSerif text-xl text-on-surface mt-6 mb-3">{children}</h2>,
                h3: ({ children }) => <h3 className="font-notoSerif text-lg text-on-surface mt-4 mb-2">{children}</h3>,
                p: ({ children }) => <p className="mb-4">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-2">{children}</ol>,
                li: ({ children }) => <li>{children}</li>,
                a: ({ children, href }) => (
                  <a
                    href={href}
                    className="text-primary hover:underline underline-offset-2"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {message.content || (isStreaming ? '' : '...')}
            </ReactMarkdown>
          </div>
        )}

        {/* 流式光标 - 仅 Assistant 消息 */}
        {isStreaming && !isUser && (
          <span className="cursor-blink" />
        )}

        {/* 错误状态 */}
        {isError && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-600 font-manrope">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>发送失败，请重试</span>
          </div>
        )}

        {/* 加载动画 */}
        {message.status === 'sending' && !isUser && (
          <div className="dots-loading text-secondary mt-2">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </div>
        )}
      </div>
    </div>
  )
}
