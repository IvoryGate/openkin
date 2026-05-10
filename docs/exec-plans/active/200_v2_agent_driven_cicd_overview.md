# 200 — v2 Agent-Driven CI/CD 全栈重构总纲

> **状态**：📋 规划中
> **模式**：high-capability mode
> **分支**：`explore/v2-agent-driven-cicd`
> **目的**：从 Initial commit 的精神出发，以 CI/CD 工程流水线方法论，彻底重构 openkin 全栈架构

---

## 一、为什么需要 v2

当前仓库（v1）经过 120 个提交、28 个分支的探索，已经验证了以下核心 contract：

- L1 Core Runtime：ReAct loop、ContextBlock、Tool Runtime、Hook 系统
- L3 Service：REST + SSE、SQLite 持久化、Agent CRUD、定时任务
- L3 Substrate：Run lifecycle、Event plane、Approval DTO、Context descriptors

但 v1 的架构存在根本性不足：

1. **记忆系统只有空壳**：`InMemoryMemoryPort` 是进程内 Map，无持久化、无召回、无分层
2. **权限管理不拦截**：093 审批是内存状态，工具执行前不自动 gate
3. **L4 产品面未完成**：设计文档冻结（099-106），但代码远未闭环
4. **L5 Desktop 是单体**：5438 行 app.js，contract 漂移，废弃代码冗余
5. **无 CI/CD**：`pnpm verify` 只能本地手动运行，无自动化流水线

v2 不是修修补补，而是**从工程方法论层面升级**：把 CI/CD 思想内嵌到仓库结构中，让每个分层增量都可验证、可回滚、可追踪。

---

## 二、v2 核心理念

### 2.1 Agent-Driven Development

> 仓库本身 = 产品
> 文档 = 需求规格
> 执行计划 = 工单系统
> 验证脚本 = CI 流水线
> 分层 contract = 接口契约

### 2.2 CI/CD 内嵌

```
每次代码变更
  → 自动 lint
  → 自动类型检查
  → 自动构建
  → 自动分层测试
  → 自动集成验证
  → 自动文档一致性检查
```

### 2.3 Contract-First

每层实现前必须先冻结 contract：

1. 设计文档（high-capability）
2. 接口冻结（DTO、路由、事件 schema）
3. 验收标准（测试脚本、断言）
4. 代码实现（budget mode）
5. CI 验证（自动化）

---

## 三、v2 架构升级矩阵

| 维度 | v1 状态 | v2 目标 |
|------|---------|---------|
| **L1 记忆** | `InMemoryMemoryPort`（Map） | 分层记忆：工作记忆 + 摘要记忆 + 长期记忆，SQLite 持久化 |
| **L1 权限** | Hook 有 `beforeToolCall`，但无审批 gate | Permission Mode + 自动审批拦截 + 风险分类强制检查 |
| **L1 Context** | `TrimCompressionPolicy`（尾部丢弃） | 可插拔策略：Trim/Summarize/Selective |
| **L3 审批** | 内存状态，重启丢失 | SQLite 持久化，跨 session 可见 |
| **L3 Background** | 声明式字段 | Background Registry + Attach/Resume 系统 |
| **L4 产品壳** | CLI/TUI 基础命令 | 完整产品面：context/memory/approval/background 闭环 |
| **L5 Desktop** | 5438 行单体 | 模块化，复用 L4 语义 |
| **CI/CD** | 手动 `pnpm verify` | GitHub Actions + 分层并行测试 |

---

## 四、v2 目录结构

```text
openkin/
├── .github/workflows/          # CI/CD 流水线
├── packages/
│   ├── core/                   # L1: Core Runtime（升级）
│   │   ├── src/
│   │   │   ├── runtime/        # Agent, Session, RunEngine
│   │   │   ├── context/        # ContextManager, CompressionPolicy
│   │   │   ├── memory/         # NEW: 分层记忆系统
│   │   │   ├── permission/     # NEW: 权限与审批钩子
│   │   │   ├── tools/          # 工具运行时
│   │   │   └── llm/            # LLM Provider
│   │   └── tests/              # 单元测试 + 场景测试
│   ├── shared/contracts/       # 共享 DTO
│   ├── server/                 # L3: Service（升级）
│   │   ├── src/
│   │   │   ├── api/            # REST 路由
│   │   │   ├── db/             # SQLite + 迁移
│   │   │   ├── events/         # SSE / Event Plane
│   │   │   ├── auth/           # 鉴权
│   │   │   └── scheduler/      # 定时任务
│   │   └── tests/
│   ├── sdk/client/             # 客户端 SDK
│   ├── sdk/operator-client/    # 运维 SDK
│   ├── channel-core/           # L5: Channel Framework
│   └── cli/                    # L4: Terminal Product Shell（重构）
│       ├── src/
│       │   ├── shell/          # CLI/TUI 壳层
│       │   ├── product/        # 产品面实现
│       │   │   ├── context/
│       │   │   ├── memory/
│       │   │   ├── approval/
│       │   │   └── background/
│       │   └── commands/
│       └── tests/
├── apps/
│   ├── desktop/                # L5: Desktop（重构）
│   │   ├── src/                # Electron 主进程
│   │   └── renderer/           # 渲染进程（模块化）
│   └── web-console/            # Web 管理台
├── scripts/
│   ├── ci/                     # CI 脚本
│   ├── verify/                 # 分层验证
│   └── deploy/                 # 部署脚本
├── docs/
│   ├── architecture/           # 架构文档
│   ├── exec-plans/             # 执行计划
│   └── governance/             # 治理规则
└── workspace/                  # 运行时工作区
```

