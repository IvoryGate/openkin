import { clsx } from 'clsx'
import type { AgentTemplate } from '../../types'

interface AgentTemplateCardProps {
  template: AgentTemplate
  selected: boolean
  onClick: () => void
}

export function AgentTemplateCard({ template, selected, onClick }: AgentTemplateCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'card card-interactive p-4 text-left transition-all duration-200',
        selected
          ? 'border-primary ring-1 ring-primary bg-primary/10'
          : 'border-border hover:border-border-hover'
      )}
    >
      {/* 图标 */}
      <div className="text-3xl mb-3">{template.icon}</div>
      
      {/* 名称 */}
      <h3 className="font-semibold text-text-primary mb-1">{template.name}</h3>
      
      {/* 描述 */}
      <p className="text-sm text-text-secondary">{template.description}</p>
      
      {/* 选中指示器 */}
      {selected && (
        <div className="absolute top-3 right-3">
          <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </button>
  )
}
