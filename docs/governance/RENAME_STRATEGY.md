# Rename Strategy

## 状态

仓库级 hard cut 已完成，当前默认技术标识统一为 `TheWorld`。

最终规范：

- CLI 入口：`pnpm theworld`
- package scope：`@theworld/*`
- 环境变量：`THEWORLD_*`
- TypeScript symbol：`TheWorld*` / `createTheWorld*`
- Prometheus 指标：`theworld_*`
- 运行时数据库文件：`theworld.db`

---

## 已完成收口

以下 rename 已经完成并进入当前基线：

1. 产品展示名统一到 `TheWorld`
2. monorepo package scope 统一到 `@theworld/*`
3. CLI 与脚本入口统一到 `theworld`
4. 运行时环境变量统一到 `THEWORLD_*`
5. 对外 TypeScript symbol 统一到 `TheWorld*`
6. Prometheus 指标统一到 `theworld_*`
7. 运行时数据库文件统一到 `theworld.db`

---

## 保留不改的中性 contract

以下能力面保持不变，因为它们已经是中性命名，不需要为了 rename 再制造新的 breaking surface：

- HTTP routes：`/health`、`/v1/...`、`/_internal/*`
- DTO / JSON 字段名
- SSE `type`
- 错误码 / 状态码字符串
- 默认 workspace 目录名 `workspace/`
- 日志文件名 `agent-YYYY-MM-DD.log`
- MCP 持久化文件名 `mcp-registry.json`

---

## 迁移结果

高风险面的最终处理方式如下：

| 类别 | 最终状态 | 说明 |
|------|----------|------|
| Runtime env | `THEWORLD_*` | 一方代码已不再读取旧前缀 |
| TypeScript symbol | `TheWorld*` | 一方代码已切到新符号 |
| Metrics | `theworld_*` | 一方断言与文档同步更新 |
| DB 文件 | `theworld.db` | 启动时会把旧数据库迁移到新文件名 |
| 持久化内部键 | `_theworld_fail_streak` | 调度器会读取旧键并升级为新键 |
| Console storage | `theworld_console_*` | 首次读取时迁移旧键，之后只写新键 |

---

## 兼容与迁移说明

本仓库不再保留长期兼容层，但仍包含**一次性迁移逻辑**，用于避免现有本地数据被误判为丢失：

- 若工作区下只有旧数据库文件，server 启动时会迁移到 `theworld.db`
- 若定时任务配置里仍存在旧 fail-streak 键，scheduler 会升级为新键
- 若浏览器 localStorage 中仍存在旧 console 设置键，Web Console 首次读取时会迁移到新键

这些迁移逻辑的目标是保护已有本地数据，而不是继续维持双栈命名。

---

## 当前结论冻结

- `TheWorld` 是产品名与默认技术名
- `pnpm theworld` 是唯一默认 CLI 入口
- `@theworld/*` 是唯一 workspace package scope
- `THEWORLD_*` 是唯一一方运行时环境变量前缀
- `TheWorld*` 是唯一一方 TypeScript symbol 前缀
- wire contract 继续保持现有中性路径与 DTO 结构
