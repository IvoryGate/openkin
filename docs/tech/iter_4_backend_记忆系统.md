# 技术文档 - 迭代四：记忆系统

**迭代轮数**：4  
**迭代主题**：记忆系统  
**模块类型**：后端（Hono）  
**状态**：开发中  
**创建日期**：2026-03-28

---

## 1. 概述

记忆系统是OpenKin第二阶段的核心功能之一，负责存储和管理Agent与用户的对话历史、长期知识库以及用户画像。系统分为短期记忆和长期记忆两部分，支持高效的检索和归档机制。记忆系统将与现有的ChatService集成，为Agent提供上下文感知能力。

---

## 2. 模块结构

```
core/memory_system/
├── MemoryService.ts       # 记忆服务主类（高层API）
├── ShortTermMemory.ts     # 短期记忆管理
├── LongTermMemory.ts      # 长期记忆管理
├── MemoryRetrieval.ts     # 记忆检索
├── types/                 # 类型定义
│   ├── memory.ts
│   └── retrieval.ts
└── storage/               # 存储适配器
    ├── FileStorage.ts     # 文件存储（复用）
    └── paths.ts          # 路径管理
```

---

## 3. 核心数据结构

### 3.1 记忆类型定义

```typescript
// types/memory.ts
export interface Memory {
  id: string;
  type: 'preference' | 'knowledge' | 'conversation' | 'context';
  content: string;
  importance: number; // 1-10, 10为最重要
  tags: string[];
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  lastAccessedAt: number;
  agentId: string;
  userId?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  memoryId?: string; // 关联的记忆ID
}

export interface Session {
  sessionId: string;
  agentId: string;
  userId: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface LongTermMemoryConfig {
  maxMemories: number; // 最大长期记忆数量，默认1000
  autoArchive: boolean; // 自动归档，默认true
  archiveThreshold: number; // 归档阈值，默认5（被引用5次后归档）
  retentionDays: number; // 保留天数，默认90天
}
```

### 3.2 检索类型定义

```typescript
// types/retrieval.ts
export interface SearchQuery {
  query: string;
  type?: Memory['type'];
  agentId?: string;
  tags?: string[];
  minImportance?: number;
  timeRange?: {
    start: number;
    end: number;
  };
  limit?: number;
}

export interface SearchResult {
  memory: Memory;
  relevance: number; // 相关度分数，0-1
}

export interface RetrievalOptions {
  useEmbedding?: boolean; // 是否使用嵌入向量
  embeddingModel?: string;
  fuzzyMatch?: boolean; // 是否模糊匹配
  timeWeight?: number; // 时间权重，0-1
  importanceWeight?: number; // 重要性权重，0-1
}
```

---

## 4. 核心服务实现

### 4.1 MemoryService（记忆服务）

**职责**：统一管理短期和长期记忆，提供高层API

**文件位置**：`core/memory_system/MemoryService.ts`

