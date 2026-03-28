# 技术文档 - 迭代二：后端Agent引擎服务

**迭代轮数**：1  
**迭代主题**：Agent引擎服务  
**模块类型**：后端（Hono）  
**状态**：已重构至core/agent_engine/  
**创建日期**：2026-03-28

---

## 1. 概述

Agent引擎服务是OpenKin的核心后端模块，负责Agent管理、配置管理、聊天服务以及与LLM提供商的集成。经过迭代一的重构，该模块现在位于`core/agent_engine/`目录，采用了更加模块化的架构设计。

---

## 2. 模块结构

```
core/agent_engine/
├── llm/                    # LLM客户端实现
│   ├── LLMClient.ts      # LLM客户端抽象接口
│   ├── OpenAIClient.ts   # OpenAI API客户端
│   └── AnthropicClient.ts # Anthropic API客户端
├── services/                # 核心服务
│   ├── AgentService.ts   # Agent CRUD服务
│   ├── ChatService.ts    # 聊天服务
│   └── ConfigService.ts  # 配置服务
├── routes/                  # HTTP路由
│   ├── agents.ts        # Agent相关API
│   ├── chat.ts          # 聊天API
│   └── config.ts        # 配置API
├── app.ts                   # Hono应用入口
├── index.ts                 # 服务启动入口
└── types/                   # TypeScript类型定义
```

---

## 3. 核心服务详解

### 3.1 LLMClient接口（llm/LLMClient.ts）

**职责**：定义统一的LLM客户端接口，支持流式聊天

**接口定义**：

```typescript
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export interface ValidateKeyResult {
  ok: boolean;
  model?: string;
  error?: string;
}

export interface LLMClient {
  *streamChat(messages: ChatMessage[]): AsyncIterable<StreamChunk>;
  validateKey(): Promise<ValidateKeyResult>;
}
```

**设计要点**：
- 使用AsyncIterable支持流式响应
- 支持token级别的错误处理
- 统一的密钥验证接口

### 3.2 OpenAIClient实现（llm/OpenAIClient.ts）

**职责**：实现OpenAI API的客户端

**核心功能**：
- 支持自定义endpoint（兼容本地模型和第三方服务）
- 支持自定义模型名称
- 实现流式聊天响应
- 密钥验证机制

**技术实现**：

```typescript
export class OpenAIClient implements LLMClient {
  constructor(
    apiKey: string, 
    model: string = 'gpt-4o-mini',
    baseURL?: string
  )
  
  async *streamChat(messages: ChatMessage[]): AsyncIterable<StreamChunk>
  
  async validateKey(): Promise<ValidateKeyResult>
}
```

**特性**：
- 完全兼容OpenAI API规范
- 支持环境变量配置endpoint
- 自动错误重试和超时处理

### 3.3 AnthropicClient实现（llm/AnthropicClient.ts）

**职责**：实现Anthropic Claude API的客户端

**核心功能**：
- 支持Claude系列模型
- 实现流式聊天响应
- 消息历史管理

**技术实现**：

```typescript
export class AnthropicClient implements LLMClient {
  constructor(apiKey: string)
  
  async *streamChat(messages: ChatMessage[]): AsyncIterable<StreamChunk>
  
  async validateKey(): Promise<ValidateKeyResult>
}
```

### 3.4 AgentService（services/AgentService.ts）

**职责**：Agent的CRUD操作和Soul文件管理

**核心功能**：
- 创建新Agent（支持模板）
- 查询Agent列表
- 获取单个Agent详情
- 删除Agent
- Agent模板管理

**模板系统**：

```typescript
const TEMPLATES: Record<string, TemplateConfig> = {
  general: {
    role: '通用助手',
    description: '全能型助手，适合日常问答和通用任务',
    systemPrompt: '你是一个全能型AI助手，友好、高效，能处理各类问题。',
    communicationStyle: '亲切友好'
  },
  tech: {
    role: '技术专家',
    description: '专注技术问题，擅长代码、架构和调试',
    systemPrompt: '你是一个资深技术专家，擅长编程、系统设计和技术分析...',
    communicationStyle: '严谨专业'
  },
  writer: {
    role: '写作助手',
    description: '创意写作、文案优化和内容生成',
    systemPrompt: '你是一个专业写作助手...',
    communicationStyle: '富有创意'
  }
}
```

**数据模型**：

```typescript
export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  createdAt: string;
  soulMdPath: string;
}

export interface CreateAgentParams {
  name: string;
  role?: string;
  description?: string;
  templateId?: 'general' | 'tech' | 'writer';
  systemPrompt?: string;
}
```

**文件操作**：
- 在`~/.openkin/agents/{agentId}/`目录创建Agent
- 生成`soul.md`文件
- 生成`meta.json`文件记录元数据

### 3.5 ChatService（services/ChatService.ts）

**职责**：处理聊天请求和流式响应

