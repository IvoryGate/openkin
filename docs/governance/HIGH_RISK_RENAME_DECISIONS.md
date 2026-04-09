# High-Risk Rename Decisions

## 状态

本文件用于记录 deep rename 进入高风险区域后的冻结结论。

适用范围：

- HTTP path
- shared contract type / DTO / SSE
- Prometheus metrics
- DB 文件名
- workspace 默认目录与运行时文件名
- 持久化内部键
- 对外 TypeScript symbol

本文件不直接要求实现；它用于决定哪些应保留、哪些可兼容迁移、哪些必须另立计划。

---

## 当前前置状态

在本文件编写时，以下阶段已完成：

- `040` monorepo package scope 已迁移到 `@theworld/*`
- `041` 运行时默认环境变量已迁移到 `THEWORLD_*`，并保留 `OPENKIN_*` fallback

因此当前高风险区不再是 package scope / env 前缀本身，而是更深的稳定 contract 与持久化命名。

---

## 决策总览

| 类别 | 当前结论 | 决策 |
|------|----------|------|
| HTTP routes / `/v1` / `/health` / `/_internal/*` | 已被 SDK、Web Console、脚本、文档消费 | `keep` |
| DTO / JSON 字段 / SSE `type` / 错误码 | 外部兼容面 | `keep` |
| Prometheus `openkin_*` 指标名 | 运维兼容面 | `compat` |
| `openkin.db` | 数据与部署兼容面 | `defer` |
| `workspace/` 默认目录 | 本地开发与 Skill 生态兼容面 | `defer` |
| `agent-YYYY-MM-DD.log` / `mcp-registry.json` | 日志/内部状态文件名 | `keep` |
| `_openkin_fail_streak` 持久化键 | 内部持久化键 | `compat` |
| `OpenKin*` TypeScript symbol | SDK / server / core 编译期兼容面 | `compat` |
| Skill / localStorage / UI 历史命名 | 用户配置兼容面 | `migrate` |

---

## 决策细化

### 1. HTTP routes 与 wire contract

保留：

- `/health`
- `/v1/...`
- `/_internal/*`
- 现有 DTO 字段名
- SSE `StreamEvent` 结构与 `type`
- 现有错误码 / 状态码字符串

原因：

- 这些已经是对外兼容面
- 一旦重命名，将直接破坏 CLI、SDK、Web Console、脚本与外部客户端
- 当前仓库没有引入 `v2` API 版本线，也没有发布 breaking migration 机制

结论：

- 不在 rename 序列中直接修改
- 如果未来一定要改，只能走新增版本或双 route 兼容，不能做无版本替换

决策：`keep`

---

### 2. Prometheus metrics 名称

当前观测面中存在 `openkin_*` 指标前缀。

风险：

- 仪表盘、告警规则、录制规则、采集器依赖指标名
- 无兼容直接替换会让现有监控全断

结论：

- 当前不直接替换指标名
- 如果未来要切到 `theworld_*`，必须至少提供一个兼容窗口：
  - 双写旧新指标名，或
  - 明确发布迁移说明并同步改仪表盘

决策：`compat`

---

### 3. DB 文件名与 workspace 默认目录

当前高风险点包括：

- `openkin.db`
- `workspace/`
- `OPENKIN_WORKSPACE_DIR` 所关联的运行时布局语义

风险：

- 直接改名会导致新文件路径下出现空 DB
- 会话、消息、trace、配置与任务状态可能表现为“丢失”
- 测试、备份、挂载目录、工作区 Skill 路径都会受到影响

结论：

- 当前不迁移 `openkin.db`
- 当前不迁移默认 `workspace/` 目录名
- 如果未来要改，必须单独做：
  - 启动时的旧路径探测
  - 数据迁移或双路径读取
  - 回滚方案

决策：`defer`

---

### 4. 日志与内部状态文件

当前保留：

- `logs/agent-YYYY-MM-DD.log`
- `mcp-registry.json`

原因：

- 这些文件名已经与读取逻辑、排障流程、文档与用户工作区绑定
- 改名收益很低，但会扩大兼容面

结论：

- 当前保持文件名不动
- 如未来要重命名，必须在对应 reader / API / 文档中一起迁移

决策：`keep`

---

### 5. 持久化内部键

当前已知高风险内部键示例：

- scheduler 中的 `_openkin_fail_streak`

这类命名不直接暴露给外部 API，但已进入持久化数据。

结论：

- 不做硬切换
- 若未来要改名，必须先做到：
  - 读旧键兼容
  - 写新键
  - 最终再决定是否清理旧键

决策：`compat`

---

### 6. TypeScript 对外 symbol

当前仍存在大量 `OpenKin*` 命名，例如：

- `createOpenKinClient`
- `OpenKinClient`
- `createOpenKinOperatorClient`
- `createOpenKinHttpServer`
- `OpenKinAgent`

这些不一定是 wire contract，但属于编译期兼容面。

结论：

- 不建议直接重命名并删除旧 symbol
- 推荐下一阶段采用：
  - 新增 `TheWorld*` 命名或更中性命名
  - 保留 `OpenKin*` 作为 deprecated alias
  - 在一个兼容期后再移除旧名

决策：`compat`

---

### 7. 用户配置与前端存储

这类包括：

- workspace skills 中仍只认 `OPENKIN_*` 的脚本
- Web Console 历史 branding / 本地存储键
- 各类示例与操作手册里的旧名

风险相对较低，但容易形成“默认新名，局部仍只认旧名”的行为裂缝。

结论：

- 应继续迁移
- 优先做双读/双写兼容
- 这部分适合拆成独立低中风险工作单

决策：`migrate`

---

## 当前不启动的内容

以下内容当前明确不启动实现：

- HTTP path rename
- DTO / SSE / error code rename
- `openkin.db` rename
- 默认 `workspace/` rename
- 无兼容的 metrics rename

这些内容若要推进，必须单独授权。

---

## 推荐后续拆单

推荐把 `042` 后续拆成更小问题，而不是一个巨型 rename：

1. `043_ts_symbol_alias_migration.md`
2. `044_skill_and_console_compat_cleanup.md`
3. `045_observability_and_persistence_rename_strategy.md`

其中：

- `043` 处理 `OpenKin*` 编译期 symbol 的兼容迁移
- `044` 处理 Skill、Web Console、本地存储、用户配置等低中风险兼容面
- `045` 只做 metrics / DB / workspace / persisted-key 的迁移策略，不直接实施

---

## 冻结结论

- wire contract 不纳入当前 rename 实施面
- observability 与 persistence 命名优先保兼容，不做硬切换
- TypeScript symbol 可以继续推进，但必须带 alias / deprecation
- 用户配置与前端存储可以继续推进，是当前高风险区里最适合先做的增量
