# 204 — Wave 3: L4 Engineering Product Shell 重构

> **状态**：📋 待执行
> **模式**：high-capability mode 定方案 → budget mode 执行
> **父单**：200
> **前置**：203（L3 Service 升级）
> **分支**：`explore/v2-agent-driven-cicd`
> **目的**：重构 L4 产品壳，实现 context/memory/approval/background 完整产品面

---

## 一、目标

1. **重构 CLI 代码结构**：从平面文件到 `product/` 分层
2. **Context Engineering 产品面**：从只读观察到可交互
3. **Layered Memory 产品面**：从静态 taxonomy 到真实操作
4. **Permission & Approval 产品面**：从列表查看到自动拦截
5. **Background & Resume 产品面**：从词表到系统能力

---

## 二、代码结构重构

### 2.1 当前结构（v1）

```
packages/cli/src/
├── l4-context-view.ts          # 格式化输出
├── l4-layered-memory.ts        # 静态 taxonomy
├── l4-approval-surface.ts      # 列表格式化
├── l4-background-resume.ts     # 词表输出
├── l4-product-map.ts           # 命令映射
└── ...                         # 其他命令文件
```

### 2.2 目标结构（v2）

```
packages/cli/src/
├── shell/                      # CLI/TUI 壳层（不变）
│   ├── cli.ts
│   └── tui/
├── product/                    # 产品面实现（重构重点）
│   ├── context/
│   │   ├── engine.ts           # Context Engineering 核心
│   │   ├── formatter.ts        # 格式化输出（从 l4-context-view 迁移）
│   │   └── commands.ts         # inspect context 命令
│   ├── memory/
│   │   ├── engine.ts           # 记忆管理核心
│   │   ├── recall.ts           # 召回策略
│   │   ├── formatter.ts        # 格式化输出（从 l4-layered-memory 迁移）
│   │   └── commands.ts         # inspect memory 命令
│   ├── approval/
│   │   ├── engine.ts           # 审批管理核心
│   │   ├── gate.ts             # 本地审批 gate
│   │   ├── formatter.ts        # 格式化输出（从 l4-approval-surface 迁移）
│   │   └── commands.ts         # inspect approvals 命令
│   └── background/
│       ├── engine.ts           # Background 管理核心
│       ├── registry-client.ts  # 连接 L3 Background Registry
│       ├── formatter.ts        # 格式化输出（从 l4-background-resume 迁移）
│       └── commands.ts         # sessions runs/resume 命令
├── commands/                   # 命令映射（从 l4-product-map 迁移）
└── index.ts
```

---

## 三、产品面详细设计

### 3.1 Context Engineering

```typescript
// product/context/engine.ts
class ContextEngine {
  constructor(private operatorClient: OperatorClient) {}
  
  async getContextReport(traceId: string): Promise<ContextReport> {
    const response = await this.operatorClient.getRunContext(traceId)
    return this.enrichReport(response)
  }
  
  async getCompactSuggestion(traceId: string): Promise<CompactSuggestion> {
    // 分析上下文使用情况，给出压缩建议
    const report = await this.getContextReport(traceId)
    return {
      canCompact: report.compact.droppedBlockIds.length > 0,
      suggestion: this.generateSuggestion(report),
    }
  }
  
  private enrichReport(dto: GetRunContextResponseBody): ContextReport {
    // 添加产品面分析
  }
}

// 用户入口
// theworld inspect context <traceId>        # 完整报告
// theworld inspect context <traceId> --json # JSON 输出
// /context                                   # 本会话最近 run 的报告
```

### 3.2 Layered Memory

```typescript
// product/memory/engine.ts
class MemoryEngine {
  constructor(
    private client: TheWorldClient,
    private operatorClient: OperatorClient,
  ) {}
  
  async getMemoryLayers(sessionId: string): Promise<MemoryLayer[]> {
    // 通过 operator API 查询记忆分层
    return this.operatorClient.getMemoryLayers(sessionId)
  }
  
  async summarizeSession(sessionId: string): Promise<void> {
    // 触发会话摘要，生成 summary 记忆层
    await this.client.createSessionMessage(sessionId, {
      role: 'system',
      content: [{ type: 'text', text: '/compact' }],
    })
  }
  
  async pinMessage(sessionId: string, messageId: string): Promise<void> {
    // 固定消息到长期记忆
    await this.operatorClient.pinMemory(sessionId, messageId)
  }
  
  async searchMemory(sessionId: string, query: string): Promise<MemorySearchResult[]> {
    // 搜索记忆（关键词匹配）
    return this.operatorClient.searchMemory(sessionId, query)
  }
}

// 用户入口
// theworld inspect memory                    # 显示记忆 taxonomy + 本会话记忆概览
// theworld inspect memory <sessionId>        # 指定会话的记忆详情
// theworld inspect memory --json             # JSON 输出
// /memory                                    # 本会话最近 run 的记忆摘要
// /compact                                   # 触发压缩并生成摘要记忆
```

