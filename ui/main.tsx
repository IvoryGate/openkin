import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'

// 开发环境下注入 Mock electronAPI（仅在非 Electron 环境中生效）
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - import.meta.env 由 Vite 注入
if (import.meta.env.DEV && typeof window.electronAPI === 'undefined') {
  const BACKEND = 'http://127.0.0.1:7788'
  const WS_BACKEND = 'ws://127.0.0.1:7788'

  const apiFetch = async (path: string, init?: RequestInit) => {
    const res = await fetch(`${BACKEND}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
    const json = await res.json()
    return json.data ?? json
  }

  // WS 聊天事件回调注册表
  type TokenCb = (data: { messageId: string; content: string }) => void
  type DoneCb = (data: { messageId: string }) => void
  type ErrorCb = (data: { code: string; message: string }) => void

  const tokenListeners: TokenCb[] = []
  const doneListeners: DoneCb[] = []
  const errorListeners: ErrorCb[] = []

  // 开发环境下注入 mock electronAPI
  window.electronAPI = {
    config: {
      getInitialized: () => apiFetch('/api/config/initialized').then(d => d.initialized ?? false),
      getApiKeys: () => apiFetch('/api/config/keys'),
      saveApiKeys: (keys: unknown) =>
        apiFetch('/api/config/save-keys', { method: 'POST', body: JSON.stringify(keys) }),
    },
    api: {
      validate: (params: unknown) =>
        apiFetch('/api/config/validate-key', { method: 'POST', body: JSON.stringify(params) }),
    },
    agent: {
      list: () => apiFetch('/api/agents'),
      create: (params: unknown) =>
        apiFetch('/api/agents', { method: 'POST', body: JSON.stringify(params) }),
      getSoul: (agentId: string) =>
        apiFetch(`/api/agents/${agentId}/soul`).then((d: { content?: string }) => d.content ?? ''),
      saveSoul: (agentId: string, content: string) =>
        apiFetch(`/api/agents/${agentId}/soul`, { method: 'PUT', body: JSON.stringify({ content }) }),
      delete: (agentId: string) =>
        apiFetch(`/api/agents/${agentId}`, { method: 'DELETE' }),
    },
    chat: {
      /**
       * 通过 WebSocket 发送聊天消息，token/done/error 通过全局回调推送
       */
      send: (params: { agentId: string; message: string; sessionId: string; history?: unknown[] }) => {
        return new Promise<void>((resolve, reject) => {
          const ws = new WebSocket(`${WS_BACKEND}/ws/chat`)
          ws.onopen = () => {
            ws.send(JSON.stringify({
              type: 'chat',
              agentId: params.agentId,
              sessionId: params.sessionId,
              message: params.message,
              history: params.history ?? [],
            }))
            resolve()
          }
          ws.onmessage = (event) => {
            try {
              const msg = JSON.parse(event.data as string)
              if (msg.type === 'token') {
                tokenListeners.forEach(cb => cb({ messageId: msg.messageId, content: msg.content || '' }))
              } else if (msg.type === 'done') {
                doneListeners.forEach(cb => cb({ messageId: msg.messageId }))
                ws.close()
              } else if (msg.type === 'error') {
                errorListeners.forEach(cb => cb({ code: msg.code, message: msg.message }))
                ws.close()
              }
            } catch (e) {
              console.error('[Dev WS] parse error', e)
            }
          }
          ws.onerror = (e) => {
            console.error('[Dev WS] error', e)
            errorListeners.forEach(cb => cb({ code: 'WS_ERROR', message: 'WebSocket 连接失败' }))
            reject(new Error('WebSocket connection failed'))
          }
          ws.onclose = (e) => {
            if (!e.wasClean && e.code !== 1000) {
              console.warn('[Dev WS] closed unexpectedly', e.code, e.reason)
            }
          }
        })
      },
      onToken: (cb: TokenCb) => {
        tokenListeners.push(cb)
        return () => {
          const idx = tokenListeners.indexOf(cb)
          if (idx !== -1) tokenListeners.splice(idx, 1)
        }
      },
      onDone: (cb: DoneCb) => {
        doneListeners.push(cb)
        return () => {
          const idx = doneListeners.indexOf(cb)
          if (idx !== -1) doneListeners.splice(idx, 1)
        }
      },
      onError: (cb: ErrorCb) => {
        errorListeners.push(cb)
        return () => {
          const idx = errorListeners.indexOf(cb)
          if (idx !== -1) errorListeners.splice(idx, 1)
        }
      },
    },
  }

  console.info('[Dev] electronAPI mock injected → backend:', BACKEND)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
