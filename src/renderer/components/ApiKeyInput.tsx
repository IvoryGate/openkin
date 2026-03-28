import { useState, useCallback } from 'react'
import { clsx } from 'clsx'

type ValidationStatus = 'idle' | 'validating' | 'success' | 'error'
type ApiKeyType = 'openai' | 'anthropic'

interface ApiKeyInputProps {
  type: ApiKeyType
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  hint?: string
  /** 是否显示验证按钮（默认 true） */
  showValidate?: boolean
}

export function ApiKeyInput({
  type,
  label,
  placeholder,
  value,
  onChange,
  required = false,
  hint,
  showValidate = true,
}: ApiKeyInputProps) {
  const [status, setStatus] = useState<ValidationStatus>('idle')
  const [showKey, setShowKey] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleValidate = useCallback(async () => {
    if (!value.trim()) {
      setStatus('idle')
      setErrorMessage('')
      return
    }

    setStatus('validating')
    setErrorMessage('')

    try {
      const result = await window.electronAPI.api.validate({ type, key: value })
      if (result?.ok) {
        setStatus('success')
      } else {
        setStatus('error')
        setErrorMessage(result?.error || 'Key 无效，请检查后重试')
      }
    } catch {
      setStatus('error')
      setErrorMessage('验证请求失败，可先跳过直接保存')
    }
  }, [type, value])

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-text-primary">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="relative">
        <input
          type={showKey ? 'text' : 'password'}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            // 输入变化时重置状态
            if (status !== 'idle') setStatus('idle')
            if (errorMessage) setErrorMessage('')
          }}
          placeholder={placeholder}
          className={clsx(
            'input pr-20',
            status === 'error' && 'input-error',
            status === 'success' && 'border-green-500 focus:border-green-500 focus:ring-green-500'
          )}
        />

        {/* 显示/隐藏按钮 */}
        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          className={clsx(
            'absolute top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary',
            showValidate && value.trim() ? 'right-16' : 'right-10'
          )}
          tabIndex={-1}
        >
          {showKey ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>

        {/* 验证按钮（仅在有值时显示） */}
        {showValidate && value.trim() && (
          <button
            type="button"
            onClick={handleValidate}
            disabled={status === 'validating'}
            className="absolute right-10 top-1/2 -translate-y-1/2 text-xs px-1.5 py-0.5 rounded text-primary border border-primary/40 hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
            tabIndex={-1}
          >
            {status === 'validating' ? '验证中' : '验证'}
          </button>
        )}

        {/* 状态图标 */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {status === 'validating' && (
            <svg className="w-4 h-4 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {status === 'success' && (
            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
          {status === 'error' && (
            <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>

      {/* 提示信息 */}
      {hint && !errorMessage && (
        <p className="text-xs text-text-muted">{hint}</p>
      )}

      {/* 错误信息 */}
      {errorMessage && (
        <p className="text-xs text-red-500">{errorMessage}</p>
      )}

      {/* 验证成功 */}
      {status === 'success' && (
        <p className="text-xs text-green-500">连接成功</p>
      )}
    </div>
  )
}
