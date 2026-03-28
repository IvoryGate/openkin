# 技术文档 - 迭代一：Electron主进程架构

**迭代轮数**：1  
**迭代主题**：Electron主进程架构  
**模块类型**：主进程（Electron）  
**状态**：已重构至electron/main/  
**创建日期**：2026-03-28

---

## 1. 概述

Electron主进程是OpenKin应用的入口，负责窗口管理、后端进程管理、进程间通信（IPC）等核心功能。经过迭代一的重构，主进程代码现在位于`electron/main/`目录，采用了清晰的职责划分和模块化设计。

---

## 2. 目录结构

```
electron/
├── main/                    # Electron主进程
│   └── index.ts           # 主进程入口文件
└── preload/                # 预加载脚本
    └── index.ts           # IPC桥接和安全暴露API
```

---

## 3. 主进程架构详解

### 3.1 主进程入口（index.ts）

**职责**：应用启动、窗口管理、后端进程管理、IPC注册

**文件位置**：`electron/main/index.ts`

---

## 4. 核心功能模块

### 4.1 应用生命周期管理

#### 应用启动流程

```typescript
app.whenReady().then(async () => {
  // 1. 创建主窗口
  createWindow();
  
  // 2. 启动后端服务
  await startBackend();
  
  // 3. 注册应用事件监听
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
```

#### 应用退出处理

```typescript
app.on('window-all-closed', () => {
  // 在macOS上，应用不会完全退出
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  // 停止后端服务
  if (backendProcess) {
    console.log('[Main] Stopping backend...');
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
});
```

### 4.2 窗口管理

#### createWindow函数

**职责**：创建主应用窗口

**窗口配置**：

```typescript
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false,
    backgroundColor: '#111827' // gray-900
  });
  
  // 加载开发或生产环境URL
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}
```

**关键配置**：
- 尺寸：1400×900，最小800×600
- 安全性：启用上下文隔离，禁用Node集成
- 预加载：使用preload脚本暴露API
- 背景色：深色主题（#111827）
- 开发工具：开发环境自动打开

### 4.3 后端进程管理

#### startBackend函数

**职责**：启动Hono后端服务

**启动流程**：

```typescript
async function startBackend(): Promise<number> {
  // 1. 检查是否已启动
  if (backendProcess) {
    console.log('[Main] Backend already running');
    return BACKEND_PORT;
  }
  
  // 2. 使用动态端口分配
  BACKEND_PORT = await findAvailablePort(7788);
  
  // 3. 启动后端进程
  const backendPath = join(__dirname, '../../core/agent_engine/index.js');
  backendProcess = spawn('node', [backendPath], {
    env: { ...process.env, BACKEND_PORT: BACKEND_PORT.toString() },
    stdio: 'pipe'
  });
  
  // 4. 等待后端就绪
  await waitForBackendReady(BACKEND_PORT);
  
  console.log(`[Main] Backend started on port ${BACKEND_PORT}`);
  return BACKEND_PORT;
}
```

#### 动态端口分配

```typescript
async function findAvailablePort(startPort: number): Promise<number> {
  const server = net.createServer();
  
  return new Promise((resolve, reject) => {
    server.listen(startPort, () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
    
    server.on('error', () => {
      server.close();
      findAvailablePort(startPort + 1).then(resolve).catch(reject);
    });
  });
}
```

**特性**：
- 从指定端口（7788）开始尝试
- 自动递增寻找可用端口
- 避免端口冲突

#### 后端就绪检测

```typescript
async function waitForBackendReady(port: number, timeout = 10000): Promise<void> {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) {
        return;
      }
    } catch (e) {
      // 后端未就绪，继续等待
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error(`Backend failed to start within ${timeout}ms`);
}
```

**检测机制**：
- 轮询`/health`端点
- 超时时间：10秒
- 失败后抛出错误

#### 后端进程监控

```typescript
// 进程退出处理
backendProcess.on('exit', (code, signal) => {
  console.log(`[Main] Backend process exited with code ${code}, signal ${signal}`);
  backendProcess = null;
});

// 错误输出捕获
backendProcess.stderr?.on('data', (data) => {
  console.error(`[Backend Error] ${data}`);
});

// 标准输出捕获
backendProcess.stdout?.on('data', (data) => {
  console.log(`[Backend] ${data}`);
});
```

### 4.4 IPC通信

#### IPC处理器注册

