# 202 — Wave 1: L1 Core Runtime 升级

> **状态**：📋 待执行
> **模式**：high-capability mode 定方案 → budget mode 执行
> **父单**：200
> **前置**：201（CI/CD 骨架）
> **分支**：`explore/v2-agent-driven-cicd`
> **目的**：升级 L1 Core Runtime，解决记忆系统和权限管理的根本不足

---

## 一、目标

1. **记忆系统升级**：从 `InMemoryMemoryPort` 升级到分层记忆系统
2. **权限系统升级**：从被动 Hook 升级到主动 Permission Gate
3. **Context 策略升级**：从单一 Trim 升级到可插拔策略

---

## 二、当前问题诊断

### 2.1 记忆系统

```typescript
// v1: 只有 InMemoryMemoryPort
class InMemoryMemoryPort implements MemoryPort {
  private readonly store = new Map<string, Message[]>()
  // 进程重启丢失
  // 无分层
  // 无召回策略
}
```

### 2.2 权限系统

```typescript
// v1: Hook 有 beforeToolCall，但无审批 gate
interface AgentLifecycleHook {
  onBeforeToolCall?(ctx: HookContext, call: ToolCall): Promise<GuardResult<ToolCall>> | GuardResult<ToolCall>
  // 返回 GuardResult，但 core 不强制检查 RiskClass
}
```

### 2.3 Context 压缩

```typescript
// v1: 只有 TrimCompressionPolicy
class TrimCompressionPolicy implements CompressionPolicy {
  fit(blocks: ContextBlock[], budget: CompressionBudget): ContextBlock[] {
    // 只能从尾部丢弃 history 块
  }
}
```

---

## 三、v2 设计方案

### 3.1 分层记忆系统

```typescript
// memory/types.ts
interface MemoryLayer {
  kind: 'working' | 'summary' | 'long_term'
  sourceKind: 'session' | 'workspace' | 'persona' | 'skill'
  messages: Message[]
  metadata: {
    createdAt: number
    updatedAt: number
    summaryOf?: string[] // 指向被摘要的消息 ID
  }
}

interface MemoryStore {
  read(request: MemoryReadRequest): Promise<MemoryLayer[]>
  write(request: MemoryWriteRequest): Promise<void>
  summarize(sessionId: string, messageIds: string[]): Promise<MemoryLayer>
  pin(sessionId: string, messageId: string): Promise<void>
  unpin(sessionId: string, messageId: string): Promise<void>
}

// memory/sqlite-memory-store.ts
class SQLiteMemoryStore implements MemoryStore {
  // 持久化到 SQLite
  // 支持分层查询
  // 支持召回策略
}

// memory/recall-strategies.ts
interface RecallStrategy {
  recall(query: MemoryReadRequest, layers: MemoryLayer[]): Promise<Message[]>
}

class RecentRecallStrategy implements RecallStrategy {
  // 按时间召回最近的记忆
}

class SemanticRecallStrategy implements RecallStrategy {
  // 按语义相关性召回（预留，v2 首期可用简单关键词匹配）
}
```

### 3.2 权限系统

