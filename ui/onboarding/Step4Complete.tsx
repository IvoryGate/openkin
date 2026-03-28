import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, useAgentStore } from '../store'

export default function Step4Complete() {
  const navigate = useNavigate()
  const { setInitialized, activeAgentId } = useAppStore()
  const { agents } = useAgentStore()
  
  useEffect(() => {
    // 标记初始化完成
    setInitialized(true)
  }, [setInitialized])
  
  const handleStart = () => {
    if (activeAgentId) {
      navigate(`/chat/${activeAgentId}`)
    } else if (agents.length > 0) {
      navigate(`/chat/${agents[0].id}`)
    } else {
      navigate('/chat')
    }
  }
  
  return (
    <div className="text-center space-y-12">
      {/* 成功图标 */}
      <div className="space-y-6">
        <div className="w-24 h-24 mx-auto rounded-full bg-[#8B7355]/20 flex items-center justify-center">
          <svg className="w-12 h-12 text-[#8B7355]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="font-notoSerif text-display-lg text-on-surface">
          设置完成！
        </h1>

        <p className="font-manrope text-lg text-secondary max-w-md mx-auto leading-relaxed">
          一切就绪，现在你可以开始与你的 Agent 对话了
        </p>
      </div>

      {/* 快捷提示 */}
      <div className="card p-6 text-left space-y-4">
        <h3 className="font-manrope font-medium text-on-surface mb-4">💡 快捷提示</h3>
        <div className="flex items-start gap-3 text-sm font-manrope">
          <span className="text-primary">•</span>
          <span className="text-secondary">你可以随时创建新的 Agent 来处理不同类型的任务</span>
        </div>
        <div className="flex items-start gap-3 text-sm font-manrope">
          <span className="text-primary">•</span>
          <span className="text-secondary">点击 Agent 列表中的设置图标可以修改 Agent 的 Soul（系统提示词）</span>
        </div>
        <div className="flex items-start gap-3 text-sm font-manrope">
          <span className="text-primary">•</span>
          <span className="text-secondary">所有数据都存储在本地，你的隐私得到保护</span>
        </div>
      </div>

      {/* 开始按钮 */}
      <button
        onClick={handleStart}
        className="btn btn-primary btn-lg w-full font-manrope"
      >
        开始对话
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </button>
    </div>
  )
}
