import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiKeyInput } from '@renderer/components'
import type { ApiKeyConfig } from '@renderer/types'

export default function Step2ApiKey() {
  const navigate = useNavigate()
  const [apiKeys, setApiKeys] = useState<ApiKeyConfig>({
    openai: '',
    anthropic: '',
    customEndpoint: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  
  // 加载已保存的 API Keys
  useEffect(() => {
    const loadApiKeys = async () => {
      try {
        const keys = await window.electronAPI.config.getApiKeys()
        setApiKeys(keys)
      } catch (error) {
        console.error('Failed to load API keys:', error)
      }
    }
    loadApiKeys()
  }, [])
  
  const handleSave = async () => {
    if (!apiKeys.openai.trim()) {
      alert('请输入 OpenAI API Key')
      return
    }
    
    setIsSaving(true)
    try {
      await window.electronAPI.config.saveApiKeys(apiKeys)
      navigate('/onboarding/create-agent')
    } catch (error) {
      console.error('Failed to save API keys:', error)
      alert('保存失败，请重试')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-text-primary mb-2">
          配置 API Key
        </h2>
        <p className="text-text-secondary">
          配置你的 AI 服务 API Key，用于与 AI 模型通信
        </p>
      </div>
      
      <div className="space-y-5">
        <ApiKeyInput
          type="openai"
          label="OpenAI API Key"
          placeholder="sk-..."
          value={apiKeys.openai}
          onChange={(value) => setApiKeys((prev) => ({ ...prev, openai: value }))}
          required
          hint="从 platform.openai.com 获取"
        />
        
        <ApiKeyInput
          type="anthropic"
          label="Anthropic API Key"
          placeholder="sk-ant-..."
          value={apiKeys.anthropic}
          onChange={(value) => setApiKeys((prev) => ({ ...prev, anthropic: value }))}
          hint="选填，用于 Claude 模型"
        />
        
        <div className="space-y-2">
          <label className="block text-sm font-medium text-text-primary">
            自定义 API 端点
          </label>
          <input
            type="url"
            value={apiKeys.customEndpoint}
            onChange={(e) => setApiKeys((prev) => ({ ...prev, customEndpoint: e.target.value }))}
            placeholder="https://api.example.com/v1"
            className="input"
          />
          <p className="text-xs text-text-muted">选填，用于自定义或代理 API 端点</p>
        </div>
      </div>
      
      <div className="pt-4">
        <button
          onClick={handleSave}
          disabled={isSaving || !apiKeys.openai.trim()}
          className="btn btn-primary btn-md w-full"
        >
          {isSaving ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              保存中...
            </>
          ) : (
            '下一步'
          )}
        </button>
      </div>
      
      <p className="text-xs text-text-muted text-center">
        你的 API Key 将被加密存储在本地，不会上传到任何服务器
      </p>
    </div>
  )
}
