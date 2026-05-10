# v2 L5 Client Architecture 设计

> **状态**：🔍 探索中
> **说明**：本文档记录 L5 Client 的设计思考，重点关注未来拓展性。

---

## 一、L5 的职责边界

L5 External Surfaces 负责把 L4 产品能力外扩到：

- **Web Console**：浏览器管理台
- **Desktop Client**：Electron 桌面应用
- **SDK**：Node.js / 浏览器 SDK
- **Channel Adapter**：IM 平台接入

L5 **不负责**：
- 定义产品语义（由 L4 定义）
- 核心运行时（由 L1 定义）
- 服务协议（由 L3 定义）

---

## 二、未来拓展性需求

v2 的客户端架构必须考虑以下未来需求：

### 2.1 多平台客户端

当前：Desktop（Electron）
未来可能需要：
- Web（浏览器）
- Mobile（React Native / Flutter）
- Browser Extension
- VS Code Extension

### 2.2 多 Agent 协作展示

当前：单 Agent 对话
未来可能需要：
- 多 Agent 群聊
- Agent 间消息路由
- Team 协作面板

### 2.3 富媒体能力

当前：文本 + 图片
未来可能需要：
- 语音输入/输出
- 视频
- 文件上传/下载
- 实时协作编辑

### 2.4 插件/扩展系统

当前：Skill（后端能力）
未来可能需要：
- 客户端插件（UI 扩展）
- 自定义主题
- 自定义布局

---

## 三、v2 客户端架构设计

### 3.1 核心原则：分层与抽象

```
┌─────────────────────────────────────────┐
│           Presentation Layer            │
│  (Desktop / Web / Mobile / Extension)   │
├─────────────────────────────────────────┤
│           Shell Layer                   │
│  (路由、布局、主题、插件系统)            │
├─────────────────────────────────────────┤
│           Product Layer                 │
│  (Chat / Channel / Settings /           │
│   Context / Memory / Approval /         │
│   Background / Task / Logs)             │
├─────────────────────────────────────────┤
│           SDK Layer                     │
│  (@theworld/sdk/client)                 │
│  (@theworld/sdk/operator-client)        │
├─────────────────────────────────────────┤
│           Transport Layer               │
│  (HTTP / SSE / WebSocket)               │
└─────────────────────────────────────────┘
```

### 3.2 Product Layer 设计

Product Layer 是 v2 的核心创新。它不直接操作 DOM 或 HTTP，而是：

```typescript
// Product Layer 接口

interface ProductModule {
  id: string
  name: string
  
  // 生命周期
  init(options: ProductInitOptions): Promise<void>
  mount(container: HTMLElement): void
  unmount(): void
  activate(): void
  deactivate(): void
  
  // 状态
  getState(): ProductState
  subscribe(callback: (state: ProductState) => void): () => void
  
  // 命令
  dispatch(command: ProductCommand): Promise<void>
}

// 每个产品面都是一个 ProductModule
interface ChatModule extends ProductModule {
  sendMessage(text: string, options?: SendOptions): Promise<void>
  selectSession(sessionId: string): void
  createSession(): Promise<string>
}

interface ContextModule extends ProductModule {
  getContextReport(traceId: string): Promise<ContextReport>
  getCompactSuggestion(traceId: string): Promise<CompactSuggestion>
}

interface MemoryModule extends ProductModule {
  getLayers(sessionId: string): Promise<MemoryLayer[]>
  summarize(sessionId: string): Promise<void>
  pin(sessionId: string, messageId: string): Promise<void>
  search(sessionId: string, query: string): Promise<MemorySearchResult[]>
}

interface ApprovalModule extends ProductModule {
  getPending(): Promise<ApprovalRecord[]>
  resolve(id: string, action: 'approve' | 'deny' | 'cancel'): Promise<void>
  getConfig(): Promise<PermissionConfig>
  setConfig(config: PermissionConfig): Promise<void>
}

interface BackgroundModule extends ProductModule {
  listRuns(sessionId?: string): Promise<BackgroundRun[]>
  attach(runId: string): Promise<void>
  detach(runId: string): Promise<void>
  resume(runId: string): Promise<void>
  interrupt(runId: string): Promise<void>
}
```

