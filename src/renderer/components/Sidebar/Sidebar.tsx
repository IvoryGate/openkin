import { useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { useAgentStore } from '@renderer/store'
import { AgentListItem } from './AgentListItem'

interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const navigate = useNavigate()
  const { agentId } = useParams()
  const { agents, activeAgentId, setActiveAgent } = useAgentStore()

  const handleAgentClick = (id: string) => {
    setActiveAgent(id)
    navigate(`/chat/${id}`)
  }

  const handleAddAgent = () => {
    navigate('/onboarding/create-agent')
  }

  const handleSettings = (id: string) => {
    navigate(`/settings/${id}`)
  }

  return (
    <aside
      className={clsx(
        'h-full bg-surface-secondary border-r border-border flex flex-col transition-all duration-200',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        {!collapsed && (
          <h1 className="text-lg font-bold text-text-primary">OpenKin</h1>
        )}
        <button
          onClick={onToggle}
          className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
          aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {collapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            )}
          </svg>
        </button>
      </div>

      {/* Agent 列表 */}
      <div className="flex-1 overflow-y-auto py-2">
        {agents.map((agent) => (
          <AgentListItem
            key={agent.id}
            agent={agent}
            active={agent.id === agentId || agent.id === activeAgentId}
            collapsed={collapsed}
            onClick={() => handleAgentClick(agent.id)}
            onSettings={() => handleSettings(agent.id)}
          />
        ))}
      </div>

      {/* 底部操作 */}
      <div className="p-3 border-t border-border">
        <button
          onClick={handleAddAgent}
          className={clsx(
            'w-full btn btn-secondary justify-center',
            collapsed ? 'px-0' : ''
          )}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {!collapsed && <span>新建 Agent</span>}
        </button>
      </div>
    </aside>
  )
}
