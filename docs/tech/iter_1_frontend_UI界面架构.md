# 技术文档 - 迭代一：前端UI界面架构

**迭代轮数**：1  
**迭代主题**：UI界面架构  
**模块类型**：前端（React）  
**状态**：已重构至ui/  
**创建日期**：2026-03-28

---

## 1. 概述

UI模块是OpenKin的用户界面部分，负责与用户交互、展示聊天内容、管理Agent配置等。经过迭代一的重构，UI模块现在位于`ui/`目录，采用了更加清晰的目录结构和现代化的React开发模式。

---

## 2. 目录结构

```
ui/
├── index.html           # 应用入口HTML
├── main.tsx            # React应用入口
├── App.tsx             # 根组件
├── globals.css         # Tailwind全局样式
├── vite-env.d.ts       # Vite类型声明
├── onboarding/         # 引导流程
│   ├── OnboardingLayout.tsx
│   ├── Step1Welcome.tsx
│   ├── Step2ApiKey.tsx
│   ├── Step3CreateAgent.tsx
│   └── Step4Complete.tsx
├── dashboard/          # 主控制台（聊天）
│   ├── ChatPage.tsx
│   ├── InputBar.tsx
│   ├── MessageBubble.tsx
│   └── MessageList.tsx
├── agent_editor/       # Agent编辑器
│   ├── SettingsPage.tsx
│   └── SoulEditor.tsx
├── components/         # 通用UI组件
│   ├── AgentTemplateCard.tsx
│   ├── ApiKeyInput.tsx
│   ├── ProgressSteps.tsx
│   └── Sidebar/
│       ├── AgentList.tsx
│       └── Sidebar.tsx
├── hooks/              # React Hooks
│   ├── useAgent.ts
│   └── useIpc.ts
├── store/              # 状态管理
│   ├── agentStore.ts
│   ├── chatStore.ts
│   └── appStore.ts
└── types/              # TypeScript类型定义
```

---

## 3. 核心组件详解

### 3.1 应用入口（main.tsx）

**职责**：初始化React应用，注入electronAPI

**关键代码**：

```typescript
// 模拟开发环境的electronAPI
const mockElectronAPI = {
  getAgents: async () => [],
  createAgent: async (data: any) => ({ id: 'mock-id', ...data }),
  deleteAgent: async () => void 0,
  sendMessage: async () => ({ type: 'token', content: 'Mock response', done: true }),
  validateApiKey: async () => ({ ok: true }),
  saveApiKeys: async () => void 0
};

// 注入到window对象
window.electronAPI = window.electronAPI || mockElectronAPI;
```

**特性**：
- 开发环境自动提供mock API
- 支持HMR（热模块替换）
- 全局样式导入

### 3.2 根组件（App.tsx）

**职责**：根据应用状态渲染不同页面

**路由逻辑**：

```typescript
function App() {
  const { appState, setAppState } = useAppStore();
  const { initialized } = useConfig();
  
  useEffect(() => {
    if (!initialized) {
      setAppState('onboarding');
    } else {
      setAppState('chat');
    }
  }, [initialized]);
  
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {appState === 'onboarding' && <OnboardingFlow />}
      {appState === 'chat' && <ChatLayout />}
    </div>
  );
}
```

### 3.3 引导流程（onboarding/）

#### OnboardingLayout.tsx

**职责**：引导流程的布局容器，管理步骤状态

**核心功能**：
- 步骤导航（上一步/下一步）
- 进度指示器
- 表单验证

**步骤管理**：

```typescript
type OnboardingStep = 'welcome' | 'api-key' | 'create-agent' | 'complete';

const STEPS: Record<OnboardingStep, { index: number; title: string }> = {
  welcome: { index: 0, title: '欢迎' },
  'api-key': { index: 1, title: '配置API' },
  'create-agent': { index: 2, title: '创建Agent' },
  complete: { index: 3, title: '完成' }
};
```

#### Step1Welcome.tsx

**职责**：欢迎页面，介绍OpenKin功能

**内容**：
- 项目介绍
- 功能特性说明
- 开始引导按钮

#### Step2ApiKey.tsx

**职责**：收集用户API密钥

**核心功能**：
- 支持OpenAI和Anthropic密钥输入
- 密钥脱敏显示
- 实时验证密钥有效性
- 自定义endpoint配置（可选）

