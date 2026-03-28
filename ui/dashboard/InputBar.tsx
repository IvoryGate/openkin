import { useState, useRef, useEffect, useCallback } from 'react'
import { clsx } from 'clsx'
import { useChatStore } from '../store'

interface InputBarProps {
  onSend: (content: string) => void
}

export function InputBar({ onSend }: InputBarProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isStreaming = useChatStore((state) => state.isStreaming)

  // 自动调整高度
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
    }
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [input, adjustHeight])

  const handleSend = () => {
    if (!input.trim() || isStreaming) return
    onSend(input)
    setInput('')
    // 重置高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 px-8 pb-6">
      {/* 浮动胶囊容器 */}
      <div className="max-w-4xl mx-auto bg-surface-container-lowest rounded-xl shadow-ghost">
        <div className="flex items-end gap-3 p-4">
          {/* 输入框 */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
              disabled={isStreaming}
              className={clsx(
                'w-full px-4 py-3 bg-transparent text-on-surface resize-none min-h-[44px] max-h-[200px]',
                'font-manrope leading-relaxed placeholder:text-secondary',
                'focus:outline-none',
                isStreaming && 'opacity-50 cursor-not-allowed'
              )}
              rows={1}
            />
          </div>

          {/* 发送按钮 */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className={clsx(
              'p-3 rounded-lg bg-primary text-on-primary hover:bg-primary-hover',
              'transition-all duration-300 flex items-center justify-center',
              (!input.trim() || isStreaming) && 'opacity-50 cursor-not-allowed'
            )}
            aria-label="发送消息"
          >
            {isStreaming ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* 提示文本 */}
      <p className="text-center text-label-md text-secondary mt-3 font-manrope">
        按 Enter 发送消息，Shift+Enter 换行
      </p>
    </div>
  )
}
