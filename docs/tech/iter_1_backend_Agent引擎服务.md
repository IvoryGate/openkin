# 技术文档 - 迭代一 · 后端：Agent 引擎服务

**迭代轮数**：1  
**层次**：Backend（Hono HTTP + WebSocket，Node.js）  
**状态**：设计中

---

## 1. 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | 20+ | 运行时 |
| TypeScript | 5.x | 类型安全 |
| Hono | 4.x | HTTP + WebSocket 框架 |
| openai（npm） | 4.x | OpenAI SDK（含 stream） |
| @anthropic-ai/sdk | 0.x | Anthropic SDK |
| ws / @hono/node-server | — | WebSocket 支持 |
| zod | 3.x | 运行时参数校验 |
| nanoid | 5.x | 唯一 ID 生成 |

---

## 2. 服务架构

后端以**独立 Node.js 进程**运行，由 Electron 主进程在应用启动时 `spawn`，通过 HTTP + WebSocket 与主进程通信。

```
┌────────────────────────────────────────────┐
│  Electron 主进程                             │
│  - 管理后端进程生命周期（spawn/kill）          │
│  - IPC ↔ 渲染进程                           │
│  - 转发 HTTP / WebSocket 请求到后端          │
└──────────────────┬─────────────────────────┘
                   │ HTTP / WebSocket（本地 127.0.0.1）
┌──────────────────▼─────────────────────────┐
│  Backend 服务（Hono + Node.js）              │
│                                            │
│  POST /api/agents          Agent 管理       │
│  GET  /api/agents/:id                      │
│  POST /api/agents/:id/soul  Soul 文件操作   │
│  POST /api/config/validate  API Key 验证   │
│  WS   /ws/chat              流式对话        │
└────────────────────────────────────────────┘
```

**端口**：运行时动态选取可用端口（从 `7788` 开始尝试），主进程在启动后端时获取实际端口。

---

## 3. 目录结构

```
src/
├── backend/
│   ├── index.ts              # 入口：启动 Hono 服务器
│   ├── app.ts                # Hono app 实例 + 路由注册
│   ├── routes/
│   │   ├── agents.ts         # Agent CRUD 接口
│   │   ├── config.ts         # 配置 & API Key 验证接口
│   │   └── chat.ts           # WebSocket 对话接口
│   ├── services/
│   │   ├── AgentService.ts   # Agent 业务逻辑
│   │   ├── ChatService.ts    # 对话 & LLM 调用逻辑
│   │   ├── SoulService.ts    # Soul.md 读写逻辑
│   │   └── ConfigService.ts  # 配置读写 & 加密逻辑
│   ├── llm/
│   │   ├── LLMClient.ts      # LLM 客户端抽象层
│   │   ├── OpenAIClient.ts   # OpenAI 实现
│   │   └── AnthropicClient.ts # Anthropic 实现
│   ├── storage/
│   │   ├── FileStorage.ts    # 本地文件 I/O 工具
│   │   └── paths.ts          # 数据目录路径常量
│   └── types/
│       ├── agent.ts
│       ├── chat.ts
│       └── config.ts
```

---

## 4. HTTP 接口规范

### 4.1 全局约定