```typescript
import { nanoid } from 'nanoid';
import { ShortTermMemory } from './ShortTermMemory';
import { LongTermMemory } from './LongTermMemory';
import { MemoryRetrieval } from './MemoryRetrieval';
import { ChatMessage } from './types/memory';

export class MemoryService {
  constructor(
    private shortTerm: ShortTermMemory,
    private longTerm: LongTermMemory,
    private retrieval: MemoryRetrieval
  ) {}

  // 存储消息
  async addMessage(
    sessionId: string,
    agentId: string,
    userId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<string> {
    const message: ChatMessage = {
      id: `msg_${nanoid(8)}`,
      role,
      content,
      timestamp: Date.now()
    };
    
    await this.shortTerm.addMessage(sessionId, agentId, userId, message);
    
    // 检查是否需要归档
    await this.checkAndArchive(sessionId, agentId, message);
    
    return message.id;
  }

  // 获取会话历史
  async getSessionHistory(
    sessionId: string,
    limit: number = 20
  ): Promise<ChatMessage[]> {
    return this.shortTerm.getSessionHistory(sessionId, limit);
  }

  // 添加长期记忆
  async addLongTermMemory(
    memory: Omit<Memory, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessedAt'>
  ): Promise<string> {
    const fullMemory: Memory = {
      ...memory,
      id: `mem_${nanoid(8)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      accessCount: 0,
      lastAccessedAt: Date.now()
    };
    
    await this.longTerm.add(fullMemory);
    return fullMemory.id;
  }

  // 搜索记忆
  async searchMemories(
    query: any,
    options?: any
  ): Promise<any[]> {
    return this.retrieval.search(query, options);
  }

  // 归档消息到长期记忆
  private async checkAndArchive(
    sessionId: string,
    agentId: string,
    message: ChatMessage
  ): Promise<void> {
    // 检查消息是否重要
    const importance = await this.assessImportance(message);
    
    if (importance >= 5) {
      // 将消息转换为长期记忆
      const memory: Memory = {
        id: `mem_${nanoid(8)}`,
        type: 'conversation',
        content: message.content,
        importance,
        tags: [],
        createdAt: message.timestamp,
        updatedAt: Date.now(),
        accessCount: 1,
        lastAccessedAt: Date.now(),
        agentId
      };
      
      await this.longTerm.add(memory);
    }
  }

  // 评估消息重要性
  private async assessImportance(message: ChatMessage): Promise<number> {
    // 使用LLM评估消息重要性
    // 或者基于规则（如包含用户偏好、技术问题等）
    // 返回1-10的分数
    return 5; // 默认中等重要性
  }
}
```

---

### 4.2 ShortTermMemory（短期记忆）

**职责**：管理会话级别的短期记忆

**文件位置**：`core/memory_system/ShortTermMemory.ts`

```typescript
import { ChatMessage, Session } from './types/memory';
import { FileStorage } from '../agent_engine/storage/FileStorage';

export class ShortTermMemory {
  private sessions: Map<string, Session> = new Map();
  private readonly MAX_MESSAGES_PER_SESSION = 20;
  private readonly SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24小时

  constructor(private storage: FileStorage) {
    this.loadSessions();
  }

  async addMessage(
    sessionId: string,
    agentId: string,
    userId: string,
    message: ChatMessage
  ): Promise<void> {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      session = {
        sessionId,
        agentId,
        userId,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      this.sessions.set(sessionId, session);
    }

    session.messages.push(message);
    session.updatedAt = Date.now();

    // 限制消息数量
    if (session.messages.length > this.MAX_MESSAGES_PER_SESSION) {
      session.messages.shift(); // 移除最旧的消息
    }

    await this.saveSession(session);
  }

  async getSessionHistory(
    sessionId: string,
    limit: number = this.MAX_MESSAGES_PER_SESSION
  ): Promise<ChatMessage[]> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return [];
    }

    return session.messages.slice(-limit);
  }

  async getRecentSessions(
    agentId: string,
    limit: number = 10
  ): Promise<Session[]> {
    const sessions = Array.from(this.sessions.values())
      .filter(s => s.agentId === agentId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);

    return sessions;
  }

  private async saveSession(session: Session): Promise<void> {
    const agentsDir = await this.getAgentsDir();
    await this.storage.writeJson(
      `${agentsDir}/memories/${session.agentId}/${session.sessionId}.json`,
      session
    );
  }

  private async getAgentsDir(): Promise<string> {
    // 复用agent_engine的路径管理
    const { getDataDir } = await import('../agent_engine/storage/paths');
    return getDataDir();
  }

  private async loadSessions(): Promise<void> {
    // 从文件系统加载现有会话
    // 实现略
  }
}
```

---

### 4.3 LongTermMemory（长期记忆）

**职责**：管理和归档长期记忆

**文件位置**：`core/memory_system/LongTermMemory.ts`

```typescript
import { Memory, LongTermMemoryConfig } from './types/memory';
import { FileStorage } from '../agent_engine/storage/FileStorage';

export class LongTermMemory {
  private memories: Memory[] = [];
  private config: LongTermMemoryConfig;

