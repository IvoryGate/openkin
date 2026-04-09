# Rename Strategy

## 状态

当前仓库处于**兼容迁移阶段**：

- 用户可见产品名已经开始收口到 `TheWorld`
- package scope 已迁移到 `@theworld/*`
- 技术标识仍大量保留 `openkin` / `OPENKIN_*`
- 对外 TypeScript symbol 已进入兼容迁移：新增 `TheWorld*`，保留 `OpenKin*` deprecated alias

本文件用于冻结深层 rename 的命名矩阵、兼容策略与迁移顺序。

---

## 目标

把仓库从“表层 TheWorld、内部仍为 OpenKin”推进到“产品名与技术标识逐步一致”，但不做一次性全量替换。

迁移目标包括：

1. 产品名：`OpenKin` -> `TheWorld`
2. CLI 入口：`openkin` -> `theworld`
3. package scope：`@openkin/*` -> `@theworld/*`
4. 环境变量前缀：`OPENKIN_*` -> `THEWORLD_*`
5. repo 级文档与脚本入口同步改名

---

## 不在首批迁移内

以下内容默认不并入首批深层 rename：

- HTTP path
- shared contract type 名称
- 数据库文件名（如 `openkin.db`）
- workspace 默认目录名
- API 返回字段名

这些属于更高风险面，必须单独立计划。

---

## 命名矩阵

| 维度 | 当前规范 | 目标规范 | 首批策略 |
|------|----------|----------|----------|
| 产品展示名 | `OpenKin` / `TheWorld` 混用 | `TheWorld` | 统一到 `TheWorld` |
| CLI 入口 | `pnpm openkin`、`pnpm theworld` | `pnpm theworld` | 保留 `openkin` 兼容入口一个阶段 |
| monorepo package scope | `@theworld/*`（已完成） | `@theworld/*` | 已完成；后续只讨论 symbol 兼容 |
| 环境变量 | `OPENKIN_*` | `THEWORLD_*` | 先双读，再警告，再删除旧前缀 |
| 文档/脚本产品名 | `openkin`、`OpenKin` | `theworld`、`TheWorld` | 默认改新名，保留兼容说明 |
| DB / workspace 技术名 | `openkin.db`、`OPENKIN_WORKSPACE_DIR` | 待决 | 另立高风险计划 |
| TypeScript symbol | `OpenKin*` / `createOpenKin*` | `TheWorld*` / `createTheWorld*` | 新旧双出口；旧名保留 deprecated alias |

---

## 当前仓库盘点

### 1. 根入口与用户可见面

- 根脚本同时暴露 `pnpm openkin` 与 `pnpm theworld`
- CLI 标题已切到 `TheWorld`
- CLI 帮助、错误提示、示例里仍有不少 `openkin` 文案，用于兼容但尚未完全收口

### 2. workspace package scope

当前 package 名称如下：

- `@theworld/shared-contracts`
- `@theworld/core`
- `@theworld/channel-core`
- `@theworld/client-sdk`
- `@theworld/operator-client`
- `@theworld/server`
- `@theworld/cli`
- `@theworld/dev-console`
- `@theworld/web-console`

### 3. package 对外暴露分级

按当前仓库信号，先冻结为以下分组：

| 包 | 当前信号 | 深层 rename 策略 |
|----|----------|------------------|
| `@theworld/client-sdk` | 非 private，最像对外 client 包 | symbol 层优先评估兼容 alias |
| `@theworld/shared-contracts` | 非 private，共享 contract 包 | 与 `client-sdk` 同步评估 |
| `@theworld/server` | 非 private，但更像仓库内部服务实现 | 默认按内部包处理，不承诺额外 alias |
| `@theworld/core` | 非 private，但属运行时内部核心 | 默认按内部包处理 |
| `@theworld/channel-core` | 非 private，但属内部分层模块 | 默认按内部包处理 |
| `@theworld/operator-client` | private | 已迁移 scope，无额外兼容承诺 |
| `@theworld/cli` | private | 已迁移 scope，无额外兼容承诺 |
| `@theworld/dev-console` | private | 已迁移 scope，无额外兼容承诺 |
| `@theworld/web-console` | private | 已迁移 scope，无额外兼容承诺 |