```typescript
// 1. Agent管理
ipcMain.handle('get-agents', async () => {
  return await fetch(`/api/agents`).then(r => r.json());
});

ipcMain.handle('create-agent', async (_, data) => {
  return await fetch('/api/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json());
});

// 2. 聊天功能
ipcMain.handle('send-message', async (_, agentId, message, history) => {
  // WebSocket通信逻辑
});

// 3. 配置管理
ipcMain.handle('validate-api-key', async (_, provider, key, endpoint) => {
  const response = await fetch('/api/config/validate-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, key, endpoint })
  });
  return await response.json();
});

ipcMain.handle('save-api-keys', async (_, keys) => {
  return await fetch('/api/config/save-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(keys)
  }).then(r => r.json());
});
```

#### WebSocket代理实现

```typescript
ipcMain.handle('send-message', async (_, agentId, message, history) => {
  const wsUrl = `ws://127.0.0.1:${BACKEND_PORT}/ws/chat`;
  const ws = new WebSocket(wsUrl);
  
  return new Promise((resolve, reject) => {
    let fullResponse = '';
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'chat',
        agentId,
        sessionId: nanoid(),
        message,
        history
      }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'token') {
        fullResponse += data.content;
      } else if (data.type === 'done') {
        resolve({
          type: 'done',
          content: fullResponse
        });
        ws.close();
      } else if (data.type === 'error') {
        reject(new Error(data.error.message));
        ws.close();
      }
    };
    
    ws.onerror = (error) => {
      reject(error);
      ws.close();
    };
  });
});
```

**特性**：
- 主进程作为WebSocket客户端
- 流式响应聚合
- 错误处理和连接清理

---

## 5. 预加载脚本（preload/index.ts）

**职责**：在渲染进程的安全环境中暴露主进程API

**文件位置**：`electron/preload/index.ts`

### 5.1 API暴露

```typescript
import { contextBridge, ipcRenderer } from 'electron';

