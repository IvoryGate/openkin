# 040 Package Scope And Import Migration

## 目标

把 monorepo 的 package scope 从 `@openkin/*` 迁移到 `@theworld/*`，并在一次受控批次中同步 import / dependency 引用。

冻结原则：

- 在 workspace 内不长期并存两套 scope
- package scope 迁移和 env 前缀迁移分开执行
- 任何潜在外部消费面都要明确兼容策略

---

## 当前前置状态

假定以下已完成：

- `038` Deep Rename Program
- `039` Repo Rename Matrix And Compat

---

## 本轮范围（冻结）

必须完成：

1. 更新所有 workspace package 的 `name`
2. 更新所有 workspace 内 `@openkin/*` imports / dependencies
3. 处理 tsconfig / vite / 脚本里的 package 引用
4. 保持 `pnpm check` 与相关 smoke 可通过

---

## 本轮不做

- 不改 `OPENKIN_*`
- 不改 CLI 用户提示文案
- 不改 HTTP path
- 不改 shared contract type 名
- 不做外部 npm dual-publish

---

## 单一路径实现要求

1. 先列出全部 workspace package 名
2. 一次批量改为 `@theworld/*`
3. 再统一替换 repo 内 imports / dependencies
4. 只在确有必要时保留注释说明旧 scope 已废弃
5. 跑 typecheck 与关键 smoke

---

## 允许修改的目录

- `packages/`
- `apps/`
- 根目录 `package.json`
- `pnpm-lock.yaml`
- `scripts/`
- `docs/exec-plans/active/`

## 禁止修改的目录

- `docs/architecture-docs-for-agent/`
- `docs/architecture-docs-for-human/`
- `docs/governance/RENAME_STRATEGY.md`（除非为了纠正文案错误）

---

## 验收标准

1. 所有 workspace package 名已切到 `@theworld/*`
2. repo 内主要 imports / dependencies 不再依赖 `@openkin/*`
3. `pnpm check` 通过
4. 至少运行一次 `pnpm test:project-cli`
5. 如影响范围较大，再跑 `pnpm verify`

---

## 必跑命令

1. `pnpm check`
2. `pnpm test:project-cli`
3. 如变更波及广：`pnpm verify`

---

## 升级条件

- 发现外部发布兼容要求必须双 scope 并存
- 发现 package scope 变更会连带 HTTP/contract rename
- 连续两轮无法恢复 `pnpm check`

---

## 给弱模型的任务提示

```text
你当前处于 budget mode。

任务：
把 monorepo package scope 从 `@openkin/*` 迁移到 `@theworld/*`。

允许修改：
- packages/
- apps/
- package.json
- scripts/
- pnpm-lock.yaml

不做：
- 不改 env 前缀
- 不改 HTTP path
- 不改 shared contract type 名称

验收：
- `pnpm check`
- `pnpm test:project-cli`
- 若影响广则 `pnpm verify`

升级条件：
- 需要双 scope 长期并存
- 需要改 HTTP/contract
- 连续两轮无法恢复 typecheck
```
