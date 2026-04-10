# 038 Deep Rename Program

## 目标

把仓库从“表层 TheWorld、内部仍为 OpenKin”推进到“产品名与技术标识逐步一致”，并把高风险 rename 收口为分阶段执行方案。

本计划本身不做全仓库搜索替换；它的交付物是：

1. repo 级 rename 策略文档
2. 兼容窗口定义
3. 分批工作单

---

## 当前前置状态

假定以下已完成：

- `035` CLI Slash Commands
- `036` CLI Terminal UX
- `037` TheWorld Surface Rename

当前命名现状：

- 表层产品名已开始使用 `TheWorld`
- CLI 已提供 `pnpm theworld`
- package scope 仍为 `@openkin/*`
- 环境变量仍为 `OPENKIN_*`

---

## 本轮范围（冻结）

必须完成：

1. 盘点当前命名面
2. 冻结兼容期与删除顺序
3. 新增 repo 级 rename 策略文档
4. 新增后续可执行工作单

---

## 本轮不做

- 不直接批量改 `@openkin/*`
- 不直接批量改 `OPENKIN_*`
- 不改 HTTP path
- 不改 shared contract type
- 不改 DB 文件名
- 不改 workspace 默认目录名

---

## 关键产出

- `docs/governance/RENAME_STRATEGY.md`
- `039_repo_rename_matrix_and_compat.md`
- `040_package_scope_and_import_migration.md`
- `041_env_docs_scripts_rename.md`
- `042_high_risk_contract_and_path_rename.md`

---

## 验收标准

1. 有一份 repo 内可引用的 rename 策略文档
2. 能明确回答 package scope、env 前缀、脚本入口的目标命名
3. 有清晰兼容期说明
4. 后续 rename 被拆成可交给弱模型的工作单

---

## 必跑命令

1. `pnpm lint:docs`

---

## 升级条件

命中以下任一情况时立即停止并升级：

- 需要在本轮直接做全仓库 rename
- 需要同时改 package/env/HTTP/contract/DB 命名
- 需要在未定义兼容期前删除旧名
