# 045 Observability And Persistence Rename Strategy

## 目标

只为以下高风险面制定迁移策略，不默认进入实现：

- Prometheus `openkin_*` 指标名
- `openkin.db`
- `workspace/` 默认目录
- 持久化内部键（如 `_openkin_fail_streak`）

---

## 当前前置状态

假定以下已完成：

- `042` 高风险 rename 决策

---

## 本轮范围（冻结）

必须完成：

1. 明确哪些项保留、哪些项可双写/双读、哪些项仍延后
2. 为每项写出迁移、回滚、观测与验收方式
3. 不能直接做破坏性替换

---

## 本轮不做

- 不直接重命名 metrics
- 不直接迁移 DB 文件
- 不直接改默认 workspace 目录
- 不清理旧持久化键

---

## 验收标准

1. 每个高风险项都有迁移草案
2. 数据与观测兼容面被明确记录
3. 如后续要实施，能拆成单独工作单

---

## 升级条件

- 需要真实数据迁移
- 需要 breaking observability 变更