### 3.3 Shell Layer 设计

Shell Layer 负责：

```typescript
interface Shell {
  // 路由
  navigate(route: string): void
  getCurrentRoute(): string
  
  // 布局
  setLayout(layout: LayoutConfig): void
  registerPanel(panel: PanelConfig): void
  
  // 主题
  setTheme(theme: Theme): void
  getTheme(): Theme
  
  // 插件
  registerPlugin(plugin: Plugin): void
  unregisterPlugin(pluginId: string): void
  
  // 事件
  emit(event: ShellEvent): void
  subscribe(event: string, callback: (e: ShellEvent) => void): () => void
}

interface Plugin {
  id: string
  name: string
  version: string
  
  // 生命周期
  init(shell: Shell): Promise<void>
  destroy(): void
  
  // 扩展点
  panels?: PanelConfig[]
  commands?: CommandConfig[]
  themes?: Theme[]
}
```

### 3.4 跨平台复用

Product Layer 和 SDK Layer 是**平台无关的**，可以在所有客户端复用：

```
Desktop (Electron)          Web (Browser)              Mobile (React Native)
    │                            │                            │
    ├─ Shell (Electron)          ├─ Shell (Browser)           ├─ Shell (RN)
    │   ├─ Window management     │   ├─ Router                │   ├─ Navigation
    │   ├─ IPC bridge            │   ├─ History               │   ├─ Native bridge
    │   └─ System tray           │   └─ LocalStorage          │   └─ Push notification
    │                            │                            │
    ├─ Product Layer (shared)    ├─ Product Layer (shared)    ├─ Product Layer (shared)
    │   ├─ ChatModule            │   ├─ ChatModule            │   ├─ ChatModule
    │   ├─ ContextModule         │   ├─ ContextModule         │   ├─ ContextModule
    │   ├─ MemoryModule          │   ├─ MemoryModule          │   ├─ MemoryModule
    │   ├─ ApprovalModule        │   ├─ ApprovalModule        │   ├─ ApprovalModule
    │   └─ BackgroundModule      │   └─ BackgroundModule      │   └─ BackgroundModule
    │                            │                            │
    ├─ SDK Layer (shared)        ├─ SDK Layer (shared)        ├─ SDK Layer (shared)
    │   ├─ client SDK            │   ├─ client SDK            │   ├─ client SDK
    │   └─ operator SDK          │   └─ operator SDK          │   └─ operator SDK
    │                            │                            │
    └─ Transport (HTTP/SSE)      └─ Transport (HTTP/SSE)      └─ Transport (HTTP/SSE)
```

---

## 四、Desktop 具体设计

### 4.1 目录结构

```
apps/desktop/
├── src/
│   └── main.ts                 # Electron 主进程
├── preload/
│   └── preload.ts              # Preload bridge
├── renderer/
│   ├── index.html              # 入口 HTML
│   ├── main.ts                 # 渲染进程入口
│   ├── shell/                  # Shell Layer
│   │   ├── router.ts           # 路由
│   │   ├── layout.ts           # 布局管理
│   │   ├── theme.ts            # 主题管理
│   │   └── plugin-system.ts    # 插件系统
│   ├── product/                # Product Layer（复用）
│   │   ├── chat/
│   │   ├── context/
│   │   ├── memory/
│   │   ├── approval/
│   │   └── background/
│   ├── ui/                     # UI 组件（Desktop 特有）
│   │   ├── sidebar/
│   │   ├── composer/
│   │   ├── message-list/
│   │   └── panels/
│   └── infra/                  # 基础设施
│       ├── api-client.ts       # SDK 封装
│       ├── event-bus.ts        # 事件总线
│       ├── storage.ts          # 存储
│       └── bridge.ts           # Electron bridge
```

### 4.2 与 v1 Desktop 的关键区别

| 维度 | v1 Desktop | v2 Desktop |
|------|-----------|-----------|
| 架构 | 5438 行单体 | Shell + Product + UI 分层 |
| 产品语义 | 自建 | 复用 Product Layer |
| HTTP 客户端 | 三处重复实现 | 统一 SDK Layer |
| 模块通信 | `window.*` 全局 | Event Bus |
| 拓展性 | 无 | Plugin System |
| 状态管理 | 分散 | Product Module 统一状态 |