- **Base URL**：`http://127.0.0.1:{port}/api`
- **Content-Type**：`application/json`
- **错误格式**：
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Field 'name' is required"
    }
  }
  ```
- **成功格式**：`{ "data": <payload> }`（单资源）或 `{ "data": [...], "total": n }`（列表）

---

### 4.2 Agent 接口

#### `GET /api/agents`

返回所有 Agent 列表。

**响应**：
```json
{
  "data": [
    {
      "id": "agt_abc123",
      "name": "技术助手",
      "role": "技术专家",
      "description": "...",
      "createdAt": "2026-03-28T10:00:00.000Z",
      "soulMdPath": "/Users/.openkin/agents/agt_abc123/soul.md"
    }
  ],
  "total": 1
}
```

---

#### `POST /api/agents`

创建新 Agent，同时生成 Soul.md 文件。

**请求体**：
```json
{
  "name": "技术助手",          // required, 2-50 chars
  "role": "技术专家",           // optional
  "description": "...",       // optional
  "templateId": "tech",       // optional: "general" | "tech" | "writer"
  "systemPrompt": "..."       // optional, override template's systemPrompt
}
```

**响应**（201）：
```json
{
  "data": {
    "id": "agt_abc123",
    "name": "技术助手",
    "role": "技术专家",
    "description": "...",
    "createdAt": "2026-03-28T10:00:00.000Z",
    "soulMdPath": "/Users/.openkin/agents/agt_abc123/soul.md"
  }
}
```

**业务逻辑**：
1. 参数校验（zod schema）
2. 生成 `agentId = "agt_" + nanoid(8)`
3. 在 `~/.openkin/agents/{agentId}/` 创建目录
4. 根据 `templateId` 或自定义参数生成 `soul.md` 内容并写入
5. 写入 `meta.json`
6. 返回 Agent 元数据

---

#### `GET /api/agents/:id`

获取单个 Agent 详情。

**响应**：同 POST 响应格式，额外包含 `soulContent: string`（soul.md 原始文本）。

---

#### `GET /api/agents/:id/soul`

获取 Agent soul.md 原始内容。

**响应**：
```json
{
  "data": {
    "content": "# Agent 个性配置\n\n## 基本信息\n..."
  }
}
```

---

#### `PUT /api/agents/:id/soul`

更新 Agent soul.md 内容。

**请求体**：
```json
{
  "content": "# Agent 个性配置\n..."   // 完整 soul.md Markdown 文本
}
```

**响应**（200）：`{ "data": { "ok": true } }`

---

### 4.3 配置接口

#### `POST /api/config/validate-key`

验证 API Key 可用性（发起最小 API 请求）。

**请求体**：
```json
{
  "type": "openai",         // "openai" | "anthropic"
  "key": "sk-..."
}
```

**响应**（200）：
```json
{
  "data": {
    "ok": true,
    "model": "gpt-4o-mini"   // 首个可用模型名
  }
}
```

**响应**（200，失败时）：
```json
{
  "data": {
    "ok": false,
    "error": "Invalid API key"
  }
}
```

**实现**：
- OpenAI：调用 `openai.models.list()` 取第一个模型
- Anthropic：调用 `anthropic.models.list()` 取第一个模型
- 设置 10 秒超时，任何异常均返回 `ok: false`

---

#### `POST /api/config/save-keys`

保存 API Key 到本地（加密存储）。

**请求体**：
```json
{
  "openai": "sk-...",
  "anthropic": "...",        // 可选
  "customEndpoint": "..."    // 可选
}
```

**响应**（200）：`{ "data": { "ok": true } }`

---

### 4.4 WebSocket 对话接口

#### `WS /ws/chat`

建立 WebSocket 连接后，通过 JSON 消息进行流式对话。

**客户端发送（发起对话）**：
```json
{
  "type": "chat",
  "agentId": "agt_abc123",
  "sessionId": "sess_xyz",
  "message": "帮我写一个快速排序",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**服务端推送（流式 token）**：
```json
{ "type": "token", "messageId": "msg_001", "content": "当然" }
{ "type": "token", "messageId": "msg_001", "content": "，" }
{ "type": "token", "messageId": "msg_001", "content": "以下" }
```

**服务端推送（完成）**：
```json
{ "type": "done", "messageId": "msg_001", "usage": { "prompt_tokens": 50, "completion_tokens": 200 } }
```

**服务端推送（错误）**：
```json
{ "type": "error", "code": "LLM_ERROR", "message": "Rate limit exceeded" }
```

---

## 5. 核心服务实现

### 5.1 LLMClient 抽象层

```typescript
// llm/LLMClient.ts
export interface StreamChunk {
  content: string;
  done: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMClient {
  /**
   * 流式对话，返回 AsyncIterable
   */
  streamChat(messages: ChatMessage[]): AsyncIterable<StreamChunk>;
  
  /**
   * 验证 API Key（抛出异常表示失败）
   */
  validateKey(): Promise<{ ok: boolean; model?: string; error?: string }>;
}
```

### 5.2 OpenAIClient 实现

```typescript
// llm/OpenAIClient.ts
export class OpenAIClient implements LLMClient {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = 'gpt-4o-mini') {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async *streamChat(messages: ChatMessage[]): AsyncIterable<StreamChunk> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content ?? '';
      const done = chunk.choices[0]?.finish_reason === 'stop';
      if (content) yield { content, done: false };
      if (done) yield { content: '', done: true };
    }
  }

  async validateKey() {
    try {
      const models = await this.client.models.list();
      return { ok: true, model: models.data[0]?.id };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }
}
```

### 5.3 ChatService

```typescript
// services/ChatService.ts
export class ChatService {
  constructor(
    private agentService: AgentService,
    private soulService: SoulService,
    private configService: ConfigService,
  ) {}

  async *streamChat(params: {
    agentId: string;
    userMessage: string;
    history: ChatMessage[];
  }): AsyncIterable<StreamChunk> {
    // 1. 获取 Agent Soul.md，解析 System Prompt
    const soul = await this.soulService.parseSoul(params.agentId);
    
    // 2. 构建消息列表
    const messages: ChatMessage[] = [
      { role: 'system', content: soul.systemPrompt },
      ...params.history.slice(-20),  // 最多保留最近 20 条历史
      { role: 'user', content: params.userMessage },
    ];

    // 3. 获取配置的 LLM 客户端
    const llmClient = await this.configService.getLLMClient();

    // 4. 流式调用
    yield* llmClient.streamChat(messages);
  }
}
```

### 5.4 SoulService

```typescript
// services/SoulService.ts
export interface ParsedSoul {
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  communicationStyle: string;
}

export class SoulService {
  async getSoulContent(agentId: string): Promise<string> {
    // 读取 ~/.openkin/agents/{agentId}/soul.md
  }

  async saveSoulContent(agentId: string, content: string): Promise<void> {
    // 写入 ~/.openkin/agents/{agentId}/soul.md
  }

  parseSoul(content: string): ParsedSoul {
    // 简单的 Markdown section 解析
    // 使用正则提取各 ## 标题下的内容
    // 提取 "系统提示词" section 作为 systemPrompt
  }

  generateSoulMd(params: {
    name: string;
    role: string;
    description: string;
    systemPrompt: string;
    communicationStyle?: string;
  }): string {
    // 根据参数生成 soul.md Markdown 文本
  }
}
```

### 5.5 ConfigService（加密存储）

```typescript
// services/ConfigService.ts
// 使用 Node.js 内置 crypto 模块，AES-256-GCM 加密
export class ConfigService {
  private readonly encryptionKey: Buffer;   // 从机器指纹派生

  encrypt(text: string): string { ... }
  decrypt(encrypted: string): string { ... }

  async saveApiKeys(keys: ApiKeyConfig): Promise<void> {
    // 加密后写入 ~/.openkin/config.json
  }

  async getApiKeys(): Promise<ApiKeyConfig> {
    // 读取并解密 ~/.openkin/config.json
  }

  async getLLMClient(): Promise<LLMClient> {
    // 根据配置返回对应 LLMClient 实例
    // 优先级：openai > anthropic > customEndpoint
  }
}
```

---

## 6. 错误处理规范

| 错误码 | HTTP 状态 | 含义 |
|--------|----------|------|
| `VALIDATION_ERROR` | 400 | 请求参数校验失败 |
| `AGENT_NOT_FOUND` | 404 | Agent ID 不存在 |
| `LLM_ERROR` | 502 | LLM API 调用失败 |
| `LLM_TIMEOUT` | 504 | LLM API 超时（> 30s） |
| `CONFIG_ERROR` | 500 | 配置读写失败 |
| `STORAGE_ERROR` | 500 | 文件系统操作失败 |

WebSocket 错误通过 `{ type: "error", code, message }` 推送，**不关闭连接**（由客户端决定是否重连）。

---

## 7. 日志规范

- 使用 `console.info` / `console.error` 输出，由 Electron 主进程捕获写入日志文件
- 格式：`[LEVEL] [SERVICE] message {context}`
- 示例：`[INFO] [ChatService] Starting stream chat agentId=agt_abc123 sessionId=sess_xyz`
- 敏感信息（API Key）**禁止**写入日志

---

## 8. 性能约束

| 指标 | 目标 |
|------|------|
| HTTP 接口响应（非 LLM） | < 100ms |
| WebSocket 首 token 延迟 | < 2s（依赖 LLM 提供商） |
| 并发对话连接数 | ≥ 5（MVP 阶段） |
| 内存占用（后端进程） | < 150MB |

---

*文档版本：1.0 | 创建日期：2026-03-28*
