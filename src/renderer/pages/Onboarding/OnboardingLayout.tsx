import { useEffect, useCallback } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { ProgressSteps, StepLabels } from '@renderer/components'

const STEPS = [
  { label: '欢迎', path: '/onboarding' },
  { label: 'API 配置', path: '/onboarding/api-key' },
  { label: '创建 Agent', path: '/onboarding/create-agent' },
  { label: '完成', path: '/onboarding/complete' },
]

export default function OnboardingLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  
  // 计算当前步骤
  const currentStepIndex = STEPS.findIndex((step) => step.path === location.pathname)
  
  // 键盘导航
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        // Enter 键进入下一步
        const nextIndex = currentStepIndex + 1
        if (nextIndex < STEPS.length) {
          navigate(STEPS[nextIndex].path)
        }
      }
    },
    [currentStepIndex, navigate]
  )
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
  
  // 跳过引导
  const handleSkip = () => {
    navigate('/chat')
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* 顶部进度条 */}
      <header className="py-8 px-4">
        <ProgressSteps steps={STEPS} currentStep={currentStepIndex} />
        <StepLabels steps={STEPS} currentStep={currentStepIndex} className="mt-3" />
      </header>
      
      {/* 主内容区 */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-lg">
          <Outlet />
        </div>
      </main>
      
      {/* 底部操作栏 */}
      <footer className="py-6 px-4 flex justify-between items-center">
        <button
          onClick={handleSkip}
          className="btn btn-ghost btn-sm"
        >
          跳过引导
        </button>
        
        <div className="flex gap-3">
          {currentStepIndex > 0 && (
            <button
              onClick={() => navigate(STEPS[currentStepIndex - 1].path)}
              className="btn btn-secondary btn-sm"
            >
              上一步
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
