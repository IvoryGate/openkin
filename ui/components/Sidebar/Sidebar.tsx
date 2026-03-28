import { useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { useAgentStore } from '../../store'
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
        'h-full bg-surface-container-low flex flex-col transition-all duration-300',
        collapsed ? 'w-20' : 'w-72'
      )}
    >
      {/* 头部 - 品牌标识 */}
      <div className="flex items-center justify-between px-5 py-6">
        {!collapsed && (
          <h1 className="font-notoSerif text-headline-md text-on-surface">OpenKin</h1>
        )}
        <button
          onClick={onToggle}
          className="ml-auto p-2.5 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container-high transition-colors"
          aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {collapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            )}
          </svg>
        </button>
      </div>

      {/* Agent 列表 - 柔和间距 */}
      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-2">
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

      {/* 底部操作 - 新建 Agent */}
      <div className="p-3">
        <button
          onClick={handleAddAgent}
          className={clsx(
            'w-full btn btn-ghost justify-center text-sm',
            collapsed ? 'px-0' : ''
          )}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
          {!collapsed && <span className="font-manrope font-medium">新建 Agent</span>}
        </button>
      </div>
    </aside>
  )
}