  constructor(
    private storage: FileStorage,
    config?: Partial<LongTermMemoryConfig>
  ) {
    this.config = {
      maxMemories: 1000,
      autoArchive: true,
      archiveThreshold: 5,
      retentionDays: 90,
      ...config
    };

    this.load();
  }

  async add(memory: Memory): Promise<void> {
    this.memories.push(memory);
    
    // 检查是否超过最大数量
    if (this.memories.length > this.config.maxMemories) {
      await this.cleanupOldMemories();
    }

    await this.save();
  }

  async get(memoryId: string): Promise<Memory | undefined> {
    const memory = this.memories.find(m => m.id === memoryId);
    
    if (memory) {
      // 更新访问统计
      memory.accessCount++;
      memory.lastAccessedAt = Date.now();
      await this.save();
    }

    return memory;
  }

  async getByAgent(agentId: string): Promise<Memory[]> {
    return this.memories.filter(m => m.agentId === agentId);
  }

  async getByType(type: Memory['type']): Promise<Memory[]> {
    return this.memories.filter(m => m.type === type);
  }

  async update(
    memoryId: string,
    updates: Partial<Memory>
  ): Promise<void> {
    const index = this.memories.findIndex(m => m.id === memoryId);
    
    if (index !== -1) {
      this.memories[index] = {
        ...this.memories[index],
        ...updates,
        updatedAt: Date.now()
      };
      await this.save();
    }
  }

  async delete(memoryId: string): Promise<void> {
    this.memories = this.memories.filter(m => m.id !== memoryId);
    await this.save();
  }

  private async cleanupOldMemories(): Promise<void> {
    const now = Date.now();
    const retentionMs = this.config.retentionDays * 24 * 60 * 60 * 1000;

    // 移除过期的记忆
    this.memories = this.memories.filter(m => {
      const age = now - m.createdAt;
      return age < retentionMs || m.importance >= 8;
    });

    // 按重要性排序，保留重要的
    this.memories.sort((a, b) => {
      // 先按重要性降序
      if (b.importance !== a.importance) {
        return b.importance - a.importance;
      }
      // 再按最后访问时间降序
      return b.lastAccessedAt - a.lastAccessedAt;
    });

    // 截断到最大数量
    this.memories = this.memories.slice(0, this.config.maxMemories);

    await this.save();
  }

  private async load(): Promise<void> {
    try {
      const data = await this.storage.readJson<{ memories: Memory[] }>(
        'memories/longterm.json'
      );
      this.memories = data?.memories || [];
    } catch (error) {
      this.memories = [];
    }
  }

  private async save(): Promise<void> {
    await this.storage.writeJson('memories/longterm.json', {
      memories: this.memories
    });
  }
}
```

---

### 4.4 MemoryRetrieval（记忆检索）

**职责**：提供记忆检索功能

**文件位置**：`core/memory_system/MemoryRetrieval.ts`

```typescript
import { LongTermMemory } from './LongTermMemory';
import { SearchQuery, SearchResult, RetrievalOptions } from './types/retrieval';
import { Memory } from './types/memory';

export class MemoryRetrieval {
  constructor(private longTerm: LongTermMemory) {}

  async search(
    query: SearchQuery,
    options?: RetrievalOptions
  ): Promise<SearchResult[]> {
    const {
      type,
      agentId,
      tags,
      minImportance,
      timeRange,
      limit = 10,
      useEmbedding = false,
      timeWeight = 0.3,
      importanceWeight = 0.4
    } = options || {};

    // 获取候选记忆
    let candidates: Memory[];
    
    if (agentId) {
      candidates = await this.longTerm.getByAgent(agentId);
    } else {
      candidates = await this.longTerm.getByType(type || 'conversation');
    }

    if (type) {
      candidates = candidates.filter(m => m.type === type);
    }

    if (tags && tags.length > 0) {
      candidates = candidates.filter(m =>
        tags.some(tag => m.tags.includes(tag))
      );
    }

    if (minImportance) {
      candidates = candidates.filter(m => m.importance >= minImportance);
    }

    if (timeRange) {
      candidates = candidates.filter(m =>
        m.createdAt >= timeRange.start && m.createdAt <= timeRange.end
      );
    }

    // 计算相关度分数
    const results: SearchResult[] = candidates.map(memory => {
      const relevance = this.calculateRelevance(
        memory,
        query.query,
        timeWeight,
        importanceWeight
      );

      return { memory, relevance };
    });

    // 按相关度排序
    results.sort((a, b) => b.relevance - a.relevance);

    return results.slice(0, limit);
  }

