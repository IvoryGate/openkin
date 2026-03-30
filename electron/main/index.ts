import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { spawn, ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { homedir } from 'node:os'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import WebSocket from 'ws'

let backendProcess: ChildProcess | null = null
let backendPort = 7788
let backendWs: WebSocket | null = null

// ─── 数据目录初始化 ────────────────────────────────────────────────────────────
function initDataDir() {
  const base = join(homedir(), '.openkin')
  const dirs = [base, join(base, 'agents'), join(base, 'sessions')]
  for (const d of dirs) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true })
  }
  const cfg = join(base, 'config.json')
  if (!existsSync(cfg)) {
    writeFileSync(cfg, JSON.stringify({
      version: '1.0', initialized: false, active_agent_id: null,
      api_keys: { openai: '', anthropic: '', custom_endpoint: '' },
      ui: { theme: 'dark', language: 'zh-CN' },
    }, null, 2))
  }
}

// ─── 端口可用性检查 ────────────────────────────────────────────────────────────
async function isPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new (require('net').Socket)()
    socket.setTimeout(500)
    socket.connect(port, '127.0.0.1', () => { socket.destroy(); resolve(true) })
    socket.on('error', () => { socket.destroy(); resolve(false) })
    socket.on('timeout', () => { socket.destroy(); resolve(false) })
  })
}

// ─── 可用端口查找 ──────────────────────────────────────────────────────────────
async function findFreePort(start = 7788): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer()
    s.listen(start, '127.0.0.1', () => {
      const addr = s.address() as { port: number }
      s.close(() => resolve(addr.port))
    })
    s.on('error', () => findFreePort(start + 1).then(resolve).catch(reject))
  })
}

// ─── 读取后端端口文件 ──────────────────────────────────────────────────────────
function readBackendPortFile(): number | null {
  const portFile = join(homedir(), '.openkin', '.backend_port')
  if (!existsSync(portFile)) return null
  try {
    const port = parseInt(readFileSync(portFile, 'utf-8').trim(), 10)
    return isNaN(port) ? null : port
  } catch {
    return null
  }
}

// ─── 后端子进程 ────────────────────────────────────────────────────────────────
async function startBackend(): Promise<number> {
  // 1. 读取端口文件，如果有后端在跑就直接复用
  const savedPort = readBackendPortFile()
  if (savedPort) {
    const alive = await isPortListening(savedPort)
    if (alive) {
      console.log(`[Main] Reusing existing backend on port ${savedPort}`)
      // 测试连接是否正常
      try {
        const testRes = await fetch(`http://127.0.0.1:${savedPort}/api/config/initialized`)
        if (testRes.ok) {
          return savedPort
        }
      } catch (e) {
        console.warn('[Main] Backend port exists but not responding, will start new one')
      }
    }
  }

  // 2. 找可用端口，自己 spawn
  backendPort = await findFreePort()

  const entry = app.isPackaged
    ? join(process.resourcesPath, 'backend/index.js')
    : join(__dirname, '../../../core/agent_engine/index.ts')

  const isPackaged = app.isPackaged
  const cmd = isPackaged ? process.execPath : 'node'
  
  // 获取项目根目录（package.json所在目录）
  const projectRoot = app.isPackaged
    ? process.resourcesPath
    : join(__dirname, '../../../')
  
  const args = isPackaged
    ? [entry]
    : [
        '--require', join(projectRoot, 'node_modules/tsx/dist/preflight.cjs'),
        '--import', `file://${join(projectRoot, 'node_modules/tsx/dist/loader.mjs')}`,
        entry,
      ]

  backendProcess = spawn(cmd, args, {
    env: { ...process.env, BACKEND_PORT: String(backendPort) },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  })

  backendProcess.stderr?.on('data', (d: Buffer) => {
    try {
      console.error('[Backend]', d.toString().trim())
    } catch (e) {
      // 忽略管道关闭错误
    }
  })

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Backend start timeout')), 20_000)
    backendProcess!.stdout?.on('data', (d: Buffer) => {
      try {
        const line = d.toString()
        console.log('[Backend]', line.trim())
        if (line.includes('BACKEND_READY')) {
          clearTimeout(timer)
          resolve()
        }
      } catch (e) {
        // 忽略 EPIPE 等管道错误，继续处理
      }
    })
    backendProcess!.on('error', reject)
    backendProcess!.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Backend exited with code ${code}`))
    })
  })

  backendProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[Backend] crashed (${code}), restarting in 1s...`)
      setTimeout(() => startBackend(), 1000)
    }
  })

  return backendPort
}

