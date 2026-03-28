import { contextBridge, ipcRenderer } from 'electron'

// Preload 脚本 - 暴露安全的 IPC API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 配置相关
  config: {
    getInitialized: () => ipcRenderer.invoke('config:getInitialized'),
    getApiKeys: () => ipcRenderer.invoke('config:getApiKeys'),
    saveApiKeys: (keys: unknown) => ipcRenderer.invoke('config:saveApiKeys', keys),
  },
  // API Key 验证
  api: {
    validate: (params: { type: 'openai' | 'anthropic'; key: string }) => 
      ipcRenderer.invoke('api:validate', params),
  },
  // Agent 相关
  agent: {
    list: () => ipcRenderer.invoke('agent:list'),
    create: (params: unknown) => ipcRenderer.invoke('agent:create', params),
    getSoul: (agentId: string) => ipcRenderer.invoke('agent:getSoul', agentId),
    saveSoul: (agentId: string, content: string) => 
      ipcRenderer.invoke('agent:saveSoul', agentId, content),
    delete: (agentId: string) => ipcRenderer.invoke('agent:delete', agentId),
  },
  // 对话相关
  chat: {
    send: (params: { agentId: string; message: string; sessionId: string; history?: { role: string; content: string }[] }) => 
      ipcRenderer.invoke('chat:send', params),
    onToken: (callback: (data: { messageId: string; content: string }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data as { messageId: string; content: string })
      ipcRenderer.on('chat:token', listener)
      return () => ipcRenderer.off('chat:token', listener)
    },
    onDone: (callback: (data: { messageId: string }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data as { messageId: string })
      ipcRenderer.on('chat:done', listener)
      return () => ipcRenderer.off('chat:done', listener)
    },
    onError: (callback: (data: { code: string; message: string }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data as { code: string; message: string })
      ipcRenderer.on('chat:error', listener)
      return () => ipcRenderer.off('chat:error', listener)
    },
  },
})