说明：

- 当前根仓库是 private monorepo，不能假设所有非 private 包都已对外发布
- 在没有发布策略文档前，只把 `client-sdk` 与 `shared-contracts` 视为**潜在外部兼容面**

### 4. 环境变量族

当前已观察到的 `OPENKIN_*` 使用族：

- CLI client:
  - `OPENKIN_SERVER_URL`
  - `OPENKIN_API_KEY`
- SDK / smoke scripts:
  - `OPENKIN_BASE_URL`
- server runtime:
  - `OPENKIN_WORKSPACE_DIR`
  - `OPENKIN_API_KEY`
  - `OPENKIN_MAX_BODY_BYTES`
  - `OPENKIN_SLOW_RUN_THRESHOLD_MS`
  - `OPENKIN_TASK_MAX_CONCURRENT`
  - `OPENKIN_TASK_MAX_RETRIES`
  - `OPENKIN_LLM_API_KEY`
  - `OPENKIN_LLM_BASE_URL`
  - `OPENKIN_LLM_MODEL`
  - `OPENKIN_LLM_CONNECT_FAMILY`
  - `OPENKIN_METRICS_LLM_PROVIDER`
  - `OPENKIN_INTERNAL_PORT`
- workspace skills / internal tooling:
  - `OPENKIN_SERVER_URL`
  - `OPENKIN_API_KEY`
  - `OPENKIN_INTERNAL_PORT`
  - `OPENKIN_WORKSPACE_DIR`

### 5. 高风险命名耦合点

当前已知不应与 package/env rename 混做一轮的点：

- 文档中的 `openkin.db`
- `OPENKIN_WORKSPACE_DIR` 对 workspace 默认目录的语义绑定
- service 文档中已经沉淀的 `OPENKIN_*` 运维说明
- 任何 shared contract / HTTP path / API schema 中的命名

---

## 兼容策略

### Phase A：兼容层建立

- 默认展示新名称：`TheWorld`、`pnpm theworld`、`THEWORLD_*`
- 运行时同时接受旧名称：`openkin`、`OPENKIN_*`
- 不在这个阶段删除任何旧名

### Phase B：旧名降级

- 文档、帮助、示例全部以新名称为主
- 检测到旧前缀或旧脚本入口时，输出一次性 warning
- 继续允许旧名运行，但明确写出淘汰窗口

### Phase C：移除旧名

- 删除 `openkin` 兼容入口
- 删除 `OPENKIN_*` fallback
- 视发布策略决定是否保留 `@openkin/*` 外部 alias

---

## 实施原则

1. 先冻结矩阵，再执行替换
2. 先做兼容层，再迁移调用方
3. monorepo package scope 已按**单次批量迁移**完成，不在 workspace 内长期并存两套 scope
4. 对潜在外部消费面，兼容 alias 必须有明确维护成本与停止时间
5. 任何涉及 HTTP path / contract / DB 文件名的 rename 必须单独验收

---

## 推荐执行顺序

1. `038_deep_rename_program.md`
2. `039_repo_rename_matrix_and_compat.md`
3. `040_package_scope_and_import_migration.md`
4. `041_env_docs_scripts_rename.md`
5. `042_high_risk_contract_and_path_rename.md`（仅在确认需要时）

---

## 当前结论冻结

- `TheWorld` 是产品展示名
- `pnpm theworld` 是未来默认 CLI 入口
- `@theworld/*` 是目标 package scope
- `THEWORLD_*` 是目标环境变量前缀
- `@theworld/*` 已是当前 package scope
- `TheWorld*` TypeScript symbol 已开始对外提供
- `OPENKIN_*` 在兼容期内保留
- `OpenKin*` TypeScript symbol 在兼容期内保留 deprecated alias
- DB / workspace / HTTP / contract 命名是否迁移，当前不做默认承诺
