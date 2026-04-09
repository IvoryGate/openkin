# 045 Observability And Persistence Rename Strategy

## 结果

本工作单已按 hard-cut 路径落地，不再只是策略文档。

已完成：

1. Prometheus 指标前缀统一到 `theworld_*`
2. 运行时数据库文件统一到 `theworld.db`
3. server 启动时增加旧数据库文件迁移逻辑
4. scheduler 持久化键统一到 `_theworld_fail_streak`
5. scheduler 读取旧键时自动升级为新键
6. 一方测试改为断言新的 observability / persistence 标识

---

## 本轮不改

以下面保持现状：

- `/health`、`/v1/...`、`/_internal/*`
- DTO / SSE / error code
- 默认 `workspace/` 目录名
- `agent-YYYY-MM-DD.log`
- `mcp-registry.json`

这些面已经是中性命名，继续改动不会带来等价收益。

---

## 验收

必须通过：

1. `pnpm check`
2. `pnpm verify`

重点回归：

- 旧数据库文件在启动时能迁移并继续读取历史数据
- 旧 fail-streak 持久化键能被读取并升级为新键
- `/metrics` 只暴露 `theworld_*` 指标
