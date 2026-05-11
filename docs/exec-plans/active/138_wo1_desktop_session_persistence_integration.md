# 138 · WO-1 会话持久化接入

## 任务边界

本单只处理“新建会话”能力闭环：

- Desktop 中点击“新建”时，不再仅创建本地假会话 ID。
- 改为调用服务端 `POST /v1/sessions` 创建真实会话并回填到列表与当前激活态。

## 影响范围

- `apps/desktop/renderer/app.js`
- `apps/desktop/src/preload.ts`
- `apps/desktop/src/global.d.ts`（若桥接签名变更）

## 不做什么

- 不改消息发送/流式渲染
- 不改右栏信息流
- 不扩展服务端 session DTO 字段

## 允许修改目录

- `apps/desktop/**`
- `docs/exec-plans/active/**`

## 不允许修改目录

- `packages/shared/contracts/**`
- `packages/server/**`（本单默认不改）
- `packages/sdk/**`

## 实施步骤（单一路径）

1. 在 preload 暴露 `createSession(baseUrl, apiKey?)`。
2. Renderer “新建”按钮优先走 bridge 创建会话；失败才提示错误并可选本地回退。
3. 创建成功后将 session 插入列表首位并激活。

## 验收标准

- 点击“新建”后可在服务端会话列表中看到对应会话。
- 刷新 Desktop 后，刚创建会话仍可加载。
- `pnpm --filter @theworld/desktop check` 通过。
- `pnpm verify` 通过。

## 升级条件（命中即停）

- 现有 `POST /v1/sessions` 无法满足最小创建闭环。
- 需要改动 contract 才能继续。
- 连续两轮 `pnpm verify` 失败。
