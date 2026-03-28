import { useState, useEffect } from 'react'
import { clsx } from 'clsx'

interface SoulEditorProps {
  agentId: string
}

// Soul.md 各区块定义
const SOUL_SECTIONS = [
  {
    key: 'identity',
    title: '身份',
    description: '定义 Agent 的基本身份和角色',
  },
  {
    key: 'knowledge',
    title: '知识',
    description: 'Agent 拥有的专业知识领域',
  },
  {
    key: 'behavior',
    title: '行为准则',
    description: 'Agent 的行为规范和限制',
  },
  {
    key: 'style',
    title: '对话风格',
    description: 'Agent 的沟通方式和语调',
  },
  {
    key: 'examples',
    title: '示例对话',
    description: '典型对话示例',
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
  const [viewMode, setViewMode] = useState<'form' | 'raw'>('form')

  // 加载 Soul 内容
  useEffect(() => {
    const loadSoul = async () => {
      setIsLoading(true)
      try {
        const soulText = await window.electronAPI.agent.getSoul(agentId)
        setRawMarkdown(soulText)
        // 解析 Markdown 为各区块
        const parsed = parseMarkdown(soulText)
        setContent(parsed)
      } catch (error) {
        console.error('Failed to load soul:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadSoul()
  }, [agentId])

  // 解析 Markdown 为各区块
  const parseMarkdown = (text: string): SoulContent => {
    const result: SoulContent = {}
    let currentSection = ''
    let currentContent: string[] = []
    
    const lines = text.split('\n')
    for (const line of lines) {
      const headingMatch = line.match(/^##\s+(.+)$/)
      if (headingMatch) {
        if (currentSection && currentContent.length > 0) {
          result[currentSection] = currentContent.join('\n').trim()
        }
        currentSection = headingMatch[1].toLowerCase()
        currentContent = []
      } else if (currentSection) {
        currentContent.push(line)
      }
    }
    
    if (currentSection && currentContent.length > 0) {
      result[currentSection] = currentContent.join('\n').trim()
    }
    
    return result
  }

  // 将各区块转换为 Markdown
  const toMarkdown = (sections: SoulContent): string => {
    let result = '# Soul\n\n'
    for (const section of SOUL_SECTIONS) {
      const sectionContent = sections[section.key] || ''
      result += `## ${section.title}\n\n${sectionContent}\n\n`
    }
    return result.trim()
  }

  // 保存 Soul 内容
  const handleSave = async () => {
    setIsSaving(true)
    try {
      const markdown = viewMode === 'raw' ? rawMarkdown : toMarkdown(content)
      await window.electronAPI.agent.saveSoul(agentId, markdown)
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
                onChange={(e) => updateSection(section.key as SectionKey, e.target.value)}
                className="input resize-none h-32"
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
            placeholder="# Soul&#10;&#10;## 身份&#10;&#10;Agent 的身份定义...&#10;&#10;## 知识&#10;&#10;Agent 拥有的知识..."
          />
        </div>
      )}
    </div>
  )
}
