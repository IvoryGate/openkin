# 011 First Layer Real Provider Feedback Loop

## 目标

新增一条 **非默认** 的真实 provider 集成验收回路，用于验证第一层在提供真实 `apiKey`、`baseURL`、`model` 后可以稳定跑通，而不污染默认 `pnpm verify`。

## 已冻结决策

### 命令入口

- 首期固定新增 `pnpm test:first-layer-real`
- 该命令只在显式提供 env 时运行
- 不并入默认 `pnpm verify`

### 验收路径

- 路径基于第一层 in-process demo runner
- 至少覆盖一次真实 provider 驱动的成功 run
- 可包含纯文本回复或内置工具调用

### 失败处理

- env 缺失时必须直接退出并给出提示
- 外部网络失败或 provider 返回错误时，必须保留可观测输出

## 影响范围

| 层级 | 影响 |
|------|------|
| `apps/dev-console` 或 `scripts/` | 增加真实 provider 集成命令入口 |
| `package.json` | 增加非默认真实验收脚本 |
| 文档 | 说明该命令的用途与边界 |

## 允许修改的目录

- `apps/dev-console/`
- `scripts/`
- `package.json`
- `docs/governance/GIT_WORKFLOW.md`
- `docs/exec-plans/active/`

## 禁止修改的目录

- 默认 `verify` 主链路
- `packages/server/`
- `packages/sdk/`
- `packages/channel-core/`

## 本轮范围

- 增加真实 provider 集成命令
- 明确 env 要求
- 输出可用于人工判断的成功 / 失败信息

## 本轮不做

- 不把真实 provider 验收接入 CI 默认门槛
- 不做多 case 压测
- 不要求 service / SDK / channel 参与这条反馈回路

## 验收标准

1. 存在 `pnpm test:first-layer-real` 或等价命令。
2. 在提供真实 env 时，该命令可以跑通一次真实 run。
3. 该命令未并入默认 `pnpm verify`。
4. `pnpm verify` 继续通过。

## 必跑命令

1. `pnpm verify`
2. `pnpm test:first-layer-real`

第二条命令只在提供 env 时作为计划验收门槛。

## 升级条件

- 需要把真实 provider 验收变成默认 CI 门槛
- 需要在这条反馈回路中接入 service / SDK / channel
- 需要做多供应商统一验收矩阵
- 连续两轮无法让 `pnpm verify` 与真实命令同时通过

## 依赖与顺序

- **前置**：[`009`](./009_first_layer_config_and_demo_runner.md) 与 [`010`](./010_first_layer_reliability_guards.md)
- **解锁**：[`012`](../active/012_first_layer_readiness_closure.md)

## 验收结果

- **入口**：根目录 `pnpm test:first-layer-real` → `scripts/test-first-layer-real.mjs`；缺任一 `OPENAI_*` 时打印说明并以非零退出，不启动子进程。
- **运行路径**：`pnpm --filter @openkin/dev-console demo:live` → `tsx src/demo-live.ts`（与 `pnpm dev:first-layer` / `index.ts` 同逻辑）。
- **`@openkin/dev-console`**：`package.json` 增加 `demo:live` 脚本。
- **文档**：`docs/first-layer/DEMO_FIRST_LAYER.md`、`docs/governance/GIT_WORKFLOW.md` 已说明边界；根 `verify` 未包含本命令。
