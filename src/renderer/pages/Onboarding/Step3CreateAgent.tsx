import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AgentTemplateCard } from '@renderer/components'
import { useAgentStore, AGENT_TEMPLATES } from '@renderer/store'
import type { AgentTemplate } from '@renderer/types'

export default function Step3CreateAgent() {
  const navigate = useNavigate()
  const { createAgent } = useAgentStore()
  
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  
  // 选择模板时自动填充
  const handleTemplateSelect = (template: AgentTemplate) => {
    setSelectedTemplate(template)
    setName(template.name)
    setDescription(template.description)
  }
  
  const handleCreate = async () => {
    if (!name.trim()) {
      alert('请输入 Agent 名称')
      return
    }
    
    setIsCreating(true)
    try {
      const agent = await createAgent({
        name: name.trim(),
        role: selectedTemplate?.id || 'general',
        description: description.trim() || selectedTemplate?.description || '',
        templateId: selectedTemplate?.id,
      })
      
      if (agent) {
        navigate('/onboarding/complete')
      } else {
        alert('创建失败，请重试')
      }
    } catch (error) {
      console.error('Failed to create agent:', error)
      alert('创建失败，请重试')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-text-primary mb-2">
          创建你的第一个 Agent
        </h2>
        <p className="text-text-secondary">
          选择一个模板快速开始，或自定义你的专属助手
        </p>
      </div>
      
      {/* 模板选择 */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-text-primary">
          选择模板
        </label>
        <div className="grid grid-cols-3 gap-3">
          {AGENT_TEMPLATES.map((template) => (
            <AgentTemplateCard
              key={template.id}
              template={template}
              selected={selectedTemplate?.id === template.id}
              onClick={() => handleTemplateSelect(template)}
            />
          ))}
        </div>
      </div>
      
      {/* 自定义信息 */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-text-primary">
            Agent 名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="给你的助手起个名字"
            className="input"
            maxLength={50}
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium text-text-primary">
            描述
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="简单描述这个 Agent 的用途"
            className="input resize-none h-20"
            maxLength={200}
          />
        </div>
      </div>
      
      {/* 创建按钮 */}
      <button
        onClick={handleCreate}
        disabled={isCreating || !name.trim()}
        className="btn btn-primary btn-md w-full"
      >
        {isCreating ? (
          <>
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            创建中...
          </>
        ) : (
          '创建 Agent'
        )}
      </button>
    </div>
  )
}
