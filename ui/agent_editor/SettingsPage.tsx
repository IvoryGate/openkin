import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAgentStore, useAppStore } from '../store'
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
          <p className="font-manrope text-secondary">Agent 不存在</p>
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
      <aside className="w-72 bg-surface-container-low p-5">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-secondary hover:text-on-surface mb-8 font-manrope"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>返回</span>
        </button>
        
        {/* Agent 信息 */}
        <div className="flex items-center gap-3 mb-8 pb-4">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-on-primary text-lg font-manrope font-medium">
            {currentAgent.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="font-manrope font-semibold text-on-surface">{currentAgent.name}</h2>
            <p className="text-xs text-secondary font-manrope">{currentAgent.role}</p>
          </div>
        </div>
        
        {/* 标签页 */}
        <nav className="space-y-1">
          <button
            onClick={() => setActiveTab('general')}
            className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-300 font-manrope ${
              activeTab === 'general'
                ? 'bg-surface-container-high text-on-surface font-medium'
                : 'text-secondary hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            常规设置
          </button>
          <button
            onClick={() => setActiveTab('soul')}
            className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-300 font-manrope ${
              activeTab === 'soul'
                ? 'bg-surface-container-high text-on-surface font-medium'
                : 'text-secondary hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            Soul 编辑器
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-300 font-manrope ${
              activeTab === 'advanced'
                ? 'bg-surface-container-high text-on-surface font-medium'
                : 'text-secondary hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            高级设置
          </button>
        </nav>
      </aside>
      
      {/* 主内容 */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl book-layout">
          {activeTab === 'general' && (
            <div className="space-y-8">
              <h1 className="font-notoSerif text-headline-md text-on-surface">常规设置</h1>
              
              {/* 外观设置 */}
              <section className="space-y-6">
                <h2 className="font-notoSerif text-lg font-semibold text-on-surface pb-3">
                  外观
                </h2>
                
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-manrope font-medium text-on-surface">主题</label>
                    <p className="text-sm text-secondary font-manrope mt-1">选择应用的外观主题</p>
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
                    <label className="font-manrope font-medium text-on-surface">语言</label>
                    <p className="text-sm text-secondary font-manrope mt-1">选择应用语言</p>
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
              <section className="space-y-6">
                <h2 className="font-notoSerif text-lg font-semibold text-on-surface pb-3">
                  Agent 信息
                </h2>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2 font-manrope">
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
                    <label className="block text-sm font-medium text-secondary mb-2 font-manrope">
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
                    <label className="block text-sm font-medium text-secondary mb-2 font-manrope">
                      描述
                    </label>
                    <textarea
                      value={currentAgent.description}
                      readOnly
                      className="input bg-surface-tertiary cursor-not-allowed h-20"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2 font-manrope">
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
            <div className="space-y-8">
              <h1 className="font-notoSerif text-headline-md text-on-surface">高级设置</h1>

              <section className="space-y-6">
                <h2 className="font-notoSerif text-lg font-semibold text-on-surface pb-3">
                  数据管理
                </h2>
                
                <div className="card p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <label className="font-manrope font-medium text-on-surface">清除会话数据</label>
                      <p className="text-sm text-secondary mt-1 font-manrope">删除当前 Agent 的所有对话历史</p>
                    </div>
                    <button className="btn btn-secondary text-red-600 hover:text-red-700 font-manrope ml-4">
                      清除数据
                    </button>
                  </div>
                </div>

                <div className="card p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <label className="font-manrope font-medium text-on-surface">删除 Agent</label>
                      <p className="text-sm text-secondary mt-1 font-manrope">永久删除此 Agent 及所有相关数据</p>
                    </div>
                    <button className="btn btn-secondary text-red-600 hover:text-red-700 font-manrope ml-4">
                      删除 Agent
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