  private calculateRelevance(
    memory: Memory,
    query: string,
    timeWeight: number,
    importanceWeight: number
  ): number {
    // 关键词匹配分数
    const keywordScore = this.calculateKeywordScore(memory.content, query);

    // 时间分数（最近的记忆分数更高）
    const now = Date.now();
    const ageInDays = (now - memory.createdAt) / (24 * 60 * 60 * 1000);
    const timeScore = Math.max(0, 1 - ageInDays / 365); // 1年内的记忆有分数

    // 重要性分数
    const importanceScore = memory.importance / 10;

    // 访问频率分数
    const accessScore = Math.min(1, memory.accessCount / 10);

    // 综合分数
    const relevance =
      keywordScore * 0.4 +
      timeScore * timeWeight +
      importanceScore * importanceWeight +
      accessScore * 0.1;

    return Math.min(1, Math.max(0, relevance));
  }

  private calculateKeywordScore(content: string, query: string): number {
    const contentLower = content.toLowerCase();
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);

    let matchCount = 0;
    for (const word of queryWords) {
      if (contentLower.includes(word)) {
        matchCount++;
      }
    }

    return matchCount / queryWords.length;
  }
}
```

---

## 5. HTTP API路由

### 5.1 记忆管理路由

**文件位置**：`core/agent_engine/routes/memories.ts`

**端点**：
- `GET /api/memories/:agentId` - 获取Agent的所有长期记忆
- `POST /api/memories` - 添加长期记忆
- `GET /api/memories/:agentId/:memoryId` - 获取单个记忆
- `PUT /api/memories/:memoryId` - 更新记忆
- `DELETE /api/memories/:memoryId` - 删除记忆
- `POST /api/memories/search` - 搜索记忆

**请求示例**：
```typescript
// POST /api/memories
{
  "type": "preference",
  "content": "用户喜欢简洁的回答",
  "importance": 8,
  "tags": ["preference", "style"],
  "agentId": "agt_abc123"
}

// POST /api/memories/search
{
  "query": "用户偏好",
  "type": "preference",
  "agentId": "agt_abc123",
  "limit": 10
}
```

**实现代码**：
```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

export function createMemoriesRouter(
  memoryService: MemoryService
) {
  const app = new Hono();

  // GET /api/memories/:agentId
  app.get('/:agentId', async (c) => {
    const agentId = c.req.param('agentId');
    const memories = await memoryService.getByAgent(agentId);
    return c.json({ data: memories, total: memories.length });
  });

  // POST /api/memories
  app.post('/', zValidator('json', z.object({
    type: z.enum(['preference', 'knowledge', 'conversation', 'context']),
    content: z.string(),
    importance: z.number().min(1).max(10),
    tags: z.array(z.string()),
    agentId: z.string()
  })), async (c) => {
    const body = c.req.valid('json');
    const memoryId = await memoryService.addLongTermMemory(body);
    return c.json({ data: { id: memoryId } }, 201);
  });

  // POST /api/memories/search
  app.post('/search', zValidator('json', z.object({
    query: z.string(),
    type: z.enum(['preference', 'knowledge', 'conversation', 'context']).optional(),
    agentId: z.string().optional(),
    tags: z.array(z.string()).optional(),
    limit: z.number().optional()
  })), async (c) => {
    const query = c.req.valid('json');
    const results = await memoryService.searchMemories(query);
    return c.json({ data: results, total: results.length });
  });

  return app;
}
```

### 5.2 会话管理路由

**文件位置**：`core/agent_engine/routes/sessions.ts`

**端点**：
- `GET /api/sessions/:agentId` - 获取Agent的所有会话
- `GET /api/sessions/:agentId/:sessionId/messages` - 获取会话历史
- `POST /api/sessions/:sessionId/messages` - 添加消息到会话

---

## 6. 集成到Agent引擎

### 6.1 修改ChatService

**文件位置**：`core/agent_engine/ChatService.ts`

在`ChatService`中集成记忆系统：

```typescript
import { MemoryService } from '../memory_system/MemoryService';