**验证流程**：

```typescript
const handleValidate = async () => {
  if (keyType === 'openai') {
    const result = await window.electronAPI.validateApiKey('openai', apiKey);
    if (!result.ok) {
      setError(result.error || '密钥验证失败');
      return;
    }
  }
  // 类似的Anthropic验证逻辑
  setApiKey(apiKey);
  setStep('create-agent');
};
```

#### Step3CreateAgent.tsx

**职责**：引导用户创建首个Agent

**核心功能**：
- 选择Agent模板（通用助手、技术专家、写作助手）
- 自定义Agent名称和描述
- 实时预览Agent配置

**模板选择**：

```typescript
const TEMPLATES = [
  {
    id: 'general',
    name: '通用助手',
    description: '全能型助手，适合日常问答和通用任务',
    icon: '🤖'
  },
  {
    id: 'tech',
    name: '技术专家',
    description: '专注技术问题，擅长代码、架构和调试',
    icon: '💻'
  },
  {
    id: 'writer',
    name: '写作助手',
    description: '创意写作、文案优化和内容生成',
    icon: '✍️'
  }
];
```

#### Step4Complete.tsx

**职责**：完成引导，进入主界面

**内容**：
- 引导完成确认
- 功能快速入门指南
- 开始使用按钮

### 3.4 主控制台（dashboard/）

#### ChatPage.tsx

**职责**：聊天主页面，包含侧边栏和聊天区域

**布局**：
- 侧边栏（Agent列表）
- 聊天区域（消息列表 + 输入框）

**核心功能**：
- Agent切换
- 消息发送和接收
- 流式响应显示
- 窗口自适应

#### InputBar.tsx

**职责**：消息输入框

**核心功能**：
- 多行文本输入
- 自动高度调整
- 发送按钮
- 支持快捷键（Enter发送，Shift+Enter换行）

**状态管理**：

```typescript
const [input, setInput] = useState('');
const { sendMessage } = useChat();

const handleSend = async () => {
  if (!input.trim()) return;
  
  await sendMessage(agentId, input);
  setInput('');
};
```

#### MessageBubble.tsx

**职责**：单个消息气泡组件

**显示样式**：
- 用户消息：右对齐，蓝色背景
- AI消息：左对齐，灰色背景
- 支持Markdown渲染（待实现）
- 流式响应动画

#### MessageList.tsx

**职责**：消息列表容器

**核心功能**：
- 自动滚动到底部
- 流式消息实时追加
- 消息去重和排序

### 3.5 Agent编辑器（agent_editor/）

#### SettingsPage.tsx

**职责**：设置页面

**核心功能**：
- API密钥重新配置
- Agent管理（创建、删除）
- UI主题切换

#### SoulEditor.tsx

**职责**：Soul.md编辑器

**核心功能**：
- 实时编辑Agent的Soul.md
- 预览模式
- 保存功能

---

## 4. 通用组件库（components/）

### 4.1 AgentTemplateCard.tsx

**职责**：Agent模板卡片选择组件

**Props**：
```typescript
interface AgentTemplateCardProps {
  template: Template;
  selected: boolean;
  onSelect: () => void;
}
```

**样式**：
- 选中状态高亮
- 悬停效果
- 图标 + 名称 + 描述

### 4.2 ApiKeyInput.tsx

**职责**：API密钥输入组件

**核心功能**：
- 密钥脱敏显示（`sk-****...`）
- 显示/隐藏切换
- 实时格式验证

### 4.3 ProgressSteps.tsx

**职责**：步骤进度指示器

**核心功能**：
- 显示当前步骤
- 已完成步骤标记
- 步骤标题显示

### 4.4 Sidebar组件（Sidebar/）

#### Sidebar.tsx

**职责**：侧边栏容器

**布局**：
- 顶部：应用Logo和标题
- 中部：Agent列表
- 底部：设置按钮

#### AgentList.tsx

**职责**：Agent列表显示

**核心功能**：
- Agent卡片列表
- 删除Agent功能
- 当前Agent高亮

---

## 5. React Hooks（hooks/）

### 5.1 useAgent.ts

**职责**：Agent相关操作的Hook

