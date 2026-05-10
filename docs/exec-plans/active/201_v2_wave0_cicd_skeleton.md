# 201 — Wave 0: CI/CD 骨架与仓库治理

> **状态**：📋 待执行
> **模式**：high-capability mode
> **父单**：200
> **分支**：`explore/v2-agent-driven-cicd`
> **目的**：建立 v2 的 CI/CD 流水线骨架和仓库治理结构

---

## 一、目标

1. 建立 GitHub Actions CI/CD 流水线
2. 建立分层验证脚本结构
3. 建立 v2 文档目录结构
4. 建立仓库治理规则（branch protection、PR template）
5. 确保 `pnpm verify` 能在 CI 环境中运行

---

## 二、任务清单

### 2.1 GitHub Actions 流水线

创建 `.github/workflows/ci.yml`：

```yaml
name: CI

on:
  push:
    branches: [main, explore/*]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.22.0
      - run: pnpm install
      - run: pnpm lint:docs
      - run: pnpm lint:architecture
      - run: pnpm lint:workspace

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.22.0
      - run: pnpm install
      - run: pnpm check
      - run: pnpm build

  test-l1-core:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.22.0
      - run: pnpm install
      - run: pnpm test:scenarios
      - run: pnpm test:first-layer-audit

  test-l2-tools:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.22.0
      - run: pnpm install
      - run: pnpm test:tools
      - run: pnpm test:mcp
      - run: pnpm test:skills
      - run: pnpm test:self-management
      - run: pnpm test:sandbox

  test-l3-service:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.22.0
      - run: pnpm install
      - run: pnpm test:server
      - run: pnpm test:persistence
      - run: pnpm test:auth-health
      - run: pnpm test:session-message
      - run: pnpm test:observability
      - run: pnpm test:agent-config
      - run: pnpm test:scheduler
      - run: pnpm test:introspection
      - run: pnpm test:approval
      - run: pnpm test:context-descriptors
      - run: pnpm test:multimodal

  test-l4-product:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.22.0
      - run: pnpm install
      - run: pnpm test:l4-shell-map
      - run: pnpm test:l4-onboarding
      - run: pnpm test:l4-context
      - run: pnpm test:l4-memory
      - run: pnpm test:l4-approval
      - run: pnpm test:l4-background
      - run: pnpm test:l4-plan
      - run: pnpm test:l4-polish

  test-l5-sdk-channels:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.22.0
      - run: pnpm install
      - run: pnpm test:sdk
      - run: pnpm test:channels

  verify:
    needs: [lint, build, test-l1-core, test-l2-tools, test-l3-service, test-l4-product, test-l5-sdk-channels]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.22.0
      - run: pnpm install
      - run: pnpm verify
```

### 2.2 PR Template

创建 `.github/pull_request_template.md`：

```markdown
## 变更范围

- [ ] L1 Core Runtime
- [ ] L2 Tool & Integration
- [ ] L3 Service & Protocol
- [ ] L4 Engineering Product Shell
- [ ] L5 External Surfaces
- [ ] L6 Orchestration
- [ ] CI/CD
- [ ] 文档

## 变更摘要

<!-- 一句话描述 -->

## Contract 影响

<!-- 是否修改了共享 contract？ -->

## 验证

- [ ] `pnpm verify` 通过
- [ ] 新增/修改的测试通过

## 升级条件

<!-- 什么情况下需要升级到 high-capability mode -->
```

### 2.3 v2 文档目录结构

```
docs/
├── v2/                         # v2 专属文档
│   ├── 00-overview.md          # v2 总览
│   ├── 01-cicd.md              # CI/CD 设计
│   ├── 10-l1-core.md           # L1 升级设计
│   ├── 11-memory-system.md     # 记忆系统设计
│   ├── 12-permission-system.md # 权限系统设计
│   ├── 20-l3-service.md        # L3 升级设计
│   ├── 30-l4-product.md        # L4 产品设计
│   └── 40-l5-desktop.md        # L5 Desktop 重构设计
├── architecture/               # 架构文档（从 v1 迁移）
├── exec-plans/
│   ├── active/                 # 进行中
│   └── completed/              # 已完成
└── governance/                 # 治理规则
```

### 2.4 分层验证脚本结构

```
scripts/
├── ci/                         # CI 专用脚本
│   ├── setup.mjs               # 环境设置
│   └── report.mjs              # 测试报告
├── verify/                     # 分层验证
│   ├── l1-core.mjs             # L1 验证
│   ├── l2-tools.mjs            # L2 验证
│   ├── l3-service.mjs          # L3 验证
│   ├── l4-product.mjs          # L4 验证
│   └── l5-sdk-channels.mjs     # L5 验证
└── deploy/                     # 部署脚本
    └── docker.mjs              # Docker 构建
```

---

## 三、验收标准

- [ ] `.github/workflows/ci.yml` 存在且语法正确
- [ ] `.github/pull_request_template.md` 存在
- [ ] `docs/v2/` 目录结构建立
- [ ] `scripts/verify/` 分层验证脚本建立
- [ ] 本地运行 `act`（GitHub Actions 本地模拟）或通过实际 push 验证流水线

---

## 四、不做什么

1. 不修改任何 `packages/` 代码
2. 不修改任何 `apps/` 代码
3. 不新增业务功能
4. 不改变现有 `pnpm verify` 的行为

---

## 五、升级条件

- 发现 CI 环境无法运行现有测试
- 需要修改 packages/ 代码才能通过 CI
- 连续两轮流水线失败