---

## 五、SDK 设计

### 5.1 分层 SDK

```typescript
// @theworld/sdk/client
// 面向普通用户，只暴露 client surface

interface TheWorldClient {
  // Session
  createSession(request?: CreateSessionRequest): Promise<SessionDto>
  getSession(sessionId: string): Promise<SessionDto>
  listSessions(params?: ListSessionsParams): Promise<SessionDto[]>
  deleteSession(sessionId: string): Promise<void>
  
  // Message
  getMessages(sessionId: string, params?: GetMessagesParams): Promise<MessageDto[]>
  createSessionMessage(sessionId: string, message: CreateMessageRequest): Promise<void>
  
  // Run
  run(request: CreateRunRequest): Promise<RunResultDto>
  streamRun(request: CreateRunRequest, listener: StreamEventListener): Promise<void>
  cancelRun(traceId: string): Promise<CancelRunResultDto>
  
  // Background
  listBackgroundRuns(sessionId?: string): Promise<BackgroundRunDto[]>
  attachBackgroundRun(runId: string): Promise<ReadableStream>
  
  // Health
  getHealth(): Promise<HealthDto>
}

// @theworld/sdk/operator-client
// 面向运维/管理，暴露 operator surface

interface OperatorClient {
  // ... client 的所有方法
  
  // Trace
  getRunTrace(traceId: string): Promise<TraceDto>
  listSessionRuns(sessionId: string): Promise<RunSummaryDto[]>
  
  // System
  getSystemStatus(): Promise<SystemStatusDto>
  getLogs(params?: GetLogsParams): Promise<LogEntryDto[]>
  subscribeLogStream(callback: (log: LogEntryDto) => void): Promise<() => void>
  
  // Tools & Skills
  listTools(): Promise<ToolEntryDto[]>
  listSkills(): Promise<SkillDto[]>
  
  // Agent Config
  listAgents(): Promise<AgentConfigDto[]>
  createAgent(config: CreateAgentRequest): Promise<AgentConfigDto>
  updateAgent(id: string, config: UpdateAgentRequest): Promise<AgentConfigDto>
  deleteAgent(id: string): Promise<void>
  
  // Tasks
  listTasks(): Promise<TaskDto[]>
  createTask(task: CreateTaskRequest): Promise<TaskDto>
  // ...
  
  // Memory
  getMemoryLayers(sessionId: string): Promise<MemoryLayerDto[]>
  pinMemory(sessionId: string, messageId: string): Promise<void>
  searchMemory(sessionId: string, query: string): Promise<MemorySearchResultDto[]>
  
  // Permission
  setPermissionConfig(config: PermissionConfigDto): Promise<void>
  
  // Approval
  listApprovals(params?: ListApprovalsParams): Promise<ApprovalRecordDto[]>
  getApproval(id: string): Promise<ApprovalRecordDto>
  resolveApproval(id: string, action: 'approve' | 'deny' | 'cancel', reason?: string): Promise<void>
  subscribeApprovalEvents(callback: (event: ApprovalEventDto) => void): Promise<() => void>
  
  // Background
  detachBackgroundRun(runId: string): Promise<void>
  resumeBackgroundRun(runId: string): Promise<void>
  interruptBackgroundRun(runId: string): Promise<void>
  subscribeBackgroundRunEvents(callback: (event: BackgroundRunEventDto) => void): Promise<() => void>
}
```

---

## 六、待决策事项

1. **WebSocket vs SSE**：v1 使用 SSE，v2 是否引入 WebSocket 用于双向通信？
2. **GraphQL vs REST**：v1 使用 REST，v2 是否考虑 GraphQL 用于复杂查询？
3. **状态同步协议**：跨入口状态同步使用什么协议？Event Plane？CRDT？
4. **移动端适配**：Product Layer 的 UI 部分是否需要抽象为与平台无关的声明式描述？

---

## 七、下一步

1. 讨论并确认客户端架构设计
2. 冻结 SDK 接口定义
3. 冻结 Product Layer 接口定义
4. 开始 Desktop 重构
