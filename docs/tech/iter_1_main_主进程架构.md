# 技术文档 - 迭代一 · 主进程：Electron 主进程架构

**迭代轮数**：1  
**层次**：Main Process（Electron 38 + Node.js）  
**状态**：设计中

---

## 1. 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Electron | 38 | 桌面应用框架 |
| TypeScript | 5.x | 类型安全 |
| electron-builder | 24.x | 打包 & 发布 |
| vite + electron-vite | 3.x | 构建工具（含热重载） |
| node:child_process | — | 启动后端子进程 |
| node:crypto | — | API Key 加密 |
| node:fs/path | — | 文件系统操作 |
| electron-store | 8.x | 持久化应用配置 |

---

## 2. 主进程职责

主进程（`main/index.ts`）是整个 Electron 应用的控制中心，负责：

1. **窗口管理**：创建/管理 `BrowserWindow`，控制原生菜单
2. **后端进程管理**：启动/监控/重启后端 Node.js 子进程
3. **IPC 路由**：接收渲染进程请求，转发到后端或直接处理
4. **WebSocket 代理**：在主进程中维护到后端 WebSocket 的连接，并通过 IPC 与渲染进程通信
5. **数据目录初始化**：首次运行时创建 `~/.openkin/` 目录结构
6. **安全策略**：配置 CSP、contextIsolation、preload 脚本

---

## 3. 目录结构

```
src/
├── main/
│   ├── index.ts              # 主进程入口
│   ├── window.ts             # BrowserWindow 管理
│   ├── backend.ts            # 后端子进程管理
│   ├── ipc/
│   │   ├── index.ts          # IPC 处理器注册中心
│   │   ├── configHandlers.ts # 配置类 IPC 处理器
│   │   ├── agentHandlers.ts  # Agent 类 IPC 处理器
│   │   └── chatHandlers.ts   # 对话类 IPC 处理器（含 WS 代理）
│   ├── storage/
│   │   └── appDataDir.ts     # 数据目录初始化
│   └── preload/
│       └── index.ts          # Preload 脚本（contextBridge）
```

---

## 4. 主进程启动流程

```
app.whenReady()
    │
    ├─① 初始化数据目录（~/.openkin/）
    │
    ├─② 启动后端子进程（backend.ts）
    │       ├── 动态寻找可用端口（从 7788）
    │       ├── spawn node backend/index.js
    │       └── 等待 ready 信号（stdout "BACKEND_READY:7788"）
    │
    ├─③ 注册所有 IPC 处理器
    │
    ├─④ 创建主窗口（BrowserWindow）
    │       ├── 开发：加载 http://localhost:5173（Vite）
    │       └── 生产：加载 dist/renderer/index.html
    │
    └─⑤ 监听 app 生命周期事件
            ├── window-all-closed → 退出（非 macOS）
            ├── activate → 重建窗口（macOS）
            └── before-quit → 终止后端子进程
```

---

## 5. 后端子进程管理（backend.ts）

```typescript
// main/backend.ts
import { ChildProcess, spawn } from 'node:child_process';
import { createServer } from 'node:net';

export class BackendManager {
  private process: ChildProcess | null = null;
  private port: number = 0;
  
  /**
   * 找到可用端口
   */
  private async findAvailablePort(startPort = 7788): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = createServer();
      server.listen(startPort, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        server.close(() => resolve(addr.port));
      });
      server.on('error', () => this.findAvailablePort(startPort + 1).then(resolve).catch(reject));
    });
  }

  /**
   * 启动后端进程，返回实际端口
   */
  async start(): Promise<number> {
    this.port = await this.findAvailablePort();
    
    const backendEntry = app.isPackaged
      ? join(process.resourcesPath, 'backend/index.js')
      : join(__dirname, '../../src/backend/index.ts');  // ts-node 模式

    this.process = spawn(
      process.execPath,  // 复用 Electron 内置 Node.js
      [backendEntry],
      {
        env: { ...process.env, BACKEND_PORT: String(this.port) },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    // 等待后端就绪信号
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Backend start timeout')), 10_000);
      this.process!.stdout!.on('data', (data: Buffer) => {
        if (data.toString().includes('BACKEND_READY')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      this.process!.on('error', reject);
    });

    // 监控进程崩溃并自动重启
    this.process.on('exit', (code) => {
      if (code !== 0) {
        console.error(`[Backend] Process exited with code ${code}, restarting...`);
        setTimeout(() => this.start(), 1000);
      }
    });

    return this.port;
  }

  getPort(): number { return this.port; }

  stop(): void {
    this.process?.kill();
    this.process = null;
  }
}
```

---

## 6. IPC 接口规范

### 6.1 Preload 脚本（contextBridge）

```typescript
// main/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  config: {
    getInitialized: () => ipcRenderer.invoke('config:getInitialized'),
    getApiKeys: () => ipcRenderer.invoke('config:getApiKeys'),
    saveApiKeys: (keys) => ipcRenderer.invoke('config:saveApiKeys', keys),
  },
  api: {
    validate: (params) => ipcRenderer.invoke('api:validate', params),
  },
  agent: {
    list: () => ipcRenderer.invoke('agent:list'),
    create: (params) => ipcRenderer.invoke('agent:create', params),
    getSoul: (agentId) => ipcRenderer.invoke('agent:getSoul', agentId),
    saveSoul: (agentId, content) => ipcRenderer.invoke('agent:saveSoul', agentId, content),
  },
  chat: {
    send: (params) => ipcRenderer.invoke('chat:send', params),
    onToken: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('chat:token', listener);
      return () => ipcRenderer.off('chat:token', listener);
    },
    onDone: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('chat:done', listener);
      return () => ipcRenderer.off('chat:done', listener);
    },
    onError: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('chat:error', listener);
      return () => ipcRenderer.off('chat:error', listener);
    },
  },
});
```

