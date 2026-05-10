# 203 — Wave 2: L3 Service & Protocol 升级

> **状态**：📋 待执行
> **模式**：high-capability mode 定方案 → budget mode 执行
> **父单**：200
> **前置**：202（L1 Core 升级）
> **分支**：`explore/v2-agent-driven-cicd`
> **目的**：升级 L3 Service 层，支持持久化审批、Permission Mode API、Background Registry

---

## 一、目标

1. **审批持久化**：从内存状态迁移到 SQLite
2. **Permission Mode API**：新增配置接口
3. **Background Run Registry**：后台运行管理
4. **Event Plane 扩展**：审批事件、后台事件

---

## 二、API 扩展

### 2.1 审批 API（升级）

```typescript
// 从内存实现升级到 SQLite 持久化
// 路由保持不变，实现替换

POST /v1/approvals        // 创建审批（现在持久化）
GET /v1/approvals         // 列表（现在跨 session 可查）
GET /v1/approvals/:id     // 详情
POST /v1/approvals/:id/approve  // 批准
POST /v1/approvals/:id/deny     // 拒绝
POST /v1/approvals/:id/cancel   // 取消
GET /v1/approvals/events        // SSE（现在包含持久化审批的变更）
```

### 2.2 Permission Mode API（新增）

```typescript
// 新增 Operator Surface
GET /v1/permissions/config      // 获取当前权限配置
PUT /v1/permissions/config      // 更新权限配置

interface PermissionConfigDto {
  mode: 'auto' | 'confirm' | 'deny'
  defaultRiskThreshold: RiskClassDto
  toolOverrides: Record<string, 'auto' | 'confirm' | 'deny'>
}
```

### 2.3 Background Run API（新增）

```typescript
// 新增 Client + Operator Surface
GET /v1/background-runs         // 列表
GET /v1/background-runs/:id     // 详情
POST /v1/background-runs/:id/attach    // 附着到前台
POST /v1/background-runs/:id/detach    // 分离到后台
POST /v1/background-runs/:id/resume    // 恢复
POST /v1/background-runs/:id/interrupt // 中断
GET /v1/background-runs/events         // SSE

interface BackgroundRunDto {
  id: string
  sessionId: string
  agentId: string
  status: 'running' | 'paused' | 'awaiting_approval' | 'completed' | 'failed'
  startedAt: number
  lastActivityAt: number
  currentStepIndex: number
}
```

### 2.4 Run API 扩展

```typescript
// POST /v1/runs 请求体扩展
interface CreateRunRequest {
  // ... 原有字段
  executionMode?: 'foreground' | 'background'  // 现在真正生效
  permissionConfig?: PermissionConfigDto       // 单次 run 的权限覆盖
}
```

---

## 三、Event Plane 扩展

```typescript
// 新增事件类型
interface ApprovalEventDto {
  type: 'approval_requested' | 'approval_resolved'
  approvalId: string
  sessionId: string
  runId: string
  toolName: string
  riskClass: RiskClassDto
  status: ApprovalStatusDto
  timestamp: number
}

interface BackgroundRunEventDto {
  type: 'background_run_started' | 'background_run_updated' | 'background_run_ended'
  runId: string
  sessionId: string
  status: BackgroundRunDto['status']
  timestamp: number
}
```

---

## 四、实现要点

### 4.1 审批持久化

```typescript
// server/src/db/approval-repository.ts
class ApprovalRepository {
  constructor(private db: Database) {}
  
  async create(record: ApprovalRecordDto): Promise<void> {
    this.db.prepare(`
      INSERT INTO approvals (id, session_id, run_id, tool_name, risk_class, status, requested_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(...)
  }
  
  async resolve(id: string, resolution: 'approved' | 'denied' | 'cancelled', resolvedBy: string, reason?: string): Promise<void> {
    this.db.prepare(`
      UPDATE approvals SET status = ?, resolved_at = ?, resolved_by = ?, reason = ?
      WHERE id = ?
    `).run(...)
  }
  
  async listBySession(sessionId: string): Promise<ApprovalRecordDto[]> {
    return this.db.prepare('SELECT * FROM approvals WHERE session_id = ? ORDER BY requested_at DESC').all(sessionId)
  }
  
  async listPending(): Promise<ApprovalRecordDto[]> {
    return this.db.prepare('SELECT * FROM approvals WHERE status = ? ORDER BY requested_at DESC').all('pending')
  }
}
```

### 4.2 Background Run Registry

```typescript
// server/src/background-run-registry.ts
class BackgroundRunRegistry {
  private runs = new Map<string, BackgroundRun>()
  
  async register(runId: string, sessionId: string, agentId: string): Promise<void> {
    // 写入 SQLite
    // 启动后台监控
  }
  
  async attach(runId: string): Promise<Stream> {
    // 返回 SSE stream
  }
  
  async detach(runId: string): Promise<void> {
    // 标记为后台运行
  }
  
  async resume(runId: string): Promise<void> {
    // 恢复被暂停/审批阻塞的 run
  }
  
  async interrupt(runId: string): Promise<void> {
    // 发送 abort signal
  }
}
```

---

## 五、验收标准

- [ ] 审批 API 使用 SQLite 持久化
- [ ] `GET /v1/approvals` 返回跨 session 的审批列表
- [ ] `GET /v1/permissions/config` 可读写权限配置
- [ ] `POST /v1/runs` 支持 `executionMode: 'background'`
- [ ] Background Run Registry 可注册/attach/detach/resume/interrupt
- [ ] 审批事件 SSE 正常工作
- [ ] `pnpm test:approval` 通过（更新为持久化验证）
- [ ] `pnpm test:background` 新增并通过
- [ ] `pnpm verify` 通过

---

## 六、不做什么

1. 不改 L1 Core 的已有接口（只消费 L1 新增能力）
2. 不改 L4 CLI（Wave 3 再做）
3. 不改 L5 Desktop（Wave 4 再做）
4. 不实现分布式 background run（单进程内实现）

---

## 七、升级条件

- 需要修改 L1 的已有接口
- 需要修改 shared contracts 的已有 DTO
- 连续两轮 `pnpm verify` 失败
