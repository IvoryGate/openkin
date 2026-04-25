# 037 TheWorld Surface Rename（表层重命名）

## 目标

把项目对外展示层从 `openkin / OpenKin` 收口为 `theworld / TheWorld`，但**只做表层重命名**，不在本轮触碰深层 package scope、共享 contract、环境变量族和内部大面积 symbol 重写。

这是给弱模型执行的安全阶段。

---

## 为什么拆成表层阶段

完整重命名会波及：

- CLI 二进制名
- 帮助文案
- README / requirements / exec-plans
- 包名与 import path
- 环境变量前缀
- API 文案与返回体字段
- 测试脚本、workspace 路径、数据库默认文件名

这些内容风险等级不同，不能一次性交给弱模型大面积搜索替换。

---

## 本轮范围（冻结）

必须完成：

1. CLI 用户可见名称从 `OpenKin CLI` 改为 `TheWorld CLI`
2. 文档中的产品名表述切到 `TheWorld`
3. 根脚本新增 `theworld` 入口
4. 保留 `openkin` 兼容入口至少一个阶段
5. 更新 CLI help / smoke / requirements 文档

可接受但非必须：

- `chat` 标题改成 `TheWorld Chat`
- 用户提示中的 server 文案同步改名

---

## 本轮不做

- 不改 monorepo package scope（例如 `@openkin/*`）
- 不改环境变量前缀（例如 `OPENKIN_SERVER_URL`）
- 不改 HTTP 路径
- 不改 shared contract type 名称
- 不改数据库文件名
- 不做仓库目录大迁移
- 不做一次性全局替换

---

## 单一路径实现要求

1. 先收口“用户看到的名字”清单
2. 只修改 CLI 和文档中的展示名
3. 在根 `package.json` 中增加 `theworld` script
4. 保留原 `openkin` script，避免上一阶段文档和测试立刻失效
5. 更新 smoke，使其既验证新名称，也不破坏兼容入口
6. 在文档中明确说明：当前只是表层 rename，深层 rename 另立计划

---

## 允许修改的目录

- `packages/cli/`
- `scripts/`
- 根目录 `package.json`
- `docs/requirements/PROJECT_CLI.md`
- `docs/exec-plans/active/`
- `docs/index.md`

## 禁止修改的目录

- `packages/shared/contracts/`
- `packages/sdk/client/`
- `packages/sdk/operator-client/`
- `packages/server/`
- `packages/core/`
- `apps/web-console/`

---

## 验收标准

1. 新入口 `pnpm theworld -- help` 可用
2. 原入口 `pnpm openkin -- help` 仍可用
3. CLI 标题和交互态标题显示 `TheWorld`
4. `pnpm test:project-cli` 通过
5. `pnpm verify` 通过

---

## 必跑命令

1. `pnpm test:project-cli`
2. `pnpm verify`

---

## 升级条件

命中以下任一情况时立即停止并升级：

- 需要改 package scope
- 需要改 env 前缀
- 需要改共享 contract 或 HTTP 路径
- 需要做大规模 import path 重写
- 连续两轮无法通过 `pnpm verify`

---

## 后续但不在本轮

后续如果确实要做“深层 rename”，应单独新建高风险计划，覆盖：

- `@openkin/*` 到新 scope
- `OPENKIN_*` 环境变量前缀
- 文档与脚本中的 repo 级命名
- 兼容期与迁移说明

本文件不是那个计划。

---

## 给弱模型的任务提示

```text
你当前处于 budget mode。

当前任务：
把产品对外展示层从 OpenKin 改为 TheWorld，但只做表层 rename。

允许修改：
- packages/cli/
- scripts/
- package.json
- PROJECT_CLI.md
- docs/index.md
- 相关 exec-plans

禁止修改：
- shared contracts
- sdk
- server
- core
- web-console

必须做到：
- 新增 `theworld` 入口
- 保留 `openkin` 兼容入口
- CLI help / chat 标题改为 TheWorld
- 文档明确这是表层 rename

验收标准：
- `pnpm test:project-cli` 通过
- `pnpm verify` 通过

升级条件：
- 需要改 package scope / env 前缀 / contract / HTTP path
- 连续两轮无法通过验收
```