// 安全地暴露API到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // Agent管理
  getAgents: () => ipcRenderer.invoke('get-agents'),
  createAgent: (data: any) => ipcRenderer.invoke('create-agent', data),
  deleteAgent: (id: string) => ipcRenderer.invoke('delete-agent', id),
  getAgentSoul: (id: string) => ipcRenderer.invoke('get-agent-soul', id),
  
  // 聊天功能
  sendMessage: (agentId: string, message: string, history?: any[]) => 
    ipcRenderer.invoke('send-message', agentId, message, history),
  
  // 配置管理
  validateApiKey: (provider: string, key: string, endpoint?: string) =>
    ipcRenderer.invoke('validate-api-key', provider, key, endpoint),
  saveApiKeys: (keys: any) => ipcRenderer.invoke('save-api-keys', keys),
  getConfig: () => ipcRenderer.invoke('get-config')
});
```

### 5.2 TypeScript类型声明

**位置**：`vite-env.d.ts`（已移动到项目根目录）

```typescript
interface ElectronAPI {
  getAgents: () => Promise<any>;
  createAgent: (data: any) => Promise<any>;
  deleteAgent: (id: string) => Promise<void>;
  getAgentSoul: (id: string) => Promise<string>;
  sendMessage: (agentId: string, message: string, history?: any[]) => Promise<any>;
  validateApiKey: (provider: string, key: string, endpoint?: string) => Promise<any>;
  saveApiKeys: (keys: any) => Promise<void>;
  getConfig: () => Promise<any>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

**安全性**：
- 使用`contextBridge`安全暴露API
- 不直接暴露`ipcRenderer`
- 仅暴露必要的方法
- 启用上下文隔离

---

## 6. 端口管理策略

### 6.1 端口文件机制

**后端端口文件**：
- 位置：`~/.openkin/.backend_port`
- 格式：纯数字字符串（如`7788`）
- 用途：主进程读取后端监听的端口

**读取逻辑**：

```typescript
async function getBackendPort(): Promise<number> {
  const portFile = join(homedir(), '.openkin', '.backend_port');
  const portContent = await readFile(portFile, 'utf-8');
  return parseInt(portContent, 10);
}
```

### 6.2 端口优先级

1. **环境变量**：`BACKEND_PORT`（最高优先级）
2. **后端默认端口**：7788
3. **动态分配**：从7788开始递增寻找可用端口

---

## 7. 安全配置

### 7.1 WebPreferences配置

```typescript
{
  preload: join(__dirname, '../preload/index.js'),
  contextIsolation: true,        // 启用上下文隔离
  nodeIntegration: false,         // 禁用Node集成
  sandbox: false                  // 禁用沙箱（用于本地文件访问）
}
```

**安全措施**：
- **上下文隔离**：防止渲染进程直接访问Node.js API
- **禁用Node集成**：避免潜在的安全风险
- **预加载脚本**：通过`contextBridge`安全暴露API

### 7.2 CSP策略

**位置**：`ui/index.html`

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline'; 
               style-src 'self' 'unsafe-inline' 'unsafe-eval'; 
               connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:*" />
```

**安全限制**：
- 仅允许加载同源资源
- 限制WebSocket和HTTP连接到本地后端
- 允许内联脚本和样式（开发模式）

---

## 8. 进程架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron主进程                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 窗口管理      │  │ 后端进程管理  │  │ IPC通信      │      │
│  │              │  │              │  │              │      │
│  │ - 创建窗口    │  │ - 启动后端    │  │ - 处理请求    │      │
│  │ - 窗口事件    │  │ - 监控进程    │  │ - WebSocket  │      │
│  │ - 退出处理    │  │ - 错误处理    │  │ - 返回数据    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ IPC/HTTP/WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Hono后端服务                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ HTTP API     │  │ WebSocket    │  │ 业务服务     │      │
│  │              │  │              │  │              │      │
│  │ - Agent API  │  │ - 聊天流式    │  │ - LLM客户端  │      │
│  │ - Config API │  │ - 消息分发    │  │ - Agent服务  │      │
│  │ - Health API │  │ - 错误处理    │  │ - Soul服务  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   React渲染进程                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ UI组件       │  │ 状态管理      │  │ 路由管理      │      │
│  │              │  │              │  │              │      │
│  │ - 聊天界面    │  │ - AgentStore │  │ - Router     │      │
│  │ - 设置页面    │  │ - ChatStore  │  │ - 路由守卫    │      │
│  │ - 引导流程    │  │ - AppStore   │  │ - 导航       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. 开发与调试

### 9.1 开发环境启动

```bash
npm run dev
```

**启动流程**：
1. Vite启动前端开发服务器（localhost:5173）
2. 启动后端服务（tsx watch，端口7788+）
3. Electron启动主进程
4. 主进程加载UI（连接localhost:5173）

### 9.2 调试工具

**主进程调试**：
- 开发环境自动打开DevTools
- 可查看主进程日志和IPC通信

**渲染进程调试**：
- Chrome DevTools集成
- React DevTools支持
- 控制台日志查看

**后端调试**：
- 终端输出后端日志
- WebSocket连接监控
- HTTP请求日志

---

## 10. 错误处理与日志

### 10.1 主进程错误处理

```typescript
// 未捕获的异常处理
process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught Exception:', error);
  // 可选：写入日志文件或发送错误报告
});

// 未处理的Promise拒绝
process.on('unhandledRejection', (reason) => {
  console.error('[Main] Unhandled Rejection:', reason);
});
```

### 10.2 后端进程错误处理

```typescript
backendProcess.on('error', (error) => {
  console.error('[Main] Backend process error:', error);
  // 尝试重启或通知用户
});

backendProcess.on('exit', (code, signal) => {
  if (code !== 0) {
    console.error(`[Main] Backend exited with code ${code}, signal ${signal}`);
    // 非正常退出，记录或重启
  }
});
```

---

## 11. 性能优化

### 11.1 窗口启动优化

```typescript
{
  show: false,  // 先不显示窗口，等待内容加载
  backgroundColor: '#111827'  // 设置背景色避免闪烁
}

mainWindow.once('ready-to-show', () => {
  mainWindow.show();  // 内容加载完成后显示
});
```

### 11.2 进程通信优化

- **批量IPC调用**：减少IPC调用频率
- **WebSocket连接复用**：避免频繁创建WebSocket连接
- **延迟加载**：按需加载大型组件

---

## 12. 依赖说明

**Electron版本**：38.x

**核心依赖**：
- `electron` - Electron框架
- `electron-vite` - Electron构建工具

**开发依赖**：
- `vite` - 构建工具
- `typescript` - TypeScript支持

---

**文档版本**：1.0  
**最后更新**：2026-03-28  
**状态**：✅ 已重构至electron/main/，窗口管理、IPC通信、后端进程管理均正常工作
