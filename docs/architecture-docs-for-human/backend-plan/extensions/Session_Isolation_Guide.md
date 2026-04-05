# Session 隔离机制详解

> 本文档是 `AI_Agent_Backend_Tech_Plan.md` § 2.1.7 的补充说明文档。

---

## 1. 什么是 Session？

**Session 是上下文隔离的最小单位，可以直接理解为"一个独立的对话窗口"。**

每次用户打开新对话、或 AgentScheduler 给 Agent 分配新任务时，都会创建一个新 Session。同一个 Agent 可以同时存在多个活跃 Session，它们之间的消息历史互不可见。

### 1.1 两类 Session

| Session 类型 | 发起方 | 典型场景 |
| --- | --- | --- |
| `user_conversation` | 用户 | 用户在 UI 上点击"新建对话"，和 Agent 聊天 |
| `agent_task` | 其他 Agent | 多 Agent 协作时，Supervisor 给 Worker Agent 分配子任务 |

两类 Session 的技术实现完全一致，差异仅在于 `sessionType` 字段和业务语义。

---

## 2. 为什么需要隔离？

### 场景 1：用户同时打开多个对话窗口

```
用户开了两个对话窗口：
  Session A：和 Agent 讨论项目 A 的代码问题
  Session B：和 Agent 讨论项目 B 的数据库设计

如果不隔离：
  → Session A 正在讨论"重构 API"
  → Session B 问"刚才你说的 API 是什么"
  → Agent 会把 Session A 的上下文带入 Session B（串台）
```

### 场景 2：用户对话 + Agent 协作任务并行

```
用户正在和 Agent A 聊天（Session X）
同时，AgentScheduler 给 Agent A 分配了一个后台任务（Session Y）

如果不隔离：
  → Session X 的用户问"你在干嘛"
  → Agent 回答"我正在处理文件导入任务"（其实那是 Session Y 的任务）
  → 用户一脸懵逼
```

**结论：不同 Session 的上下文必须严格隔离，不能互相看到对方的消息。**

---

## 3. 隔离什么？不隔离什么?

### 3.1 隔离的资源（按 Session 分开）

| 资源 | 隔离粒度 | 说明 |
| --- | --- | --- |
| **上下文管理器** | 每个 Session 一个实例 | 纯内存对象，Session 销毁即释放 |
| **对话历史** | 按 `session_id` 查询 | SQLite 里不同 Session 的消息记录互不可见 |
| **TraceId** | 每次推理独立生成 | 日志里能区分不同 Session 的推理轨迹 |

### 3.2 共享的资源（按 Agent 共用）

| 资源 | 共享粒度 | 为什么要共享？ |
| --- | --- | --- |
| **长期记忆** | 按 `agent_id` 共享 | 经验是 Agent 自己的，不属于某个对话窗口。Session A 学到的经验，Session B 应该也能用 |
| **Skill / Tool** | 全局单例 | 工具本身无状态，所有 Session 共用同一个工具实例 |
| **LLM Provider** | 全局单例 | 底层 API Client 可复用，只在请求里携带不同的 messages |

**关键设计决策：隔离的是"当前对话的上下文"，共享的是"Agent 的能力和经验"。**

---

## 4. 并发模型：异步并发，不是多线程

### 4.1 Node.js 单线程事件循环

Node.js 是**单线程异步**。所有 Session 的代码都跑在同一个线程，但因为 Agent 推理大量时间都在等 I/O（等 LLM 返回、等数据库查询），Node.js 会在等待期间切换去处理其他 Session。

```
时间轴 →
Session A: [调用LLM] ----等待中---- [收到回复，继续推理]
Session B:           [调用LLM] ----等待中---- [收到回复]
Session C:                     [调用LLM] --------等待中--------

实际执行顺序（单线程）：A发请求 → B发请求 → C发请求 → A收回复 → B收回复 → C收回复
```

三个 Session 在**时间上交错执行**，但**代码层面完全不需要关心线程安全**——因为根本没有真正的并行，不会有两段代码同时修改同一块内存。

### 4.2 隔离是数据隔离，不是线程隔离

```typescript
// 伪代码示例
class SessionRegistry {
  private sessions = new Map<string, Session>()  // 所有 Session 都在这个 Map 里

  async runAgent(sessionId: string, userInput: string) {
    const session = this.sessions.get(sessionId)  // 拿到当前 Session 的独立实例
    const contextManager = session.contextManager  // 每个 Session 有自己的 ContextManager 对象
    const history = await db.query('SELECT * FROM messages WHERE session_id = ?', sessionId)
    // 查数据库时带上 session_id，天然隔离
    // ...
  }
}
```

**隔离机制：**
1. 每个 Session 创建时，实例化一个独立的 `ContextManager` 对象
2. 查数据库时带上 `WHERE session_id = ?`，查不到对方的数据
3. 不存在一个 Session 的变量被另一个 Session 意外读写的情况（只要代码写对，天然隔离）

### 4.3 什么时候才用多线程？

只有两种场景需要真正的多线程/多进程：

1. **CPU 密集型任务**（比如大规模向量计算）：开 `Worker Thread`，但 Agent 推理不属于这类
2. **代码执行沙箱**（见技术规划 § 2.3.6）：执行用户代码必须放独立进程，防止搞崩主进程

Agent 的 ReAct 循环本质是"发请求 → 等回复 → 再发"，全是 I/O，单线程异步完全够用。

---

## 5. 生命周期管理

### 5.1 Session 创建

```typescript
// 用户发起对话
POST /api/sessions
{
  "agentId": "agent_001",
  "sessionType": "user_conversation",
  "initiatorId": "user_123"
}

// 系统创建 Session，返回 sessionId
→ sessionId: "sess_abc123"
```

### 5.2 Session 运行

