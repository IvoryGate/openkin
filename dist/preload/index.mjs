import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("electronAPI", {
  // 配置相关
  config: {
    getInitialized: () => ipcRenderer.invoke("config:getInitialized"),
    getApiKeys: () => ipcRenderer.invoke("config:getApiKeys"),
    saveApiKeys: (keys) => ipcRenderer.invoke("config:saveApiKeys", keys)
  },
  // API Key 验证
  api: {
    validate: (params) => ipcRenderer.invoke("api:validate", params)
  },
  // Agent 相关
  agent: {
    list: () => ipcRenderer.invoke("agent:list"),
    create: (params) => ipcRenderer.invoke("agent:create", params),
    getSoul: (agentId) => ipcRenderer.invoke("agent:getSoul", agentId),
    saveSoul: (agentId, content) => ipcRenderer.invoke("agent:saveSoul", agentId, content),
    delete: (agentId) => ipcRenderer.invoke("agent:delete", agentId)
  },
  // 对话相关
  chat: {
    send: (params) => ipcRenderer.invoke("chat:send", params),
    onToken: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on("chat:token", listener);
      return () => ipcRenderer.off("chat:token", listener);
    },
    onDone: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on("chat:done", listener);
      return () => ipcRenderer.off("chat:done", listener);
    },
    onError: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on("chat:error", listener);
      return () => ipcRenderer.off("chat:error", listener);
    }
  }
});
