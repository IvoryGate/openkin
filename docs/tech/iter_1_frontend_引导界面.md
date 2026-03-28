# 技术文档 - 迭代一 · 前端：引导界面与对话 UI

**迭代轮数**：1  
**层次**：Frontend（React 19 + TypeScript）  
**状态**：设计中

---

## 1. 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19 | UI 框架 |
| TypeScript | 5.x | 类型安全 |
| TailwindCSS | 3.x | 样式工具类 |
| React Router | 6.x | 客户端路由 |
| Zustand | 4.x | 轻量状态管理 |
| react-markdown | 9.x | Markdown 渲染 |
| Electron IPC | — | 与主进程通信 |

---

## 2. 目录结构

```
src/
├── renderer/                    # 渲染进程（React 应用）
│   ├── main.tsx                 # React 入口
│   ├── App.tsx                  # 根组件 + 路由配置
│   ├── pages/
│   │   ├── Onboarding/          # 引导流程页面
│   │   │   ├── OnboardingLayout.tsx
│   │   │   ├── Step1Welcome.tsx
│   │   │   ├── Step2ApiKey.tsx
│   │   │   ├── Step3CreateAgent.tsx
│   │   │   └── Step4Complete.tsx
│   │   ├── Chat/                # 主对话界面
│   │   │   ├── ChatPage.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   └── InputBar.tsx
│   │   └── Settings/            # 设置页（Soul.md 编辑）
│   │       ├── SettingsPage.tsx
│   │       └── SoulEditor.tsx
│   ├── components/              # 共享组件
│   │   ├── Sidebar/
│   │   │   ├── Sidebar.tsx
│   │   │   └── AgentListItem.tsx
│   │   ├── ProgressSteps.tsx    # 引导进度指示器
│   │   ├── ApiKeyInput.tsx      # API Key 输入组件
│   │   └── AgentTemplateCard.tsx
│   ├── store/                   # Zustand 状态
│   │   ├── appStore.ts          # 全局应用状态
│   │   ├── agentStore.ts        # Agent 列表与当前 Agent
│   │   └── chatStore.ts         # 当前会话消息
│   ├── hooks/                   # 自定义 Hook
│   │   ├── useIpc.ts            # IPC 调用封装
│   │   └── useAgent.ts          # Agent 操作 Hook
│   ├── types/                   # TypeScript 类型定义
│   │   ├── agent.ts
│   │   ├── message.ts
│   │   └── config.ts
│   └── utils/
│       └── markdown.ts          # Markdown 处理工具
```

---

## 3. 路由设计

```typescript
// App.tsx 路由配置
const router = createHashRouter([
  {
    path: '/',
    element: <RootRedirect />,  // 根据 initialized 状态决定跳转
  },
  {
    path: '/onboarding',
    element: <OnboardingLayout />,
    children: [
      { index: true, element: <Step1Welcome /> },
      { path: 'api-key', element: <Step2ApiKey /> },
      { path: 'create-agent', element: <Step3CreateAgent /> },
      { path: 'complete', element: <Step4Complete /> },
    ],
  },
  {
    path: '/chat/:agentId?',
    element: <ChatPage />,
  },
  {
    path: '/settings/:agentId',
    element: <SettingsPage />,
  },
]);
```

**路由跳转逻辑（RootRedirect）**：
- 调用 IPC `config:getInitialized` → `false` → 跳转 `/onboarding`
- 调用 IPC `config:getInitialized` → `true` → 跳转 `/chat/{active_agent_id}`

---

## 4. 状态管理设计

### 4.1 appStore

```typescript
// store/appStore.ts
interface AppState {
  initialized: boolean;
  theme: 'light' | 'dark';
  language: 'zh-CN' | 'en-US';
  setInitialized: (v: boolean) => void;
}
```

### 4.2 agentStore

```typescript
// store/agentStore.ts
interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  createdAt: string;
  soulMdPath: string;
}

interface AgentState {
  agents: Agent[];
  activeAgentId: string | null;
  setAgents: (agents: Agent[]) => void;
  setActiveAgent: (id: string) => void;
  addAgent: (agent: Agent) => void;
}
```

### 4.3 chatStore

```typescript
// store/chatStore.ts
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  status: 'sending' | 'done' | 'error';
}

interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  sessionId: string | null;
  appendMessage: (msg: Message) => void;
  updateMessage: (id: string, patch: Partial<Message>) => void;
  clearMessages: () => void;
}
```

---

## 5. 核心组件规范

### 5.1 OnboardingLayout

- 渲染顶部进度条（`ProgressSteps`）
- 内容区渲染 `<Outlet />`
- 底部显示跳过/下一步按钮
- 支持键盘 Enter 触发下一步

### 5.2 Step2ApiKey

```typescript
// 表单字段
type ApiKeyForm = {
  openai: string;        // 必填
  anthropic?: string;    // 选填
  customEndpoint?: string; // 选填
};

// 验证逻辑
async function validateApiKey(key: string, type: 'openai' | 'anthropic'): Promise<boolean> {
  // 调用 IPC: api:validate { type, key }
  // 主进程发起最小请求验证连通性
}
```

