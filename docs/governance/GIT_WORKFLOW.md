# Git Workflow

## 目标

Git 在这个探索分支里不是备份工具，而是：

- 时间机器
- 稳定锚点
- agent 产出的审计轨迹
- 失败时的快速回退机制

## 分支原则

- `main`：稳定基线，不承载探索中的高频试验
- `explore/harness-evolution`：长期探索主线
- 如有必要，可从探索主线再切短分支处理单个执行计划

## 什么时候应该执行 Git 提交

Git 不应该在每次微小编辑后都立即执行，但也不应该长期堆着不提交。

以下情况下，应尽快形成一次提交：

1. 一个机制里程碑已经稳定
   - 例如文档归档稳定
   - 例如 monorepo 骨架稳定
   - 例如第一层 contract 收紧稳定
   - 例如新增自动化闸门稳定

2. 默认验证入口已经通过
   - 当前默认至少应通过 `pnpm verify`

3. 改动已经形成可回退的阶段边界
   - 即使下一步继续做，也不应该把两个不同阶段揉成一个不可解释的大补丁

## 当前建议的提交节奏

以下节点完成后，应尽快形成一次提交：

1. 文档系统或入口地图稳定
2. monorepo 或 contract 骨架稳定
3. 第一层关键语义收紧
4. 自动化约束新增
5. 反馈回路新增

## 每次提交前的默认动作

依赖安装与工作区基线要求：

- 统一从仓库根目录执行 `pnpm install`
- 以根目录 `node_modules` / `pnpm-lock.yaml` 作为安装基线，不以某个 package 下的局部 `node_modules` 作为事实来源
- 如果 lockfile 内含失效 tarball 源或安装状态与声明脱节，应先修复根安装基线，再跑 `pnpm verify`

默认先跑：

- `pnpm lint:docs`
- `pnpm lint:architecture`
- `pnpm lint:workspace`
- `pnpm check`
- `pnpm test:scenarios`
- 或直接运行 `pnpm verify`

当前根 `verify` 只包含上述默认路径。

对于已经冻结了额外验收命令的执行计划，还必须补跑对应命令：

- `004` 对应 `pnpm test:server`
- `005` 对应 `pnpm test:sdk`
- `006` 对应 `pnpm test:channels`

这些命令在对应计划真正落地前，可以先作为保留入口存在，但不应提前并入根 `verify`。

当对应 contract 与 smoke 路径稳定后，再逐步扩展根验证入口为：

- `pnpm test:server`
- `pnpm test:sdk`
- `pnpm test:channels`
- `pnpm test:first-layer-audit`（第一层 hook / 记忆 / 压缩审计，Mock，已并入根 `verify`）

非默认、需真实 API 的第一层验收（不并入根 `verify`）：

- `pnpm test:first-layer-real`（单次 `demo:live` 冒烟；需 `OPENAI_*`；见 `../first-layer/DEMO_FIRST_LAYER.md`）
- `pnpm test:first-layer-real-audit`（第一层全链路真实 API 审计：工具、记忆、多轮、压缩、hook 中止；见 `../first-layer/FIRST_LAYER_COVERAGE.md`）

## 提交信息原则

提交信息应该能回答“为什么这一阶段成立”，而不是只罗列文件变化。

## Agent 产出原则

如果未来希望 agent 主导产出，那么每次 agent 改动都应满足：

1. 可重跑
2. 可回退
3. 可审计
4. 可验证

换句话说，不能让 agent 产出变成一团无法解释的大补丁。
