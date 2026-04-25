# L6 Orchestration And App Capabilities

## 目标

本文件用于记录 `L6 App And Orchestration` 必须显式设计、但尚未拆成具体工单的能力清单。

这一层不再负责单 agent 本地产品闭环，而是负责：

- multi-agent
- orchestration
- workflow
- business / scenario apps

## 为什么需要单独登记

如果没有这一层的能力登记，系统很容易出现两种偏差：

1. 在第四层、第五层还没稳住时，提前把多 agent 能力做成“看起来很强”的 demo
2. 把本应属于高层编排的对象，提前压回 service / shell / SDK 层

因此第六层必须先记录“将来要长出来的对象”，再决定实现顺序。

## A. Multi-Agent Core Objects

### A1. Subagent

必须设计：

- parent / child relationship
- isolated context
- lifecycle
- result handoff
- cancellation and failure semantics

### A2. Team

必须设计：

- lead / coordinator
- members
- shared goal
- shared board
- member state
- aggregated result

### A3. Orchestrator

必须设计：

- routing policy
- planner / executor separation
- provider / agent / tool selection
- escalation / retry / fallback strategy

## B. Workflow Capabilities

### B1. Plan / Review / Execute As Orchestration

必须把它从单 agent 工作手势提升为正式编排对象：

- plan artifact
- review artifact
- approval / revise flow
- execution graph
- recovery flow

### B2. Workflow Run

必须设计：

- workflow identity
- phases
- step graph
- artifacts
- approvals
- retries
- observability

### B3. Goal Loop

必须设计：

- long-running goal
- periodic re-check
- stop / pause / resume
- operator intervention
- auditability

## C. Team Observability And Control

### C1. Team State

必须支持：

- member state
- team progress
- blocker state
- approval bottleneck visibility
- aggregated logs / traces / runs

### C2. Team Control Surface

必须支持：

- assign / reassign
- pause / resume member
- inspect subagent
- stop / retry workflow node
- coordinator override

## D. App / Scenario Layer

第六层最终不仅是“更复杂的 agent 编排”，还应该能长出面向场景的产品。

### D1. Scenario App

必须设计：

- app identity
- scenario-specific workflows
- specialized prompts / policies / memory composition
- app-level onboarding
- app-level observability

### D2. Business Workflow

必须设计：

- rules
- approvals
- notifications
- role handoff
- artifact lifecycle

## E. Worktree / Artifact / Handoff

如果后续进入 coding-agent / operator-agent 阶段，第六层必须进一步承接：

- worktree ownership
- branch / artifact isolation
- review boundary
- merge / PR / handoff boundary
- post-run artifact management

## F. Cross-Surface Orchestration Continuity

第六层还需要考虑：

- 一个 workflow 是否可在多个入口被观察
- 一个 team 是否可跨 CLI / Desktop / Web 查看
- approval / pause / resume 是否可跨 surface 执行
- orchestration audit 是否统一

## G. Multimodal Orchestration

如果多模态基础能力成立，第六层最终还需要考虑：

- multimodal workflow steps
- image / file / audio aware subagents
- multimodal artifact pipeline
- multimodal review flow

## H. 当前优先级判断

建议顺序：

1. 先冻结对象，不急于大实现
2. 先做 plan / review / execute 的高层对象
3. 再做 subagent / team / coordinator
4. 最后再做 business apps / scenario apps

## 当前结论

第六层后续要做的，不应继续只用“multi-agent / workflow”几个抽象词概括。

它至少已经可以被拆成这些待实现能力簇：

- subagent
- team
- orchestrator
- workflow run
- goal loop
- team observability / control
- scenario / business apps
- worktree / artifact / handoff
- cross-surface orchestration continuity
- multimodal orchestration

这些都应先被记录，再拆工单。