**UI 状态**：
- `idle` → 默认输入状态
- `validating` → 显示 Spinner
- `success` → 绿色勾 + "连接成功"
- `error` → 红色提示 + 错误信息

### 5.3 Step3CreateAgent（Agent 创建向导）

**模板数据（本地定义）**：
```typescript
const AGENT_TEMPLATES = [
  {
    id: 'general',
    name: '通用助手',
    icon: '🤖',
    description: '全能型助手，适合日常问答和通用任务',
    systemPrompt: '你是一个全能型AI助手，友好、高效，能处理各类问题。',
  },
  {
    id: 'tech',
    name: '技术专家',
    icon: '💻',
    description: '专注技术问题，擅长代码、架构和调试',
    systemPrompt: '你是一个资深技术专家，擅长编程、系统设计和技术分析，回答严谨、有条理。',
  },
  {
    id: 'writer',
    name: '写作助手',
    icon: '✍️',
    description: '创意写作、文案优化和内容生成',
    systemPrompt: '你是一个专业写作助手，擅长各类文字创作，文笔流畅、富有创意。',
  },
];
```

**创建流程**：
1. 用户填写名称（必填）、描述（选填）
2. 可选择预置模板（选择后自动填充描述）
3. 点击[创建] → 调用 IPC `agent:create` → 获取 `agentId`
4. 更新 `agentStore`，跳转 `/onboarding/complete`

### 5.4 ChatPage（对话主界面）

**布局结构**：
```
<ChatPage>
  <Sidebar />              {/* 左侧 Agent 列表 */}
  <main>
    <ChatHeader />         {/* 当前 Agent 名称 + 设置入口 */}
    <MessageList />        {/* 消息列表（滚动容器） */}
    <InputBar />           {/* 底部输入区 */}
  </main>
</ChatPage>
```

**消息发送流程**：
1. `InputBar` 提交 → `chatStore.appendMessage`（status: sending）
2. 调用 IPC `chat:send { agentId, message, sessionId }`
3. 主进程转发到后端 WebSocket
4. 后端流式返回 → 主进程通过 `chat:token` 事件推送给渲染进程
5. 渲染进程监听 `chat:token`，追加内容到对应消息（流式展示）
6. 收到 `chat:done` → 更新消息 status: done

### 5.5 SoulEditor（Soul.md 编辑器）

- 表单字段映射 Soul.md 各区块
- 实时解析和生成 Markdown 内容
- 修改后自动调用 IPC `agent:saveSoul` 写入文件
- 提供"恢复默认"按钮（基于当前模板重新生成）

---

## 6. IPC 接口定义（渲染进程视角）

渲染进程通过 `window.electronAPI` 与主进程通信，类型定义如下：

```typescript
// types/electronAPI.d.ts
interface ElectronAPI {
  // 配置相关
  config: {
    getInitialized(): Promise<boolean>;
    getApiKeys(): Promise<{ openai: string; anthropic: string; customEndpoint: string }>;
    saveApiKeys(keys: ApiKeyConfig): Promise<void>;
  };
  // API Key 验证
  api: {
    validate(params: { type: 'openai' | 'anthropic'; key: string }): Promise<{ ok: boolean; error?: string }>;
  };
  // Agent 相关
  agent: {
    list(): Promise<Agent[]>;
    create(params: CreateAgentParams): Promise<Agent>;
    getSoul(agentId: string): Promise<string>;       // 返回 soul.md 原始文本
    saveSoul(agentId: string, content: string): Promise<void>;
  };
  // 对话相关
  chat: {
    send(params: { agentId: string; message: string; sessionId: string }): Promise<void>;
    onToken(callback: (token: string) => void): () => void;   // 返回取消订阅函数
    onDone(callback: (messageId: string) => void): () => void;
    onError(callback: (error: string) => void): () => void;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

---

## 7. 样式规范

- **主色调**：深蓝色 `#1E40AF`，辅助色 `#3B82F6`
- **背景**：Dark 主题 `#0F172A`（主）/ `#1E293B`（侧边栏）
- **文字**：`#F1F5F9`（主）/ `#94A3B8`（次）
- **字体**：系统字体栈 `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- **代码字体**：`"JetBrains Mono", "Fira Code", monospace`
- **圆角**：`rounded-lg`（8px）为主，输入框 `rounded-md`（6px）
- **动画**：过渡使用 `transition-all duration-200`，禁用过多 keyframe 动画

---

## 8. 关键交互细节

1. **消息流式展示**：使用 CSS `@keyframes cursor-blink` 在流式输出时显示光标
2. **自动滚动**：消息列表底部自动跟随，用户手动上滚时暂停自动滚动，新消息提示气泡
3. **输入框**：高度自适应（`textarea auto-resize`），最大高度 200px 后出现滚动条
4. **加载状态**：Agent 思考中显示三点跳动动画（`...`）
5. **错误恢复**：发送失败的消息显示重试按钮

---

*文档版本：1.0 | 创建日期：2026-03-28*
