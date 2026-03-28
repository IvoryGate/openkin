import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAgentStore, useAppStore } from '@renderer/store'
import { SoulEditor } from './SoulEditor'

export default function SettingsPage() {
  const { agentId } = useParams()
  const navigate = useNavigate()
  const { agents } = useAgentStore()
  const { theme, setTheme, language, setLanguage } = useAppStore()
  
  const [activeTab, setActiveTab] = useState<'general' | 'soul' | 'advanced'>('general')
  
  const currentAgent = agents.find((a) => a.id === agentId)
  
  if (!currentAgent) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface">
        <div className="text-center space-y-4">
          <p className="text-text-secondary">Agent 不存在</p>
          <button onClick={() => navigate('/chat')} className="btn btn-primary">
            返回对话
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex bg-surface">
      {/* 侧边导航 */}
      <aside className="w-64 bg-surface-secondary border-r border-border p-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary mb-6"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>返回</span>
        </button>
        
        {/* Agent 信息 */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white text-lg font-medium">
            {currentAgent.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="font-semibold text-text-primary">{currentAgent.name}</h2>
            <p className="text-xs text-text-muted">{currentAgent.role}</p>
          </div>
        </div>
        
        {/* 标签页 */}
        <nav className="space-y-1">
          <button
            onClick={() => setActiveTab('general')}
            className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
              activeTab === 'general'
                ? 'bg-primary/20 text-primary'
                : 'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary'
            }`}
          >
            常规设置
          </button>
          <button
            onClick={() => setActiveTab('soul')}
            className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
              activeTab === 'soul'
                ? 'bg-primary/20 text-primary'
                : 'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary'
            }`}
          >
            Soul 编辑器
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
              activeTab === 'advanced'
                ? 'bg-primary/20 text-primary'
                : 'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary'
            }`}
          >
            高级设置
          </button>
        </nav>
      </aside>
      
      {/* 主内容 */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold text-text-primary">常规设置</h1>
              
              {/* 外观设置 */}
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-2">
                  外观
                </h2>
                
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-medium text-text-primary">主题</label>
                    <p className="text-sm text-text-muted">选择应用的外观主题</p>
                  </div>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
                    className="input w-32"
                  >
                    <option value="dark">深色</option>
                    <option value="light">浅色</option>
                  </select>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-medium text-text-primary">语言</label>
                    <p className="text-sm text-text-muted">选择应用语言</p>
                  </div>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as 'zh-CN' | 'en-US')}
                    className="input w-32"
                  >
                    <option value="zh-CN">简体中文</option>
                    <option value="en-US">English</option>
                  </select>
                </div>
              </section>
              
              {/* Agent 信息 */}
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-2">
                  Agent 信息
                </h2>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      名称
                    </label>
                    <input
                      type="text"
                      value={currentAgent.name}
                      readOnly
                      className="input bg-surface-tertiary cursor-not-allowed"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      角色
                    </label>
                    <input
                      type="text"
                      value={currentAgent.role}
                      readOnly
                      className="input bg-surface-tertiary cursor-not-allowed"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      描述
                    </label>
                    <textarea
                      value={currentAgent.description}
                      readOnly
                      className="input bg-surface-tertiary cursor-not-allowed h-20"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      创建时间
                    </label>
                    <input
                      type="text"
                      value={new Date(currentAgent.createdAt).toLocaleString()}
                      readOnly
                      className="input bg-surface-tertiary cursor-not-allowed"
                    />
                  </div>
                </div>
              </section>
            </div>
          )}
          
          {activeTab === 'soul' && (
            <SoulEditor agentId={currentAgent.id} />
          )}
          
          {activeTab === 'advanced' && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold text-text-primary">高级设置</h1>
              
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-2">
                  数据管理
                </h2>
                
                <div className="flex items-center justify-between p-4 rounded-lg bg-surface-secondary border border-border">
                  <div>
                    <label className="font-medium text-text-primary">清除会话数据</label>
                    <p className="text-sm text-text-muted">删除当前 Agent 的所有对话历史</p>
                  </div>
                  <button className="btn btn-secondary text-red-400 hover:text-red-300">
                    清除数据
                  </button>
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-lg bg-surface-secondary border border-border">
                  <div>
                    <label className="font-medium text-text-primary">删除 Agent</label>
                    <p className="text-sm text-text-muted">永久删除此 Agent 及所有相关数据</p>
                  </div>
                  <button className="btn btn-secondary text-red-400 hover:text-red-300">
                    删除 Agent
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
