# 006 Channel Adapter Framework Contract

## 目标

把 **Channel Adapter Framework** 从类型占位推进为 **service-aligned 可插拔契约**，并明确规定：

- channel 正式链路必须通过 service 层进入系统
- 本计划只做 framework，不做任何真实平台接入
- mock adapter 的正式验收不允许绕过 `004` 已冻结的服务边界

## 已冻结决策

### 集成主链路

首期唯一允许的链路是：

`InboundEvent -> ChannelAdapter -> ChannelManager -> Service Gateway -> Session/Run -> StreamEvent -> OutboundMessage -> ChannelAdapter`

正式验收中不允许以下回退路径：

- 直接从 channel 触发 `@openkin/core`
- 以 in-process core 替代 service 层
- 跳过 004 的 session / run contract

### 首期对象

本轮只允许冻结以下对象：

1. `ChannelAdapter`
2. `ChannelManager`
3. `MockChannelAdapter`
4. `ChannelAccount`
5. `InboundEvent`
6. `OutboundMessage`
7. `sessionKey -> sessionId` 映射策略

### 生命周期

账号状态机继续沿用 `docs/architecture-docs-for-agent/first-layer/CHANNELS.md` 已存在的首期状态：

- `created`
- `authenticating`
- `active`
- `degraded`
- `stopped`
- `logged_out`
- `error`

本计划不允许弱模型自行新增、删除或重命名这些状态。

## 影响范围

| 层级 | 影响 |
|------|------|
| `packages/channel-core` | 扩展并冻结 adapter / manager / mock contract |
| `packages/server` | 如有需要，只增加通道入口的薄层；不得把 IM 平台细节泄漏到 core |
| `packages/core` | 不修改 Session / Run / Context 语义；不得作为正式回退集成点 |
| `packages/shared/contracts` | 只有在 service-aligned 集成确有必要时，才允许补最小 channel DTO |
| 文档 | 更新 `docs/architecture-docs-for-agent/first-layer/CHANNELS.md`，明确 framework 与具体平台的边界 |

## 允许修改的目录

- `packages/channel-core/`
- `packages/server/`
- `packages/shared/contracts/`
- `docs/architecture-docs-for-agent/first-layer/CHANNELS.md`
- `docs/exec-plans/active/`
- `package.json`
- `scripts/`

## 禁止修改的目录

- 真实平台 adapter 目录
- `apps/dev-console/`
- 与 channel framework 无关的 SDK / UI 代码
- 把 channel 直接接到 `packages/core` 的临时桥接代码

## 本轮范围

- 在 `packages/channel-core` 中定义 adapter / manager / mock contract
- 冻结 `sessionKey / accountId / 外部 thread id` 到内部 `sessionId` 的映射策略
- 打通 mock 入站到 service 层再回写 mock 出站的最小链路
- 为本计划引入独立 `test:channels` 或等价 smoke 命令
- 更新 `docs/architecture-docs-for-agent/first-layer/CHANNELS.md`，明确首期只做 framework，不做平台实现

## 本轮不做

- 不接 Slack、Discord、企业微信、飞书、Telegram 或任一真实平台
- 不做 OAuth、长连接重连、消息幂等与生产级去重
- 不实现通道后台或多租户 SaaS 管理面
- 不保留正式验收中的 in-process core 回退路径

## 验收标准

1. `packages/channel-core` 导出稳定的 adapter / manager / mock contract。
2. mock 入站可以通过 service 层触发一次 run，并产生可回写的 `OutboundMessage`。
3. `docs/architecture-docs-for-agent/first-layer/CHANNELS.md` 明确说明 framework 边界、状态机冻结与后续平台接入方式。
4. `pnpm verify` 通过。
5. `pnpm test:channels` 通过。

## 必跑命令

实现本计划时，默认必须运行：

1. `pnpm verify`
2. `pnpm test:channels`

## 升级条件

命中以下任一情况时，弱模型必须立即停止并升级到 high-capability mode 或人工：

- 需要新增、删除或重命名账号状态机状态
- 需要在 `packages/shared/contracts` 中新增超出本计划范围的跨层 DTO
- 需要跳过 service 层直接连接 core
- 连续两轮无法让 `pnpm verify` 与 `pnpm test:channels` 同时通过

## 依赖与顺序

- **前置**：[`004`](./004_service_api_and_streaming_contract.md)
- **建议顺序**：在 [`005`](./005_client_sdk_v1_minimal.md) 稳定后再推进，避免同时改 service 入口
- **后续候选**：真实平台 adapter、OAuth、幂等与媒体能力另开 exec-plan

## 验收结果

- **日期**：2026-04-02
- **实现**：`packages/channel-core`（`ChannelAdapter`、`MockChannelAdapter`、`ChannelManager`、`ChannelServiceGateway`）；`shared/contracts` 增加 `parseSseStreamEvents`（SDK 改为复用）；`scripts/test-channels.mjs` + `scripts/run-channels-smoke.ts`；架构 lint 约束 `channel-core` 不得依赖 `@openkin/core`。
- **`pnpm verify`**：已包含 `test:channels`。
- **说明**：未改 `packages/server` 路由；通道闭环经 HTTP 调用既有 v1 API。