export class ChatService {
  constructor(
    private agentService: AgentService,
    private soulService: SoulService,
    private configService: ConfigService,
    private memoryService: MemoryService
  ) {}

  async *streamChat(params: {
    agentId: string;
    userId: string;
    userMessage: string;
    history?: any[];
  }): AsyncIterable<any> {
    // 生成或获取sessionId
    const sessionId = this.getOrCreateSessionId(params.agentId, params.userId);
    
    // 1. 存储用户消息
    await this.memoryService.addMessage(
      sessionId,
      params.agentId,
      params.userId,
      'user',
      params.userMessage
    );

    // 2. 搜索相关记忆
    const relevantMemories = await this.memoryService.searchMemories({
      query: params.userMessage,
      agentId: params.agentId,
      limit: 5
    });

    // 3. 获取Agent Soul.md
    const soul = await this.soulService.parseSoul(params.agentId);
    
    // 4. 构建消息列表
    const messages: any[] = [
      { role: 'system', content: soul.systemPrompt },
      ...this.buildContext(params.history || [], relevantMemories),
      { role: 'user', content: params.userMessage }
    ];

    // 5. 调用LLM
    const llmClient = await this.configService.getLLMClient();
    let fullResponse = '';
    
    for await (const chunk of llmClient.streamChat(messages)) {
      fullResponse += chunk.content;
      yield chunk;
    }

    // 6. 存储AI响应
    await this.memoryService.addMessage(
      sessionId,
      params.agentId,
      params.userId,
      'assistant',
      fullResponse
    );
  }

  private buildContext(
    history: any[],
    memories: any[]
  ): any[] {
    // 将相关记忆转换为上下文消息
    const contextMessages: any[] = [];
    
    if (memories.length > 0) {
      const contextText = memories
        .map((r: any) => r.memory.content)
        .join('\n');
      
      contextMessages.push({
        role: 'system',
        content: `相关记忆：\n${contextText}`
      });
    }

    return [...contextMessages, ...history];
  }

  private getOrCreateSessionId(agentId: string, userId: string): string {
    // 简单实现：使用agentId和userId的组合
    return `sess_${agentId}_${userId}`;
  }
}
```

---

## 7. 性能优化

### 7.1 索引优化

- 为常用查询字段建立索引（agentId, type, tags）
- 使用内存缓存热点数据
- 延迟加载不常用的记忆

### 7.2 检索优化

- 实现缓存机制，缓存常用查询结果
- 使用倒排索引加速关键词搜索
- 预计算相似度分数

### 7.3 存储优化

- 压缩存储旧记忆
- 定期清理过期记忆
- 分片存储大量记忆

---

## 8. 依赖说明

**核心依赖**：
- `nanoid` - 生成唯一ID（已存在）
- `fuse.js` - 模糊搜索（可选，后续添加）

**新增依赖**：
- 无需额外依赖，使用现有库

---

## 9. 测试计划

### 9.1 单元测试

- `test_short_term_memory.ts` - 短期记忆测试
- `test_long_term_memory.ts` - 长期记忆测试
- `test_memory_retrieval.ts` - 记忆检索测试
- `test_memory_service.ts` - 记忆服务测试

### 9.2 集成测试

- `test_memory_integration.ts` - 记忆系统集成测试
- `test_memory_chat_integration.ts` - 记忆系统与聊天集成测试

---

**文档版本**：1.0  
**最后更新**：2026-03-28  
**状态**：开发中
