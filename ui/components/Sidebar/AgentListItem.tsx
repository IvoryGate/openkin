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

  // 根据角色选择颜色 - 自然色调
  const avatarColors = [
    'bg-[#8B7355]', // 棕色
    'bg-[#6B8E23]', // 橄榄绿
    'bg-[#778899]', // 蓝灰色
    'bg-[#A0522D]', // 赭色
    'bg-[#483D8B]', // 深紫罗兰
    'bg-[#2F4F4F]', // 深青色
  ]
  const colorIndex = agent.name.charCodeAt(0) % avatarColors.length
  const avatarColor = avatarColors[colorIndex]

  if (collapsed) {
    return (
      <button
        onClick={onClick}
        className={clsx(
          'w-11 h-11 mx-auto mb-2 rounded-full flex items-center justify-center text-on-primary font-manrope font-medium transition-all duration-300',
          avatarColor,
          active
            ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface-container-low'
            : 'hover:opacity-80'
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
        'group flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-300',
        active
          ? 'bg-surface-container-high text-on-surface'
          : 'text-secondary hover:bg-surface-container-high hover:text-on-surface'
      )}
      onClick={onClick}
    >
      {/* 头像 */}
      <div
        className={clsx(
          'w-10 h-10 rounded-full flex items-center justify-center text-on-primary font-manrope font-medium flex-shrink-0',
          avatarColor
        )}
      >
        {avatar}
      </div>

      {/* 信息 */}
      <div className="flex-1 min-w-0">
        <div className="font-manrope font-medium truncate text-on-surface">{agent.name}</div>
        <div className="text-xs text-secondary truncate font-manrope">{agent.role}</div>
      </div>

      {/* 设置按钮 */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onSettings()
        }}
        className={clsx(
          'p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200',
          'hover:bg-surface-container-lowest text-secondary hover:text-on-surface'
        )}
        title="设置"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>
  )
}
