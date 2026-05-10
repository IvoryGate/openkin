# AGENTS.md — openkin v2

本文件是 `openkin` v2 仓库的入口地图。

## 当前分支

`explore/v2-from-scratch` — 从 Initial commit 开始的全新探索分支。

## 核心理念

> **Agent-Driven CI/CD**：每个代码变更都必须经过自动化验证流水线，每个分层增量都必须有明确的 contract 和验收标准。

v2 不是 v1 的修修补补，而是**从工程方法论层面重新设计整个系统**。

## 推荐阅读顺序

### 第一步：理解 v2 是什么

1. `docs/v2/00-overview.md` — v2 总览
2. `docs/v2/01-principles.md` — 设计原则
3. `docs/v2/02-cicd.md` — CI/CD 工作流

### 第二步：理解分层架构

4. `docs/v2/10-l1-core.md` — L1 Core Runtime（探索中）
5. `docs/v2/11-memory.md` — 记忆系统设计
6. `docs/v2/12-permission.md` — 权限系统设计
7. `docs/v2/20-l3-service.md` — L3 Service & Protocol
8. `docs/v2/30-l4-product.md` — L4 Engineering Product Shell
9. `docs/v2/40-l5-client.md` — L5 Client Architecture

### 第三步：理解治理规则

10. `docs/v2/90-governance.md` — 仓库治理
11. `docs/v2/91-model-modes.md` — 模型工作模式

## 当前工程原则

1. **先冻结 contract，再写实现代码**
2. **文档是记录系统，聊天不是记录系统**
3. **每个增量都必须可验证**
4. **优先做可验证的小闭环，不做难以验收的大跃进**
5. **所有新增能力都应有明确层级归属**

## 当前分层理解

```
L6: App & Orchestration        # 多 Agent、Workflow、业务应用
L5: External Surfaces          # Web、Desktop、SDK、Channel
L4: Engineering Product Shell  # CLI/TUI、完整单 Agent 产品
L3: Service & Protocol         # REST、SSE、持久化、鉴权
L2: Tool & Integration         # 工具、MCP、Skill
L1: Core Runtime               # Agent、Session、RunEngine、Context
```

## 执行计划目录

- 进行中的计划：`docs/exec-plans/active/`
- 已完成的计划：`docs/exec-plans/completed/`

## 质量与约束

- `docs/v2/90-governance.md`
- `docs/v2/91-model-modes.md`

## 当前不应该做的事

- 不要直接跳到多个 IM 平台适配
- 不要先做完整客户端 UI，再倒推 SDK
- 不要在没有共享 contract 的前提下各层各自建模
- 不要把临时讨论当作最终规则
- 不要在 L1 Core contract 冻结前写 L3/L4/L5 实现

## 当前建议的工作路径

1. 完善文档地图与执行计划目录
2. 冻结 L1 Core contract（Agent、Session、Context、MemoryPort、PermissionHook）
3. 冻结 L3 Service contract（REST API、Event Plane、Database Schema）
4. 落 L1 最小运行时闭环 + 自动化测试
5. 落 L3 最小服务闭环 + 自动化测试
6. 落 L4 最小产品壳闭环
7. 落 L5 最小客户端闭环
8. 再扩展具体能力

## dev-console 与测试

- 可执行测试放在 `apps/dev-console/tests/`
- 新增回归或审计脚本时，放在 `tests/`，不要放回 `src/`

## 文档维护要求

- 任何重大架构变更都应更新 `docs/v2/10-l1-core.md`
- 任何 SDK 边界变化都应更新 `docs/v2/40-l5-client.md`
- 任何 Service API 边界变化都应更新 `docs/v2/20-l3-service.md`
- 任何新增执行计划都应放入 `docs/exec-plans/active/`
- 默认在提交前运行 `pnpm verify`

## 低预算模式默认要求

当使用低预算或能力较弱模型时，默认必须先阅读：

- `docs/v2/91-model-modes.md`
- 当前对应的执行计划

不要依赖模型自行判断是否应该升级；必须按文档中的升级条件停止并汇报。
