# 206 — Wave 5: L5 Web Console & SDK 升级

> **状态**：📋 待执行
> **模式**：high-capability mode 定方案 → budget mode 执行
> **父单**：200
> **前置**：205（L5 Desktop 重构）
> **分支**：`explore/v2-agent-driven-cicd`
> **目的**：升级 Web Console 和 SDK，支持 multi-surface continuity

---

## 一、目标

1. **SDK 升级**：支持 v2 新增 API（Permission、Background、Memory）
2. **Web Console 升级**：复用 L4 产品语义，新增产品面板
3. **Multi-Surface Continuity**：跨入口状态同步

---

## 二、SDK 升级

### 2.1 Client SDK 扩展

```typescript
// packages/sdk/client/src/index.ts

// 新增方法
interface TheWorldClient {
  // ... 原有方法
  
  // Background Run
  listBackgroundRuns(sessionId?: string): Promise<BackgroundRunDto[]>
  attachBackgroundRun(runId: string): Promise<ReadableStream>
  detachBackgroundRun(runId: string): Promise<void>
  resumeBackgroundRun(runId: string): Promise<void>
  interruptBackgroundRun(runId: string): Promise<void>
  
  // Permission（只读，修改需 operator）
  getPermissionConfig(): Promise<PermissionConfigDto>
}
```

### 2.2 Operator SDK 扩展

```typescript
// packages/sdk/operator-client/src/index.ts

interface OperatorClient {
  // ... 原有方法
  
  // Memory
  getMemoryLayers(sessionId: string): Promise<MemoryLayerDto[]>
  pinMemory(sessionId: string, messageId: string): Promise<void>
  unpinMemory(sessionId: string, messageId: string): Promise<void>
  searchMemory(sessionId: string, query: string): Promise<MemorySearchResultDto[]>
  
  // Permission
  setPermissionConfig(config: PermissionConfigDto): Promise<void>
  
  // Background
  listBackgroundRuns(sessionId?: string): Promise<BackgroundRunDto[]>
  attachBackgroundRun(runId: string): Promise<ReadableStream>
  detachBackgroundRun(runId: string): Promise<void>
  resumeBackgroundRun(runId: string): Promise<void>
  interruptBackgroundRun(runId: string): Promise<void>
  
  // Approval Events
  subscribeApprovalEvents(callback: (event: ApprovalEventDto) => void): Promise<() => void>
  
  // Background Events
  subscribeBackgroundRunEvents(callback: (event: BackgroundRunEventDto) => void): Promise<() => void>
}
```

---

## 三、Web Console 升级

### 3.1 新增面板

```
Web Console
├── Chat                    # 已有
├── Sessions                # 已有
├── Tasks                   # 已有
├── Logs                    # 已有
├── NEW: Context            # 上下文工程面板
├── NEW: Memory             # 记忆面板
├── NEW: Approvals          # 审批面板
├── NEW: Background Runs    # 后台运行面板
└── Settings                # 已有 + 权限配置
```

### 3.2 Context Panel

- 显示当前会话的 ContextBuildReport
- 可视化 ContextBlock 分布
- 显示压缩历史

### 3.3 Memory Panel

- 显示记忆分层（Working/Summary/Long-term）
- 支持搜索记忆
- 支持手动触发摘要

### 3.4 Approvals Panel

- 显示待审批列表
- 支持 Approve/Deny/Cancel
- 显示审批历史
- 支持修改 Permission Mode

### 3.5 Background Runs Panel

- 显示后台 run 列表
- 支持 Attach/Resume/Interrupt
- 实时状态更新（SSE）

---

## 四、Multi-Surface Continuity

### 4.1 设计目标

- 同一个 session，在 CLI / Desktop / Web 中看到一致的状态
- 审批状态跨入口同步
- 后台 run 可在任意入口 attach

### 4.2 实现方式

```typescript
// 通过 SSE Event Plane 实现跨入口同步

// 1. 所有入口订阅相同的事件流
const eventSource = new EventSource('/v1/events')

eventSource.addEventListener('approval', (e) => {
  const event = JSON.parse(e.data)
  // 更新本地审批状态
})

eventSource.addEventListener('background_run', (e) => {
  const event = JSON.parse(e.data)
  // 更新本地后台 run 状态
})

eventSource.addEventListener('memory', (e) => {
  const event = JSON.parse(e.data)
  // 更新本地记忆状态
})
```

---

## 五、验收标准

- [ ] SDK 新增方法有完整类型定义
- [ ] SDK 测试通过
- [ ] Web Console 新增面板功能正常
- [ ] 跨入口状态同步正常
- [ ] `pnpm test:sdk` 通过
- [ ] `pnpm verify` 通过

---

## 六、不做什么

1. 不改 L1 Core 代码
2. 不改 L3 Service 代码（只调用已有 API）
3. 不改 L4 CLI 代码
4. 不改 Desktop 代码（Wave 4 已完成）

---

## 七、升级条件

- 需要修改 L1/L3 的已有接口
- SDK 设计不满足 Web Console 需求
- 连续两轮 `pnpm verify` 失败
