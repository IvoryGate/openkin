import { useState, useEffect } from 'react'
import { clsx } from 'clsx'

interface SoulEditorProps {
  agentId: string
}

// Soul.md 各区块定义 - 基于实际文件格式
const SOUL_SECTIONS = [
  {
    key: 'basic',
    title: '基本信息',
    description: 'Agent 的基本身份信息',
    fields: ['名称', '角色', '描述', '创建时间'],
  },
  {
    key: 'style',
    title: '人格与风格',
    description: 'Agent 的性格特征和沟通方式',
    fields: ['沟通风格', '工作方式', '语言偏好'],
  },
  {
    key: 'ability',
    title: '核心能力',
    description: 'Agent 的专业知识和技能',
    fields: [],
  },
  {
    key: 'prompt',
    title: '系统提示词（System Prompt）',
    description: '定义 Agent 的行为准则和响应方式',
    fields: [],
  },
] as const

type SectionKey = typeof SOUL_SECTIONS[number]['key']

interface SoulContent {
  [key: string]: string
}

export function SoulEditor({ agentId }: SoulEditorProps) {
  const [content, setContent] = useState<SoulContent>({})
  const [rawMarkdown, setRawMarkdown] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [viewMode, setViewMode] = useState<'form' | 'raw'>('raw')

  // 加载 Soul 内容
  useEffect(() => {
    const loadSoul = async () => {
      setIsLoading(true)
      try {
        const soulText = await window.electronAPI.agent.getSoul(agentId)
        if (soulText) {
          setRawMarkdown(soulText)
          // 解析 Markdown 为各区块
          const parsed = parseMarkdown(soulText)
          setContent(parsed)
        }
      } catch (error) {
        console.error('Failed to load soul:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadSoul()
  }, [agentId])

  // 解析 Markdown 为各区块 - 基于实际文件格式
  const parseMarkdown = (text: string): SoulContent => {
    const result: SoulContent = {}
    
    const lines = text.split('\n')
    let currentSection: SectionKey | '' = ''
    let currentContent: string[] = []
    
    for (const line of lines) {
      const headingMatch = line.match(/^##\s+(.+)$/)
      if (headingMatch) {
        // 保存上一个section
        if (currentSection && currentContent.length > 0) {
          result[currentSection] = currentContent.join('\n').trim()
        }
        // 确定新的section
        const title = headingMatch[1].trim()
        const section = SOUL_SECTIONS.find(s => s.title === title)
        currentSection = section?.key || ''
        currentContent = []
      } else if (currentSection) {
        currentContent.push(line)
      }
    }
    
    // 保存最后一个section
    if (currentSection && currentContent.length > 0) {
      result[currentSection] = currentContent.join('\n').trim()
    }
    
    return result
  }

  // 将各区块转换为 Markdown - 基于实际文件格式
  const toMarkdown = (sections: SoulContent): string => {
    let result = '# Agent 个性配置\n\n'
    for (const section of SOUL_SECTIONS) {
      const sectionContent = sections[section.key] || ''
      if (section.key === 'basic' && !sectionContent) {
        // 基本信息使用默认格式
        result += `## ${section.title}\n\n`
      } else {
        result += `## ${section.title}\n\n${sectionContent}\n\n`
      }
    }
    return result.trim()
  }

  // 保存 Soul 内容
  const handleSave = async () => {
    setIsSaving(true)
    try {
      const markdown = viewMode === 'raw' ? rawMarkdown : toMarkdown(content)
      await window.electronAPI.agent.saveSoul(agentId, markdown)
      alert('保存成功！')
      
      // 重新加载
      const soulText = await window.electronAPI.agent.getSoul(agentId)
      setRawMarkdown(soulText)
      const parsed = parseMarkdown(soulText)
      setContent(parsed)
    } catch (error) {
      console.error('Failed to save soul:', error)
      alert('保存失败，请重试')
    } finally {
      setIsSaving(false)
    }
  }

  // 更新区块内容
  const updateSection = (key: SectionKey, value: string) => {
    setContent((prev) => ({ ...prev, [key]: value }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="w-8 h-8 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Soul 编辑器</h1>
        <div className="flex items-center gap-3">
          {/* 视图切换 */}
          <div className="flex rounded-lg bg-surface-secondary p-1">
            <button
              onClick={() => setViewMode('form')}
              className={clsx(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                viewMode === 'form'
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              表单模式
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={clsx(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                viewMode === 'raw'
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              原始 Markdown
            </button>
          </div>
          
          {/* 保存按钮 */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn btn-primary btn-sm"
          >
            {isSaving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                保存中...
              </>
            ) : (
              '保存'
            )}
          </button>
        </div>
      </div>
      
      <p className="text-text-secondary">
        Soul 定义了 Agent 的性格、知识和行为准则。修改后保存即可生效。
      </p>
      
      {viewMode === 'form' ? (
        <div className="space-y-6">
          {SOUL_SECTIONS.map((section) => (
            <div key={section.key} className="space-y-2">
              <div>
                <label className="block font-medium text-text-primary">
                  {section.title}
                </label>
                <p className="text-sm text-text-muted">{section.description}</p>
              </div>
              <textarea
                value={content[section.key] || ''}
                onChange={(e) => updateSection(section.key, e.target.value)}
                className="input resize-none h-32 font-mono text-sm"
                placeholder={`输入 ${section.title} 内容...`}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={rawMarkdown}
            onChange={(e) => setRawMarkdown(e.target.value)}
            className="input resize-none h-[500px] font-mono text-sm"
            placeholder="# Agent 个性配置

## 基本信息
- 名称: ...
- 角色: ...
- 描述: ...
- 创建时间: ...

## 人格与风格
- 沟通风格: ...
- 工作方式: ...
- 语言偏好: ...

## 核心能力
- ...

## 系统提示词（System Prompt）
..."
          />
        </div>
      )}
    </div>
  )
}
