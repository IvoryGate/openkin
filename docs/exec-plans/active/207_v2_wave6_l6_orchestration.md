# 207 — Wave 6: L6 App & Orchestration 启动

> **状态**：📋 待规划
> **模式**：high-capability mode
> **父单**：200
> **前置**：206（L5 Web & SDK 升级）
> **分支**：`explore/v2-agent-driven-cicd`
> **目的**：在 L4/L5 稳定基础上，启动 L6 高层编排

---

## 一、目标

1. **Plan / Review / Execute**：面向编排的计划工作流
2. **Team / Subagent**：多 Agent 协作
3. **Workflow**：规则驱动的自动化流程

---

## 二、设计原则

1. **不污染底层 contract**：L6 只组合 L1-L5 的能力，不修改核心运行时
2. **Artifact-first**：plan、team、workflow 都是可持久化的产品对象
3. **Observable**：所有编排状态可观测、可审计

---

## 三、对象设计

### 3.1 Plan

```typescript
interface Plan {
  id: string
  sessionId: string
  status: 'draft' | 'reviewing' | 'approved' | 'executing' | 'completed' | 'failed'
  steps: PlanStep[]
  createdAt: number
  updatedAt: number
}

interface PlanStep {
  id: string
  description: string
  tool?: string
  dependencies: string[]  // 依赖的其他 step id
  status: 'pending' | 'ready' | 'running' | 'completed' | 'failed'
}
```

### 3.2 Team

```typescript
interface Team {
  id: string
  name: string
  lead: AgentDefinition
  teammates: AgentDefinition[]
  sharedContext: Message[]
  taskBoard: Task[]
}

interface Task {
  id: string
  assignee: string  // agent id
  description: string
  status: 'todo' | 'in_progress' | 'review' | 'done'
}
```

### 3.3 Workflow

```typescript
interface Workflow {
  id: string
  name: string
  trigger: 'manual' | 'schedule' | 'event'
  steps: WorkflowStep[]
  status: 'active' | 'paused' | 'completed'
}

interface WorkflowStep {
  id: string
  type: 'run' | 'approve' | 'notify' | 'wait'
  config: Record<string, unknown>
  next: string[]  // 下一步 step id
}
```

---

## 四、与 L4/L5 的关系

```
L4 Product Shell
  ├── single-agent workflow (plan/review/execute)
  └── background / resume

L5 External Surfaces
  ├── Desktop / Web / SDK
  └── multi-surface continuity

L6 Orchestration
  ├── multi-agent plan
  ├── team / subagent
  └── workflow / business app
```

L6 建立在 L4/L5 之上：
- 使用 L4 的 single-agent 能力作为基础单元
- 使用 L5 的 multi-surface 能力作为入口
- 新增编排层，不修改底层

---

## 五、验收标准

- [ ] Plan 可创建/编辑/审批/执行
- [ ] Team 可创建/管理/分配任务
- [ ] Workflow 可定义/触发/监控
- [ ] 编排状态可观测
- [ ] 审计日志完整

---

## 六、不做什么（当前阶段）

1. 不改 L1-L5 的任何代码
2. 不实现分布式编排（单进程内）
3. 不实现自动 agent 发现/注册

---

## 七、后续规划

Wave 6 的具体执行计划将在 L4/L5 完成后制定。
