import { useNavigate } from 'react-router-dom'

export default function Step1Welcome() {
  const navigate = useNavigate()
  
  return (
    <div className="text-center space-y-8">
      {/* Logo 和标题 */}
      <div className="space-y-4">
        <div className="text-6xl mb-4">🚀</div>
        <h1 className="text-3xl font-bold text-text-primary">
          欢迎使用 OpenKin
        </h1>
        <p className="text-text-secondary text-lg max-w-md mx-auto">
          你的个人 AI 助手工作台，创建专属于你的智能 Agent
        </p>
      </div>
      
      {/* 功能介绍 */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="p-4 rounded-lg bg-surface-secondary">
          <div className="text-2xl mb-2">🤖</div>
          <div className="text-sm font-medium text-text-primary">多 Agent</div>
          <div className="text-xs text-text-muted mt-1">创建多个专属助手</div>
        </div>
        <div className="p-4 rounded-lg bg-surface-secondary">
          <div className="text-2xl mb-2">💡</div>
          <div className="text-sm font-medium text-text-primary">智能对话</div>
          <div className="text-xs text-text-muted mt-1">流式响应体验</div>
        </div>
        <div className="p-4 rounded-lg bg-surface-secondary">
          <div className="text-2xl mb-2">🔒</div>
          <div className="text-sm font-medium text-text-primary">本地优先</div>
          <div className="text-xs text-text-muted mt-1">数据隐私安全</div>
        </div>
      </div>
      
      {/* 开始按钮 */}
      <button
        onClick={() => navigate('/onboarding/api-key')}
        className="btn btn-primary btn-lg w-full"
      >
        开始设置
      </button>
      
      <p className="text-xs text-text-muted">
        整个设置过程大约需要 2 分钟
      </p>
    </div>
  )
}