**核心功能**：
- 获取Agent列表
- 创建Agent
- 删除Agent
- Agent状态缓存

**使用示例**：

```typescript
const { agents, createAgent, deleteAgent, loading } = useAgent();

await createAgent({
  name: 'My Assistant',
  templateId: 'general'
});
```

### 5.2 useIpc.ts

**职责**：IPC通信Hook（已废弃，功能集成到其他Hook中）

**注意**：该Hook在重构过程中已被移除，相关功能已直接集成到`useAgent`和`useChat`中。

---

## 6. 状态管理（store/）

### 6.1 agentStore.ts

**职责**：Agent全局状态管理

**State结构**：

```typescript
interface AgentStoreState {
  agents: Agent[];
  currentAgentId: string | null;
  loading: boolean;
  
  loadAgents: () => Promise<void>;
  setCurrentAgent: (id: string) => void;
  addAgent: (agent: Agent) => void;
  removeAgent: (id: string) => void;
}
```

**实现**：使用Zustand

### 6.2 chatStore.ts

**职责**：聊天全局状态管理

**State结构**：

```typescript
interface ChatStoreState {
  sessions: Record<string, ChatSession>;
  currentAgentId: string | null;
  
  startSession: (agentId: string) => string;
  addMessage: (sessionId: string, message: ChatMessage) => void;
  appendStream: (sessionId: string, content: string) => void;
}
```

### 6.3 appStore.ts

**职责**：应用全局状态管理

**State结构**：

```typescript
interface AppState {
  appState: 'onboarding' | 'chat';
  setAppState: (state: 'onboarding' | 'chat') => void;
}
```

---

## 7. 样式系统（styles/）

### 7.1 globals.css

**职责**：Tailwind全局样式和自定义样式

**核心内容**：

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* 自定义样式 */
@layer components {
  .chat-input {
    @apply w-full px-4 py-3 bg-gray-800 rounded-lg border border-gray-700 
           focus:outline-none focus:border-blue-500 transition-colors;
  }
  
  .message-bubble {
    @apply max-w-[80%] px-4 py-3 rounded-2xl;
  }
}

@layer utilities {
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
}
```

**Tailwind配置**：

```javascript
// tailwind.config.js
module.exports = {
  content: [
    './ui/**/*.{js,ts,jsx,tsx}',
    './ui/index.html'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gray: {
          850: '#1f2937',
          900: '#111827',
          950: '#0b0f19'
        }
      }
    }
  }
}
```

---

## 8. 类型定义（types/）

**核心类型**：

```typescript
// Agent类型
export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  createdAt: string;
  soulMdPath: string;
}

// 聊天消息类型
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

// Agent模板类型
export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  systemPrompt: string;
  communicationStyle: string;
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
```

---

## 9. 安全配置

### 9.1 Content Security Policy

**位置**：`ui/index.html`

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline'; 
               style-src 'self' 'unsafe-inline' 'unsafe-eval'; 
               connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:*" />
```

**说明**：
- `unsafe-inline`：允许内联脚本（开发模式）
- `unsafe-eval`：支持Vite HMR和Tailwind运行时
- `connect-src`：允许WebSocket和HTTP连接本地后端

---

## 10. 开发工具

### 10.1 Vite配置

**位置**：`electron.vite.config.ts`中的renderer配置

**特性**：
- React 19支持
- TypeScript支持
- HMR（热模块替换）
- 路径别名（@ui → ui/）

### 10.2 开发体验

**启动开发服务器**：

```bash
npm run dev
```

**HMR支持**：
- 组件热更新
- 样式热更新
- 全局变量注入

---

## 11. 依赖说明

**核心依赖**：
- `react` - UI框架
- `react-dom` - React DOM渲染
- `react-router-dom` - 路由管理
- `zustand` - 状态管理
- `tailwindcss` - CSS框架
- `@tailwindcss/vite` - Tailwind Vite插件
- `autoprefixer` - CSS自动前缀

**开发依赖**：
- `vite` - 构建工具
- `@vitejs/plugin-react` - Vite React插件
- `typescript` - TypeScript支持
- `@types/react` - React类型定义

---

**文档版本**：1.0  
**最后更新**：2026-03-28  
**状态**：✅ 已重构至ui/，所有组件正常，样式正确加载
