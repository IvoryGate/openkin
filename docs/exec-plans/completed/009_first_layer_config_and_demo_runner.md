# 009 First Layer Config And Demo Runner

## 目标

把 `apps/dev-console` 从 mock-only 演示入口升级为 **可配置的第一层 demo runner**，使用户提供 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL` 后即可跑通真实 provider。

## 已冻结决策

### 配置来源

- 首期只支持环境变量配置
- 使用固定变量名：
  - `OPENAI_API_KEY`
  - `OPENAI_BASE_URL`
  - `OPENAI_MODEL`
- 缺失时必须明确报错并提示运行方式

### 入口分工

- `dev:first-layer` 作为真实 provider demo 入口
- mock 演示必须保留，但改成单独入口，不再和真实入口混在一起
- `test:scenarios` 继续保留 mock 路径，不能被真实 provider 依赖污染

### 运行边界

- demo runner 只服务第一层 in-process 运行
- 不把本计划扩大成 server / SDK / channel 集成入口

## 影响范围

| 层级 | 影响 |
|------|------|
| `apps/dev-console` | 增加配置读取、provider 选择与真实 demo 入口 |
| `package.json` | 调整 demo 相关脚本命名与入口 |
| 文档 | 补充真实 demo 的运行说明 |

## 允许修改的目录

- `apps/dev-console/`
- `package.json`
- `docs/`
- `docs/exec-plans/active/`

## 禁止修改的目录

- `packages/server/`
- `packages/sdk/`
- `packages/channel-core/`
- 跨层 contract 文档

## 本轮范围

- 增加 env 配置读取
- 把真实 provider 接到 dev-console
- 保留并分离 mock demo 入口
- 提供一条可复制的真实运行命令

## 本轮不做

- 不支持配置文件、密钥管理服务或多环境矩阵
- 不要求把真实 provider demo 纳入默认 `pnpm verify`
- 不把 demo runner 改造成长生命周期服务

## 验收标准

1. 用户提供三项 env 后，可以通过单条命令跑通真实第一层 demo。
2. env 缺失时，runner 会输出清晰错误与运行提示。
3. mock demo 与 scenarios 路径继续可用。
4. `pnpm verify` 通过。

## 必跑命令

1. `pnpm verify`

真实 provider 命令在本计划完成时写回文档，但不并入默认 `verify`。

## 升级条件

- 需要把 demo runner 改成 service 或 SDK 入口
- 需要引入配置文件体系或复杂密钥注入方式
- 需要把真实 provider 命令并入默认 `verify`
- 连续两轮无法让 `pnpm verify` 通过

## 依赖与顺序

- **前置**：[`008`](./008_openai_compatible_llm_provider.md)
- **解锁**：[`011`](../active/011_first_layer_real_provider_feedback_loop.md)

## 验收结果

- **日期**：2026-04-02
- **入口**：根目录 `pnpm dev:first-layer` → `demo-live.ts`（缺 env 时退出码 1 并打印说明）；`pnpm demo:first-layer:mock` → `demo-mock.ts`；`scenarios.ts` 未改依赖真实 API。
- **文档**：[`docs/DEMO_FIRST_LAYER.md`](../../DEMO_FIRST_LAYER.md)，`README.md` / `docs/index.md` 已指向。
