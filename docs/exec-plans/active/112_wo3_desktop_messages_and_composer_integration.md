# 112 · WO-3 桌面端 Messages 与 Composer 接入工单

## 任务边界

本单是 `110` 的 WO-3 子工单，目标是把 Electron 中区从本地消息占位切到既有 run/message surface：

- 读取 `GET /v1/sessions/:id/messages`
- 提交 `POST /v1/runs`
- 监听 `GET /v1/runs/:traceId/stream` 终态后刷新消息

本单不做多模态输入、工具调用可视化、右栏真实数据接入。

## 影响范围

- **直接影响**
  - `apps/desktop/src/preload.ts`
  - `apps/desktop/src/global.d.ts`
  - `apps/desktop/renderer/app.js`
- **不影响**
  - `packages/server` API contract
  - `packages/shared/contracts`
  - `packages/sdk/*` 对外接口

## 不做什么

- 不新增 endpoint / DTO / event
- 不修改 run/message 协议字段
- 不引入 emoji 与非 IconPark 图标
- 不实现审批/工具结果细分 UI

## 单一路径实施

1. 预加载层提供桥接：
   - `getSessionMessages(baseUrl, sessionId, apiKey?)`
   - `createRun(baseUrl, sessionId, text, apiKey?)`
   - `waitRunTerminal(baseUrl, traceId, apiKey?)`
2. Renderer 在切换 session 时加载真实 messages
3. Composer 发送后触发 run，并在 run 终态后刷新 messages
4. 失败时显示受控错误，不崩溃、不回退协议层改造

## 验收标准

- 选中会话可读取真实消息历史并渲染
- 输入发送后能触发 run，并刷新出最新消息
- 失败时状态文本可读、界面可继续操作
- `pnpm --filter @theworld/desktop check` 通过
- `pnpm verify` 通过

## 升级条件（命中即停）

- 需要新增/修改 API 字段才能完成消息渲染
- 需要修改 SDK/共享 contract 才能发送 run
- 连续两轮 `pnpm verify` 无法通过