### 6.2 IPC Channel 一览

| Channel | 方向 | 说明 |
|---------|------|------|
| `config:getInitialized` | invoke | 返回应用是否已完成初始化 |
| `config:getApiKeys` | invoke | 返回已解密的 API Keys（脱敏） |
| `config:saveApiKeys` | invoke | 保存加密 API Keys |
| `api:validate` | invoke | 转发到后端 `POST /api/config/validate-key` |
| `agent:list` | invoke | 转发到后端 `GET /api/agents` |
| `agent:create` | invoke | 转发到后端 `POST /api/agents` |
| `agent:getSoul` | invoke | 转发到后端 `GET /api/agents/:id/soul` |
| `agent:saveSoul` | invoke | 转发到后端 `PUT /api/agents/:id/soul` |
| `chat:send` | invoke | 通过 WebSocket 发送消息到后端 |
| `chat:token` | main→renderer | 流式 token 推送（ipcRenderer.send） |
| `chat:done` | main→renderer | 对话完成通知 |
| `chat:error` | main→renderer | 对话错误通知 |

### 6.3 WebSocket 代理逻辑（chatHandlers.ts）

主进程维护一个到后端的持久 WebSocket 连接（`ws://127.0.0.1:{port}/ws/chat`）：

```typescript
// main/ipc/chatHandlers.ts
import WebSocket from 'ws';
import { BrowserWindow, ipcMain } from 'electron';

let backendWs: WebSocket | null = null;

function getOrCreateWs(port: number): WebSocket {
  if (backendWs?.readyState === WebSocket.OPEN) return backendWs;
  
  backendWs = new WebSocket(`ws://127.0.0.1:${port}/ws/chat`);
  
  backendWs.on('message', (raw: Buffer) => {
    const msg = JSON.parse(raw.toString());
    const win = BrowserWindow.getAllWindows()[0];
    
    switch (msg.type) {
      case 'token':
        win?.webContents.send('chat:token', { messageId: msg.messageId, content: msg.content });
        break;
      case 'done':
        win?.webContents.send('chat:done', { messageId: msg.messageId });
        break;
      case 'error':
        win?.webContents.send('chat:error', { code: msg.code, message: msg.message });
        break;
    }
  });

  backendWs.on('close', () => {
    backendWs = null;
    // 1s 后重连
    setTimeout(() => getOrCreateWs(port), 1000);
  });

  return backendWs;
}

export function registerChatHandlers(port: number) {
  ipcMain.handle('chat:send', async (_event, params) => {
    const ws = getOrCreateWs(port);
    ws.send(JSON.stringify({ type: 'chat', ...params }));
  });
}
```

---

## 7. 数据目录初始化

```typescript
// main/storage/appDataDir.ts
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';

export const OPENKIN_DIR = join(homedir(), '.openkin');

const DIRS = [
  OPENKIN_DIR,
  join(OPENKIN_DIR, 'agents'),
  join(OPENKIN_DIR, 'sessions'),
];

const DEFAULT_CONFIG = {
  version: '1.0',
  initialized: false,
  active_agent_id: null,
  api_keys: { openai: '', anthropic: '', custom_endpoint: '' },
  ui: { theme: 'dark', language: 'zh-CN' },
};

export function initAppDataDir() {
  for (const dir of DIRS) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
  
  const configPath = join(OPENKIN_DIR, 'config.json');
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
  }
}
```

---

## 8. 窗口配置

```typescript
// main/window.ts
export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',   // macOS 沉浸式标题栏
    backgroundColor: '#0F172A',     // 深色背景防止白闪
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,       // 必须开启
      nodeIntegration: false,       // 必须关闭
      sandbox: false,               // preload 需要访问 Node API
    },
  });

  // 开发模式
  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}
```

---

## 9. 安全策略

1. **contextIsolation = true**：隔离渲染进程和主进程，通过 contextBridge 暴露有限 API
2. **nodeIntegration = false**：渲染进程不能直接调用 Node.js
3. **CSP**：生产环境设置 Content-Security-Policy 头，禁止外联脚本
4. **API Key 加密**：使用机器唯一指纹（`machineId`）派生 AES-256 密钥，密钥不出主进程
5. **IPC 参数验证**：所有 IPC Handler 使用 zod 校验入参，防止渲染进程注入恶意数据

---

## 10. 构建配置（electron-vite）

```typescript
// electron.vite.config.ts
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    build: { outDir: 'dist/main' },
  },
  preload: {
    build: { outDir: 'dist/preload' },
  },
  renderer: {
    plugins: [react()],
    build: { outDir: 'dist/renderer' },
  },
});
```

**package.json 关键脚本**：
```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build && electron-builder",
    "preview": "electron-vite preview",
    "test": "vitest run"
  }
}
```

---

*文档版本：1.0 | 创建日期：2026-03-28*
