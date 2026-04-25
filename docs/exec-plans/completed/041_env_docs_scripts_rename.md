# 041 Env Docs Scripts Rename

## 目标

把环境变量前缀、脚本入口、帮助文案和主要文档从 `OPENKIN_*` / `openkin` 推进到 `THEWORLD_*` / `theworld`，同时保留明确兼容期。

---

## 当前前置状态

假定以下已完成：

- `038` Deep Rename Program
- `039` Repo Rename Matrix And Compat

`040` 不要求先完成；env/docs/scripts 可以与 package scope 迁移独立推进，但必须遵守同一 rename strategy。

---

## 本轮范围（冻结）

必须完成：

1. CLI / server 对新旧 env 前缀双读
2. 默认帮助与文档展示 `THEWORLD_*`
3. 根脚本和示例默认展示 `theworld`
4. 必要时对旧前缀输出一次性 warning

---

## 本轮不做

- 不删除 `OPENKIN_*`
- 不删除 `openkin` 兼容脚本
- 不改 shared contract type 名称
- 不改 DB 文件名
- 不改 HTTP path

---

## 单一路径实现要求

1. 先新增 `THEWORLD_*` 读取逻辑
2. 再保留 `OPENKIN_*` fallback
3. 默认文案切到新前缀 / 新脚本名
4. 更新 `.env.example`、requirements、CLI help、关键 smoke
5. 只对用户侧可见入口输出兼容 warning，避免污染测试噪音

---

## 允许修改的目录

- `packages/cli/`
- `packages/server/`
- `packages/core/`（仅 env 读取点）
- `scripts/`
- 根目录 `package.json`
- `docs/`
- `.env.example`

## 禁止修改的目录

- `packages/shared/contracts/`
- `apps/web-console/`（除非仅文案示例）

---

## 验收标准

1. 新前缀 `THEWORLD_*` 可用
2. 旧前缀 `OPENKIN_*` 仍可用
3. CLI/help/docs 默认展示新前缀
4. `pnpm test:project-cli` 通过
5. `pnpm check` 通过
6. 如变更波及 server 行为，再跑 `pnpm verify`

---

## 必跑命令

1. `pnpm check`
2. `pnpm test:project-cli`
3. 如变更波及广：`pnpm verify`

---

## 升级条件

- 需要删除旧 env 前缀
- 需要改 workspace / DB / contract 命名
- warning 方案会破坏现有 smoke 或 API 兼容

---

## 给弱模型的任务提示

```text
你当前处于 budget mode。

任务：
引入 `THEWORLD_*` 并保留 `OPENKIN_*` fallback，同时把文档与帮助默认切到新前缀。

允许修改：
- packages/cli/
- packages/server/
- packages/core/（仅 env 读取）
- scripts/
- package.json
- docs/
- .env.example

不做：
- 不删除旧前缀
- 不改 HTTP path
- 不改 shared contract type
- 不改 DB 文件名

验收：
- `pnpm check`
- `pnpm test:project-cli`
- 如影响广则 `pnpm verify`

升级条件：
- 需要删除旧前缀
- 需要扩到 contract/path/db rename
```
