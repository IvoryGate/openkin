# 042 High-Risk Contract And Path Rename

## 目标

只在明确需要时，评估并执行深层 rename 中最高风险的一组内容：

- HTTP path
- shared contract type 名称
- DB 文件名
- workspace 默认目录 / 文件命名
- 对外 API 字段中的历史命名

本工作单默认**不应立即启动**；它是前面几轮完成后的升级入口。

---

## 当前前置状态

假定以下已完成：

- `038` Deep Rename Program
- `039` Repo Rename Matrix And Compat
- `040` Package Scope And Import Migration
- `041` Env Docs Scripts Rename

---

## 本轮范围（冻结）

必须先回答：

1. 哪些 path / type / 文件名真的需要改
2. 哪些必须永久保留兼容
3. 哪些可以只改文档、不改运行时
4. 数据迁移与回滚如何做

---

## 本轮不做

- 不在没有迁移方案时直接改 schema
- 不在没有兼容期时直接删旧 path
- 不在没有数据回放/恢复方案时改 DB 文件命名

---

## 单一路径实现要求

1. 先列出所有高风险命名面
2. 对每项给出“保留 / 兼容 / 迁移 / 放弃”决策
3. 能拆小则拆小，不做一个巨型 rename PR
4. 明确迁移、回滚、监控和验收方式

---

## 允许修改的目录

- `docs/`
- 如经批准，再扩到 `packages/shared/contracts/`
- 如经批准，再扩到 `packages/server/`

## 默认禁止修改的目录

- 其他全部目录

---

## 验收标准

1. 每个高风险命名面都有决策
2. 任何运行时改动都有兼容或迁移方案
3. 能拆成更小的后续工作单
4. 没有直接跳过设计去做全局替换

---

## 必跑命令

按子问题决定；若改到运行时代码，默认至少：

1. `pnpm check`
2. `pnpm verify`

---

## 升级条件

- 需要迁移现有用户数据
- 需要 breaking API 变更
- 需要同时调整多个层级的稳定 contract

---

## 给弱模型的任务提示

```text
你当前处于 budget mode。

任务：
仅在被明确授权时，评估高风险 contract/path/db rename。

默认不要开始代码实现。
先产出决策与拆单。

如果需要 touching shared contracts / server / 数据迁移，
必须立即升级，不要自行展开。
```