```typescript
// 每次用户发消息
POST /api/sessions/sess_abc123/run
{
  "userInput": "帮我写个排序算法"
}

// 后端流程：
1. 从 SessionRegistry 拿到对应的 Session 实例
2. 从 SQLite 加载该 session_id 的历史消息
3. 运行 Agent.run()，推理过程中：
   - ContextManager：该 Session 独立实例
   - ConversationHistory：只查该 session_id 的记录
   - LongTermMemory：查该 agent_id 的经验（跨 Session 共享）
4. 推理完成，新消息写回 SQLite（带上 session_id）
```

### 5.3 Session 销毁

```typescript
// 用户关闭对话窗口
DELETE /api/sessions/sess_abc123

// 系统清理：
1. 从 SessionRegistry 移除该 Session
2. 释放 ContextManager 内存（GC 自动回收）
3. SQLite 里的历史消息保留（可选：支持用户"恢复对话"）
```

---

## 6. 实现要点

### 6.1 SessionRegistry（会话注册表）

```typescript
class SessionRegistry {
  private activeSessions = new Map<string, Session>()

  create(agentId: string, sessionType: SessionType, initiatorId: string): Session {
    const session = new Session({
      id: generateId(),
      agentId,
      sessionType,
      initiatorId,
      contextManager: new ContextManager(),  // 每个 Session 独立实例
      createdAt: Date.now(),
    })
    this.activeSessions.set(session.id, session)
    return session
  }

  get(sessionId: string): Session | null {
    return this.activeSessions.get(sessionId) ?? null
  }

  destroy(sessionId: string): void {
    this.activeSessions.delete(sessionId)
    // ContextManager 自动被 GC 回收
  }
}
```

### 6.2 ConversationHistory 插件的 Session 感知

```typescript
class ConversationHistoryPlugin implements AgentLifecycleHooks {
  async onRunStart(ctx: RunContext): Promise<void> {
    // 从数据库加载该 Session 的历史
    const history = await db.query(
      'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at',
      [ctx.sessionId]  // ← 关键：带上 session_id
    )
    // 注入到上下文管理器
    ctx.contextManager.loadHistory(history)
  }

  async onRunEnd(ctx: RunContext, result: AgentResult): Promise<void> {
    // 持久化新消息
    await db.insert('messages', {
      session_id: ctx.sessionId,  // ← 关键：写入时带上 session_id
      role: 'assistant',
      content: result.output,
      created_at: Date.now(),
    })
  }
}
```

### 6.3 LongTermMemory 插件的跨 Session 共享

```typescript
class LongTermMemoryPlugin implements AgentLifecycleHooks {
  async onContextBuild(ctx: RunContext): Promise<ContextAddition | null> {
    // 检索经验时按 agent_id 查，不带 session_id
    const memories = await db.query(
      'SELECT * FROM long_term_memory WHERE agent_id = ? ORDER BY relevance DESC LIMIT 5',
      [ctx.agentId]  // ← 关键：按 agent_id，不是 session_id
    )
    return { systemPromptAddition: formatMemories(memories) }
  }

  async onRunEnd(ctx: RunContext): Promise<void> {
    // 提炼经验时也存到 agent_id 下
    const newMemory = await extractMemory(ctx)
    await db.insert('long_term_memory', {
      agent_id: ctx.agentId,  // ← 关键：属于 Agent，不属于 Session
      content: newMemory,
      created_at: Date.now(),
    })
  }
}
```

---

## 7. 常见问题

### Q1: 用户关闭对话窗口后再打开，能恢复历史吗？

可以。有两种策略：

1. **Session 保留**：用户关闭窗口时不调用 `DELETE /sessions/:id`，只是 UI 隐藏；重新打开时复用同一个 sessionId
2. **Session 重建**：用户关闭时真删除 Session，但 SQLite 里的 `messages` 表保留（软删除或归档）；重新打开时创建新 Session，从归档加载历史

推荐方案 2，因为 Session 本身是轻量对象，重建成本低，且能保证"一个 Session = 一次完整对话"的语义清晰。

### Q2: Session 过多会不会内存爆炸？

不会。关键资源 `ContextManager` 只在推理时占用内存，推理结束就清空了。一个空闲的 Session 对象本身很小（几百字节）。

如果担心，可以加 LRU 淘汰策略：超过 N 分钟无活动的 Session 自动销毁，数据库记录保留。

### Q3: 多个 Session 并发调用同一个 LLM Provider，会冲突吗？

不会。`LLMProvider` 的 `chat()` 方法本身无状态，每次调用传入的 `messages` 是独立的。底层 HTTP Client（如 `fetch`）天然支持并发请求。

### Q4: ConversationHistory 和 LongTermMemory 都在 `onRunEnd` 写数据库，会有事务冲突吗？

不会，因为写入的是不同的表（`messages` vs `long_term_memory`）。如果未来需要事务保证，可以用数据库事务包裹整个 `onRunEnd` 阶段。

---

## 8. 总结

| 核心概念 | 说明 |
| --- | --- |
| **Session 是什么** | 独立的对话窗口，上下文隔离的最小单位 |
| **隔离什么** | 上下文管理器、对话历史、TraceId |
| **不隔离什么** | 长期记忆、工具、LLM Provider |
| **并发模型** | 单线程异步（事件循环），不是多线程 |
| **隔离机制** | 数据隔离（独立对象 + SQL WHERE 子句），不是线程隔离 |
| **生命周期** | 创建 → 运行（可多次） → 销毁；SQLite 记录可选保留 |

Session 隔离的核心思想：**不同对话的上下文互不干扰，但同一 Agent 的能力和经验全局共享**。这个设计既保证了用户体验（对话不串台），又让 Agent 能从所有对话中持续学习。
