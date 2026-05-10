# v2 Agent-Driven CI/CD 总览

> 本文档是 v2 重构的入口地图。

## 为什么需要 v2

v1 经过 120 个提交的探索，验证了核心 contract，但存在根本性不足：

1. 记忆系统只有空壳（`InMemoryMemoryPort`）
2. 权限管理不拦截工具执行
3. L4 产品面设计冻结但代码未完成
4. L5 Desktop 是 5438 行单体
5. 无 CI/CD 自动化流水线

v2 不是修修补补，而是**从工程方法论层面升级**。

## 核心理念

> **Agent-Driven CI/CD** = 每个代码变更都必须经过自动化验证流水线，每个分层增量都必须有明确的 contract 和验收标准。

```
仓库本身 = 产品
文档 = 需求规格
执行计划 = 工单系统
验证脚本 = CI 流水线
分层 contract = 接口契约
```

## 分层架构

```
L6: App & Orchestration        # Wave 6
L5: External Surfaces          # Wave 4-5
L4: Engineering Product Shell  # Wave 3
L3: Service & Protocol         # Wave 2
L2: Tool & Integration         # v1 已收口
L1: Core Runtime               # Wave 1
```

## 执行计划

| 编号 | 波次 | 范围 | 状态 |
|------|------|------|------|
| 200 | 总纲 | v2 全栈重构总纲 | 已定稿 |
| 201 | Wave 0 | CI/CD 骨架与仓库治理 | 待执行 |
| 202 | Wave 1 | L1 Core Runtime 升级 | 待执行 |
| 203 | Wave 2 | L3 Service 升级 | 待执行 |
| 204 | Wave 3 | L4 Product Shell 重构 | 待执行 |
| 205 | Wave 4 | L5 Desktop 重构 | 待执行 |
| 206 | Wave 5 | L5 Web & SDK 升级 | 待执行 |
| 207 | Wave 6 | L6 Orchestration 启动 | 待规划 |

## 分支

- v2 开发分支：`explore/v2-agent-driven-cicd`
- v1 保留分支：`feat/l5-client-surface`

## 验收标准

每 Wave 完成后必须：
1. `pnpm verify` 通过
2. CI 流水线通过
3. 文档更新
4. 代码审查

## 从哪开始

阅读执行计划：
1. `docs/exec-plans/active/200_v2_agent_driven_cicd_overview.md`
2. `docs/exec-plans/active/201_v2_wave0_cicd_skeleton.md`