```typescript
// permission/types.ts
interface PermissionConfig {
  mode: 'auto' | 'confirm' | 'deny'
  defaultRiskThreshold: RiskClassDto
  toolOverrides: Record<string, PermissionMode>
}

interface PermissionGate {
  check(call: ToolCall, config: PermissionConfig): Promise<PermissionCheckResult>
}

interface PermissionCheckResult {
  action: 'allow' | 'block' | 'request_approval'
  reason?: string
  approvalRecord?: ApprovalRecordDto
}

// permission/gate.ts
class DefaultPermissionGate implements PermissionGate {
  async check(call: ToolCall, config: PermissionConfig): Promise<PermissionCheckResult> {
    const riskClass = await this.getToolRiskClass(call.name)
    
    if (config.mode === 'deny') {
      return { action: 'block', reason: 'Permission mode is deny' }
    }
    
    if (config.mode === 'auto' && riskClass !== 'destructive') {
      return { action: 'allow' }
    }
    
    // confirm mode 或高风险工具 → 请求审批
    const approval = await this.createApprovalRecord(call, riskClass)
    return { action: 'request_approval', approvalRecord: approval }
  }
}

// 在 RunEngine 中集成
class ReActRunEngine implements RunEngine {
  async run(args: RunArgs): Promise<AgentResult> {
    // ...
    for (const originalCall of response.toolCalls) {
      // v2 新增：权限检查
      const permission = await this.permissionGate.check(originalCall, args.permissionConfig)
      if (permission.action === 'block') {
        throw createRunError('RUN_PERMISSION_DENIED', permission.reason!, 'permission')
      }
      if (permission.action === 'request_approval') {
        // 暂停 run，等待审批
        state.status = 'awaiting_approval'
        state.approvalId = permission.approvalRecord!.id
        return await this.finish(args.runtime, state)
      }
      
      const toolCall = await args.runtime.hookRunner.beforeToolCall(state, originalCall)
      // ...
    }
  }
}
```

### 3.3 Context 压缩策略扩展

```typescript
// context/compression.ts
interface CompressionPolicy {
  fit(blocks: ContextBlock[], budget: CompressionBudget): Promise<ContextBlock[]>
}

class TrimCompressionPolicy implements CompressionPolicy {
  // v1 的原有实现
}

class SummarizeCompressionPolicy implements CompressionPolicy {
  // 对可压缩块进行摘要，而不是丢弃
  async fit(blocks: ContextBlock[], budget: CompressionBudget): Promise<ContextBlock[]> {
    // 1. 保留不可压缩块
    // 2. 对 history 块进行摘要
    // 3. 如果仍然超出预算，选择性丢弃
  }
}

class SelectiveCompressionPolicy implements CompressionPolicy {
  // 根据消息重要性选择性保留
  async fit(blocks: ContextBlock[], budget: CompressionBudget): Promise<ContextBlock[]> {
    // 1. 评分每条消息的重要性
    // 2. 按重要性排序
    // 3. 在预算内保留最重要的消息
  }
}
```

---

## 四、数据库迁移

### 4.1 新增表

```sql
-- memories 表
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('working', 'summary', 'long_term')),
  source_kind TEXT NOT NULL CHECK(source_kind IN ('session', 'workspace', 'persona', 'skill')),
  content TEXT NOT NULL, -- JSON 序列化的 Message[]
  metadata TEXT NOT NULL, -- JSON
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_memories_session ON memories(session_id);
CREATE INDEX idx_memories_kind ON memories(kind);

-- approvals 表（持久化）
CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  risk_class TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'denied', 'expired', 'cancelled')),
  requested_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolved_by TEXT,
  reason TEXT,
  metadata TEXT -- JSON
);

CREATE INDEX idx_approvals_session ON approvals(session_id);
CREATE INDEX idx_approvals_status ON approvals(status);
CREATE INDEX idx_approvals_run ON approvals(run_id);

-- background_runs 表
CREATE TABLE background_runs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  last_activity_at INTEGER NOT NULL,
  metadata TEXT -- JSON
);
```

---

## 五、验收标准

- [ ] `SQLiteMemoryStore` 实现并通过测试
- [ ] `DefaultPermissionGate` 实现并通过测试
- [ ] `SummarizeCompressionPolicy` 实现并通过测试
- [ ] 数据库迁移脚本可运行
- [ ] `pnpm test:memory` 新增并通过
- [ ] `pnpm test:permission` 新增并通过
- [ ] `pnpm verify` 通过

---

## 六、不做什么

1. 不改 L3 API 路由（只新增）
2. 不改 L4 CLI 命令（只新增底层能力）
3. 不改 L5 Desktop（Wave 4 再做）
4. 不实现向量检索（SemanticRecallStrategy 可先用关键词匹配占位）

---

## 七、升级条件

- 需要修改 shared contracts 的已有 DTO
- 需要修改 L3 的已有 API 路由
- 连续两轮 `pnpm verify` 失败
