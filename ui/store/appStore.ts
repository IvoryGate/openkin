import { create } from 'zustand'
import type { Theme, Language } from '../types'

interface AppState {
  initialized: boolean
  theme: Theme
  language: Language
  activeAgentId: string | null
  
  // Actions
  setInitialized: (v: boolean) => void
  setTheme: (theme: Theme) => void
  setLanguage: (language: Language) => void
  setActiveAgentId: (id: string | null) => void
  
  // 初始化应用状态
  initApp: () => Promise<void>
}

export const useAppStore = create<AppState>((set) => ({
  initialized: false,
  theme: 'dark',
  language: 'zh-CN',
  activeAgentId: null,

  setInitialized: (v) => set({ initialized: v }),
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
  setActiveAgentId: (id) => set({ activeAgentId: id }),

  initApp: async () => {
    try {
      const initialized = await window.electronAPI.config.getInitialized()
      set({ initialized })
    } catch (error) {
      console.error('Failed to init app:', error)
      set({ initialized: false })
    }
  },
}))