// ─── WS 代理（主进程维护一条持久连接到后端） ──────────────────────────────────
function getOrCreateWs(): WebSocket {
  if (backendWs?.readyState === WebSocket.OPEN) return backendWs

  backendWs = new WebSocket(`ws://127.0.0.1:${getBackendPort()}/ws/chat`)

  backendWs.on('message', (raw: Buffer) => {
    const msg = JSON.parse(raw.toString())
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return
    switch (msg.type) {
      case 'token': win.webContents.send('chat:token', { messageId: msg.messageId, content: msg.content }); break
      case 'done':  win.webContents.send('chat:done',  { messageId: msg.messageId }); break
      case 'error': win.webContents.send('chat:error', { code: msg.code, message: msg.message }); break
    }
  })

  backendWs.on('close', () => {
    backendWs = null
    setTimeout(() => getOrCreateWs(), 1000)
  })

  backendWs.on('error', (e) => console.error('[WS proxy]', e.message))

  return backendWs
}

// ─── HTTP 转发工具 ─────────────────────────────────────────────────────────────
// 每次调用都动态获取端口，防止热重载后端口变量失效
function getBackendPort(): number {
  const filePort = readBackendPortFile()
  if (filePort) return filePort
  return backendPort  // fallback
}

async function backendFetch(path: string, init?: RequestInit) {
  const port = getBackendPort()
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  return res.json()
}

// ─── IPC 注册 ──────────────────────────────────────────────────────────────────
function registerIpc() {
  // config
  ipcMain.handle('config:getInitialized', () =>
    backendFetch('/api/config/initialized').then(r => r.data?.initialized ?? false))
  ipcMain.handle('config:getApiKeys', () =>
    backendFetch('/api/config/keys').then(r => r.data))
  ipcMain.handle('config:saveApiKeys', (_e, keys) =>
    backendFetch('/api/config/save-keys', { method: 'POST', body: JSON.stringify(keys) }).then(r => r.data))

  // api validate
  ipcMain.handle('api:validate', (_e, params) =>
    backendFetch('/api/config/validate-key', { method: 'POST', body: JSON.stringify(params) }).then(r => r.data))

  // agent
  ipcMain.handle('agent:list', () =>
    backendFetch('/api/agents').then(r => r.data))
  ipcMain.handle('agent:create', (_e, params) =>
    backendFetch('/api/agents', { method: 'POST', body: JSON.stringify(params) }).then(r => r.data))
  ipcMain.handle('agent:getSoul', (_e, agentId: string) =>
    backendFetch(`/api/agents/${agentId}/soul`).then(r => r.data?.content))
  ipcMain.handle('agent:saveSoul', (_e, agentId: string, content: string) =>
    backendFetch(`/api/agents/${agentId}/soul`, { method: 'PUT', body: JSON.stringify({ content }) }).then(r => r.data))
  ipcMain.handle('agent:delete', (_e, agentId: string) =>
    backendFetch(`/api/agents/${agentId}`, { method: 'DELETE' }).then(r => r.data))

  // chat (via WS proxy)
  ipcMain.handle('chat:send', (_e, params: { agentId: string; message: string; sessionId: string; history?: { role: string; content: string }[] }) => {
    const ws = getOrCreateWs()
    ws.send(JSON.stringify({ type: 'chat', ...params, history: params.history ?? [] }))
  })
}

// ─── 窗口 ──────────────────────────────────────────────────────────────────────
function createMainWindow(): BrowserWindow {
  // 动态检测 preload 文件扩展名
  const preloadJs = join(__dirname, '../preload/index.js')
  const preloadMjs = join(__dirname, '../preload/index.mjs')
  const preloadPath = existsSync(preloadMjs) ? preloadMjs : preloadJs

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0F172A',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // 设置 CSP 以允许加载外部字体
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:",
          "style-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com data:",
          "img-src 'self' data: blob: https:",
          "connect-src 'self' ws://* http://* https://*",
        ]
      }
    })
  })

  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

// ─── 启动流程 ──────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  initDataDir()

  try {
    backendPort = await startBackend()
    console.log(`[Main] Using backend on port ${backendPort}`)
  } catch (e) {
    console.error('[Main] Failed to start backend:', e)
  }

  registerIpc()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  backendWs?.close()
  backendProcess?.kill()
})
