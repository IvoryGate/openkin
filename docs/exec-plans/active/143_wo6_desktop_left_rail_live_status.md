# 143 · WO-6 左栏实时状态接入

## 任务边界

本单把左栏 `CRON / HEARTBEAT` 从静态文案升级为实时状态：

- 读取系统状态接口中的 scheduler 与 heartbeat 信息
- 根据状态更新文案与视觉健康态
- 增加请求失败时的降级展示

## 影响范围

- `apps/desktop/renderer/index.html`
- `apps/desktop/renderer/app.js`
- `apps/desktop/src/preload.ts`
- `packages/shared/contracts/**`（仅在 bridge 类型补齐时）

## 不做什么

- 不在本单引入复杂监控面板
- 不增加新的 server 监控端点（优先复用现有 `/v1/system/status`）
- 不改右栏与中区消息链路

## 允许修改目录

- `apps/desktop/**`
- `packages/shared/contracts/**`（必要时）
- `docs/exec-plans/active/**`

## 不允许修改目录

- `packages/sdk/**` 对外接口
- 非 Desktop 客户端项目目录

## 实施步骤（单一路径）

1. preload 增加系统状态读取方法。
2. renderer 初始化后定时拉取并更新左栏状态卡。
3. 异常时显示降级状态并保留最后一次成功信息（如有）。

## 验收标准

- 左栏状态与服务端状态联动，非硬编码。
- 服务不可达时有明确降级文案，不影响会话功能。
- `pnpm --filter @theworld/desktop check` 通过。
- `pnpm verify` 通过。

## 升级条件（命中即停）

- `/v1/system/status` 信息不足以支撑最小展示。
- 必须新增系统级采集才能继续。
- 连续两轮 `pnpm verify` 失败。
