import { useNavigate } from 'react-router-dom'

export default function Step1Welcome() {
  const navigate = useNavigate()

  return (
    <div className="text-center space-y-12">
      {/* Logo 和标题 */}
      <div className="space-y-6">
        <div className="text-7xl mb-6 opacity-70">📚</div>
        <h1 className="font-notoSerif text-display-lg text-on-surface">
          欢迎来到数字书斋
        </h1>
        <p className="font-manrope text-lg text-secondary max-w-lg mx-auto leading-relaxed">
          你的个人 AI 助手工作台，在宁静的数字环境中创建专属于你的智能 Agent
        </p>
      </div>

      {/* 功能介绍 */}
      <div className="grid grid-cols-3 gap-6 text-center">
        <div className="card p-6 rounded-lg">
          <div className="text-4xl mb-3">🤖</div>
          <div className="font-manrope font-medium text-on-surface">多 Agent</div>
          <div className="text-sm text-secondary mt-2 font-manrope">创建多个专属助手</div>
        </div>
        <div className="card p-6 rounded-lg">
          <div className="text-4xl mb-3">💡</div>
          <div className="font-manrope font-medium text-on-surface">智能对话</div>
          <div className="text-sm text-secondary mt-2 font-manrope">流式响应体验</div>
        </div>
        <div className="card p-6 rounded-lg">
          <div className="text-4xl mb-3">🔒</div>
          <div className="font-manrope font-medium text-on-surface">本地优先</div>
          <div className="text-sm text-secondary mt-2 font-manrope">数据隐私安全</div>
        </div>
      </div>

      {/* 开始按钮 */}
      <button
        onClick={() => navigate('/onboarding/api-key')}
        className="btn btn-primary btn-lg w-full font-manrope"
      >
        开始设置
      </button>

      <p className="text-sm text-secondary font-manrope">
        整个设置过程大约需要 2 分钟
      </p>
    </div>
  )
}