---

## 五、分层实施路线图

| 波次 | 编号 | 范围 | 目标 | 预估 |
|------|------|------|------|------|
| **Wave 0** | 200-209 | CI/CD 骨架 + 仓库治理 | GitHub Actions、分层验证、文档结构 | 3-5 天 |
| **Wave 1** | 210-219 | L1 Core 升级 | MemoryPort 持久化、Permission Hook、Context 策略 | 5-7 天 |
| **Wave 2** | 220-229 | L3 Service 升级 | 审批持久化、Permission Mode API、Background Registry | 5-7 天 |
| **Wave 3** | 230-239 | L4 Product Shell | Context/Memory/Approval/Background 产品面 | 7-10 天 |
| **Wave 4** | 240-249 | L5 Desktop 重构 | 模块化架构，复用 L4 语义 | 7-10 天 |
| **Wave 5** | 250-259 | L5 Web/SDK 升级 | Multi-surface continuity、Channel Access | 5-7 天 |
| **Wave 6** | 260+ | L6 Orchestration | Team/Workflow/Plan 高层编排 | 后续规划 |

---

## 六、与 v1 的关系

| v1 资产 | v2 处理方式 |
|---------|------------|
| L1 Core contract | 保留并扩展（MemoryPort、Permission Hook） |
| L3 Service API | 保留并扩展（审批持久化、Background API） |
| Shared Contracts | 保留并版本化 |
| SDK | 保留并扩展 |
| CLI/TUI 代码 | 重构到 `cli/src/product/` 结构 |
| Desktop renderer | 彻底重构（模块化） |
| 文档 | 迁移到 `docs/architecture/` 新结构 |
| 执行计划 | 归档 v1，新建 v2 系列 |

---

## 七、验收标准

### 7.1 Wave 0 验收

- [ ] GitHub Actions CI 流水线运行通过
- [ ] 每次 PR 自动触发 lint + build + 分层测试
- [ ] 文档结构符合 v2 规范
- [ ] `pnpm verify` 在 CI 中通过

### 7.2 Wave 1-2 验收

- [ ] `MemoryPort` 有 SQLite 持久化实现
- [ ] 工具执行前自动检查 risk class
- [ ] 审批记录持久化，重启不丢失
- [ ] `pnpm test:memory` 通过
- [ ] `pnpm test:permission` 通过

### 7.3 Wave 3 验收

- [ ] `theworld inspect context` 显示完整上下文工程报告
- [ ] `theworld inspect memory` 显示真实记忆内容（非静态 taxonomy）
- [ ] `theworld inspect approvals` 可查看/操作持久化审批
- [ ] `theworld sessions resume` 可 attach/detach background run

### 7.4 Wave 4 验收

- [ ] Desktop 启动后所有功能正常
- [ ] `app.js` 已删除，模块化架构运行正常
- [ ] Desktop 复用 L4 产品语义（context/memory/approval）

---

## 八、风险与应对

| 风险 | 严重度 | 应对 |
|------|--------|------|
| 重构周期过长 | 🔴 高 | 按 Wave 拆分，每 Wave 可独立验收 |
| v1 代码废弃过多 | 🔴 高 | 保留 v1 分支（`feat/l5-client-surface`），v2 独立演进 |
| CI/CD 配置复杂 | 🟡 中 | 从最小流水线开始，逐步扩展 |
| 弱模型无法维护 | 🟡 中 | 模块接口统一，文档清晰，contract 冻结 |
| 用户中途改需求 | 🟢 低 | 每 Wave 有明确交付物，可随时暂停 |

---

## 九、立即开始

下一步：执行 **Wave 0 — CI/CD 骨架与仓库治理**（201）。