### 3.3 Permission & Approval

```typescript
// product/approval/engine.ts
class ApprovalEngine {
  constructor(private operatorClient: OperatorClient) {}
  
  async getPendingApprovals(sessionId?: string): Promise<ApprovalRecordDto[]> {
    const all = await this.operatorClient.listApprovals()
    return sessionId ? all.filter(a => a.sessionId === sessionId) : all
  }
  
  async resolveApproval(id: string, action: 'approve' | 'deny' | 'cancel', reason?: string): Promise<void> {
    await this.operatorClient.resolveApproval(id, action, reason)
  }
  
  async getPermissionConfig(): Promise<PermissionConfigDto> {
    return this.operatorClient.getPermissionConfig()
  }
  
  async setPermissionConfig(config: PermissionConfigDto): Promise<void> {
    await this.operatorClient.setPermissionConfig(config)
  }
  
  async watchApprovals(callback: (event: ApprovalEventDto) => void): Promise<() => void> {
    // 订阅 SSE
    return this.operatorClient.subscribeApprovalEvents(callback)
  }
}

// 用户入口
// theworld inspect approvals [--json]              # 待审批列表
// theworld inspect approval <id>                   # 单条详情
// theworld inspect approval <id> approve|deny|cancel # 操作
// theworld permissions config                      # 查看权限配置
// theworld permissions config --mode=confirm       # 修改权限模式
// /approvals                                       # 本会话审批列表
```

### 3.4 Background & Resume

```typescript
// product/background/engine.ts
class BackgroundEngine {
  constructor(private operatorClient: OperatorClient) {}
  
  async listBackgroundRuns(sessionId?: string): Promise<BackgroundRunDto[]> {
    return this.operatorClient.listBackgroundRuns(sessionId)
  }
  
  async attach(runId: string): Promise<Stream> {
    return this.operatorClient.attachBackgroundRun(runId)
  }
  
  async detach(runId: string): Promise<void> {
    await this.operatorClient.detachBackgroundRun(runId)
  }
  
  async resume(runId: string): Promise<void> {
    await this.operatorClient.resumeBackgroundRun(runId)
  }
  
  async interrupt(runId: string): Promise<void> {
    await this.operatorClient.interruptBackgroundRun(runId)
  }
}

// 用户入口
// theworld sessions runs <sessionId>               # 本会话 run 列表
// theworld sessions cancel-run <traceId>           # 取消 run
// theworld background list                         # 后台 run 列表
// theworld background attach <runId>               # 附着到前台
// theworld background resume <runId>               # 恢复
// /runs                                            # 本会话 run 列表
```

---

## 四、TUI 集成

### 4.1 Context Rail

```
[ctx·4 blocks · 2.3k/4k tokens · mem·3 layers · appr·0 pending · run·1 active]
```

### 4.2 Memory Rail

```
[mem·working:12 · summary:3 · long-term:0]
```

### 4.3 Approval Rail

```
[appr·2 pending · last: run_command (shell_command)]
```

### 4.4 Background Rail

```
[run·1 active · 1 background · 0 awaiting_approval]
```

---

## 五、验收标准

- [ ] `packages/cli/src/product/` 目录结构建立
- [ ] `theworld inspect context <traceId>` 显示完整报告
- [ ] `theworld inspect memory` 显示真实记忆内容（非静态 taxonomy）
- [ ] `theworld inspect approvals` 可查看/操作持久化审批
- [ ] `theworld permissions config` 可查看/修改权限配置
- [ ] `theworld background list` 显示后台 run 列表
- [ ] TUI rail 显示 context/memory/approval/background 状态
- [ ] `pnpm test:l4-context` 通过（更新）
- [ ] `pnpm test:l4-memory` 通过（更新）
- [ ] `pnpm test:l4-approval` 通过（更新）
- [ ] `pnpm test:l4-background` 通过（更新）
- [ ] `pnpm verify` 通过

---

## 六、不做什么

1. 不改 L1 Core 代码
2. 不改 L3 Service 代码（只调用新增 API）
3. 不改 L5 Desktop（Wave 4 再做）
4. 不实现 Web Console 的对应功能

---

## 七、升级条件

- 需要修改 L1 或 L3 的已有接口
- L3 新增 API 未按预期工作
- 连续两轮 `pnpm verify` 失败
