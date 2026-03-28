import { clsx } from 'clsx'
import type { Agent } from '../../types'

interface AgentListItemProps {
  agent: Agent
  active: boolean
  collapsed: boolean
  onClick: () => void
  onSettings: () => void
}

export function AgentListItem({ agent, active, collapsed, onClick, onSettings }: AgentListItemProps) {
  // 获取 Agent 头像（名称首字符）
  const avatar = agent.name.charAt(0).toUpperCase()
  
  // 根据角色选择颜色
  const avatarColors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-cyan-500',
  ]
  const colorIndex = agent.name.charCodeAt(0) % avatarColors.length
  const avatarColor = avatarColors[colorIndex]

  if (collapsed) {
    return (
      <button
        onClick={onClick}
        className={clsx(
          'w-10 h-10 mx-3 mb-2 rounded-full flex items-center justify-center text-white font-medium transition-all duration-200',
          avatarColor,
          active ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface-secondary' : 'hover:opacity-80'
        )}
        title={agent.name}
      >
        {avatar}
      </button>
    )
  }

  return (
    <div
      className={clsx(
        'group flex items-center gap-3 px-3 py-2 mx-2 mb-1 rounded-lg cursor-pointer transition-all duration-200',
        active
          ? 'bg-surface-tertiary text-text-primary'
          : 'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary'
      )}
      onClick={onClick}
    >
      {/* 头像 */}
      <div
        className={clsx(
          'w-9 h-9 rounded-full flex items-center justify-center text-white font-medium flex-shrink-0',
          avatarColor
        )}
      >
        {avatar}
      </div>

      {/* 信息 */}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{agent.name}</div>
        <div className="text-xs text-text-muted truncate">{agent.role}</div>
      </div>

      {/* 设置按钮 */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onSettings()
        }}
        className={clsx(
          'p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity',
          'hover:bg-surface hover:text-text-primary'
        )}
        title="设置"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>
  )
}
