# 039 Repo Rename Matrix And Compat

## 目标

把深层 rename 的“命名真相源”和兼容规则真正落到仓库中，确保后续弱模型不靠猜测执行。

本工作单的重点不是大规模改代码，而是把矩阵、默认名、兼容期、warning 规则写清楚并同步到入口文档。

---

## 当前前置状态

假定以下已完成：

- `038` Deep Rename Program
- `docs/governance/RENAME_STRATEGY.md` 已存在

---

## 本轮范围（冻结）

必须完成：

1. 明确默认产品名、CLI 名、package scope、env 前缀
2. 明确旧名兼容窗口
3. 明确 warning 出现时机
4. 同步 docs index / requirements / active plan index

---

## 本轮不做

- 不批量改 workspace package name
- 不批量改 import path
- 不新增发布脚本
- 不改 server / SDK / contract 运行逻辑

---

## 单一路径实现要求

1. 以 `docs/governance/RENAME_STRATEGY.md` 为唯一真相源
2. 修正文档中“035–037 仍是下一阶段”的漂移
3. 在 `docs/index.md` 中加入 rename strategy 入口
4. 在 `docs/exec-plans/active/README.md` 中登记 038–042
5. 不在本轮偷偷做代码 rename

---

## 允许修改的目录

- `docs/governance/`
- `docs/index.md`
- `docs/requirements/`
- `docs/exec-plans/active/`

## 禁止修改的目录

- `packages/`
- `apps/`
- `scripts/`

---

## 验收标准

1. 仓库内存在统一的 rename strategy 入口
2. docs index / requirements / active README 与当前阶段一致
3. 兼容窗口、warning 策略、默认命名写清楚
4. `pnpm lint:docs` 通过

---

## 必跑命令

1. `pnpm lint:docs`

---

## 升级条件

- 需要开始修改 package scope
- 需要开始修改 env 读取逻辑
- 需要开始做脚本级兼容 warning 注入

---

## 给弱模型的任务提示

```text
你当前处于 budget mode。

任务：
把 deep rename 的命名矩阵与兼容策略同步到仓库文档层。

允许修改：
- docs/governance/
- docs/index.md
- docs/requirements/
- docs/exec-plans/active/

禁止修改：
- packages/
- apps/
- scripts/

验收：
- `pnpm lint:docs` 通过

升级条件：
- 需要改 package scope / env 逻辑 / 脚本行为
```