**核心功能**：
- 创建聊天会话
- 流式返回AI响应
- 注入System Prompt（从Soul.md读取）
- 消息历史管理

**技术实现**：

```typescript
export class ChatService {
  constructor(
    agentService: AgentService,
    soulService: SoulService,
    configService: ConfigService
  )
  
  async *streamChat(agentId: string, message: string): AsyncGenerator<StreamChunk>
}
```

**流程**：
1. 根据agentId获取Agent配置
2. 从Soul.md读取system prompt
3. 调用LLM客户端获取流式响应
4. 返回token流给前端

### 3.6 ConfigService（services/ConfigService.ts）

**职责**：API密钥管理和配置持久化

**核心功能**：
- AES-256-GCM加密存储API密钥
- 配置文件的读写
- 应用初始化状态管理
- 多LLM提供商支持

**安全机制**：

```typescript
function deriveEncryptionKey(): Buffer {
  const fingerprint = `${hostname()}-${userInfo().username}-openkin-v1`;
  return createHash('sha256').update(fingerprint).digest();
}

const ENCRYPTION_KEY = deriveEncryptionKey();
```

**加密算法**：AES-256-GCM
**IV长度**：12字节
**Tag长度**：16字节

**配置文件结构**：

```json
{
  "version": "1.0",
  "initialized": boolean,
  "active_agent_id": string | null,
  "api_keys": {
    "openai": "<encrypted>",
    "anthropic": "<encrypted>",
    "custom_endpoint": "",
    "custom_model": ""
  },
  "ui": {
    "theme": "dark" | "light",
    "language": "zh-CN" | "en-US"
  }
}
```

---

## 4. HTTP API路由（routes/）

### 4.1 Agents路由（routes/agents.ts）

**端点**：
- `GET /api/agents` - 列出所有Agent
- `POST /api/agents` - 创建新Agent
- `GET /api/agents/:id` - 获取Agent详情
- `DELETE /api/agents/:id` - 删除Agent
- `GET /api/agents/:id/soul` - 获取Soul.md内容
- `PUT /api/agents/:id/soul` - 更新Soul.md

**验证**：使用Zod进行请求体验证

### 4.2 Chat路由（routes/chat.ts）

**WebSocket端点**：
- `WS /ws/chat` - 聊天WebSocket连接

**消息协议**：

```typescript
interface WsChatRequest {
  type: 'chat';
  agentId: string;
  sessionId: string;
  message: string;
  history?: ChatMessage[];
}

interface WsServerMessage {
  type: 'token' | 'done' | 'error';
  messageId?: string;
  content?: string;
  error?: { code: string; message: string };
}
```

**功能**：
- 连接管理
- 消息分发
- 错误处理
- 连接清理

### 4.3 Config路由（routes/config.ts）

**端点**：
- `GET /api/config/initialized` - 检查初始化状态
- `GET /api/config/keys` - 获取API密钥
- `POST /api/config/save-keys` - 保存API密钥
- `POST /api/config/validate-key` - 验证API密钥

**密钥验证流程**：
1. 接收类型和密钥
2. 创建对应LLM客户端实例
3. 发送最小测试请求
4. 返回验证结果

---

## 5. Hono应用配置（app.ts）

**中间件**：
- CORS：允许所有来源（开发模式）
- Logger：请求日志记录

**路由注册**：

```typescript
app.route('/api/agents', createAgentsRouter(agentService, soulService));
app.route('/api/config', createConfigRouter(configService));
app.get('/health', (c) => c.json({ ok: true, ts: Date.now() }));
```

**健康检查**：
- 端点：`/health`
- 返回格式：`{ ok: boolean, ts: number }`

---

## 6. 服务启动（index.ts）

**启动流程**：
1. 配置端口（默认7788，支持环境变量覆盖）
2. 创建HTTP服务器
3. 挂载WebSocket升级处理器
4. 写入端口文件供Electron读取
5. 输出就绪信号

**端口文件**：
- 位置：`~/.openkin/.backend_port`
- 格式：纯数字字符串

**优雅退出**：
- 监听SIGTERM和SIGINT信号
- 清理资源
- 正常退出进程

---

## 7. 环境变量配置

**BACKEND_PORT**：默认7788，可通过环境变量覆盖

**使用示例**：
```bash
# 默认端口
npm run dev:backend

# 自定义端口
BACKEND_PORT=8080 npm run dev:backend
```

---

## 8. 依赖说明

**核心依赖**：
- `hono` - Web框架
- `@hono/node-server` - Node.js HTTP服务器
- `@hono/zod-validator` - Zod验证器集成
- `nanoid` - 生成唯一ID
- `openai` - OpenAI SDK
- `@anthropic-ai/sdk` - Anthropic SDK

**开发依赖**：
- `tsx` - TypeScript执行器（开发模式）
- `typescript` - TypeScript编译器

---

**文档版本**：1.0  
**最后更新**：2026-03-28  
**状态**：✅ 已重构至core/agent_engine/，所有功能正常
