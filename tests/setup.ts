import '@testing-library/jest-dom'

// Mock Electron API
const mockElectronAPI = {
  config: {
    getInitialized: () => Promise.resolve(false),
    getApiKeys: () => Promise.resolve({ openai: '', anthropic: '', customEndpoint: '' }),
    saveApiKeys: () => Promise.resolve(),
  },
  api: {
    validate: () => Promise.resolve({ ok: true }),
  },
  agent: {
    list: () => Promise.resolve([]),
    create: () => Promise.resolve({ id: 'test', name: 'Test', role: 'test', description: '', createdAt: new Date().toISOString(), soulMdPath: '' }),
    getSoul: () => Promise.resolve('# Soul\n\n## Identity\n\nTest agent'),
    saveSoul: () => Promise.resolve(),
    delete: () => Promise.resolve(),
  },
  chat: {
    send: () => Promise.resolve(),
    onToken: () => () => {},
    onDone: () => () => {},
    onError: () => () => {},
  },
}

// @ts-ignore
globalThis.window = {
  electronAPI: mockElectronAPI,
}

// @ts-ignore
globalThis.document = {
  getElementById: () => null,
}
