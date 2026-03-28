import { clsx } from 'clsx'

interface Step {
  label: string
  path: string
}

interface ProgressStepsProps {
  steps: Step[]
  currentStep: number
  className?: string
}

export function ProgressSteps({ steps, currentStep, className }: ProgressStepsProps) {
  return (
    <div className={clsx('flex items-center justify-center gap-2', className)}>
      {steps.map((step, index) => (
        <div key={step.path} className="flex items-center">
          {/* 步骤圆点 */}
          <div
            className={clsx(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200',
              index < currentStep
                ? 'bg-primary text-white'
                : index === currentStep
                ? 'bg-primary text-white ring-2 ring-primary ring-offset-2 ring-offset-surface'
                : 'bg-surface-tertiary text-text-muted'
            )}
          >
            {index < currentStep ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              index + 1
            )}
          </div>
          
          {/* 连接线 */}
          {index < steps.length - 1 && (
            <div
              className={clsx(
                'w-12 h-0.5 mx-1 transition-all duration-200',
                index < currentStep ? 'bg-primary' : 'bg-surface-tertiary'
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// 步骤标签显示
interface StepLabelsProps {
  steps: Step[]
  currentStep: number
  className?: string
}

export function StepLabels({ steps, currentStep, className }: StepLabelsProps) {
  return (
    <div className={clsx('flex items-center justify-center gap-8', className)}>
      {steps.map((step, index) => (
        <span
          key={step.path}
          className={clsx(
            'text-sm transition-all duration-200',
            index === currentStep
              ? 'text-text-primary font-medium'
              : 'text-text-muted'
          )}
        >
          {step.label}
        </span>
      ))}
    </div>
  )
}
