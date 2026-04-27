# 111 · WO-2 桌面端 Session Surface 接入工单

## 任务边界

本单是 `110` 的 WO-2 子工单，只做一件事：

- 在 `apps/desktop` 中把左栏会话列表从本地 mock 切到既有 session surface（`GET /v1/sessions`）。

本单不进入 run 流式渲染与消息持久化联调（留给 WO-3/后续子单）。

## 影响范围

- **直接影响**
  - `apps/desktop/src/preload.ts`
  - `apps/desktop/src/global.d.ts`
  - `apps/desktop/renderer/`（会话列表渲染与错误提示）
- **不影响**
  - `packages/server` API contract
  - `packages/shared/contracts`
  - `packages/sdk/*` 对外接口

## 不做什么

- 不新增 endpoint / DTO / event
- 不修改 `GET /v1/sessions` 返回结构
- 不实现右栏真实数据接入
- 不在 UI 中使用 emoji

## 单一路径实施

1. 预加载层新增只读桥接：`listSessions(baseUrl, apiKey?)`
2. Renderer 启动时调用桥接获取 sessions
3. 成功时按时间分组渲染（今天/昨天/本周/更早）
4. 失败时展示受控错误提示并保留空态，不回退到伪造业务数据

## 验收标准

- Electron 客户端能从真实 `GET /v1/sessions` 获取并渲染会话
- 连接失败时有明确错误文案，不导致渲染崩溃
- `pnpm --filter @theworld/desktop check` 通过
- `pnpm verify` 通过

## 升级条件（命中即停）

- 必须新增/修改 API 字段才能渲染会话
- 会话接口返回与现有 contract 不兼容
- 连续两轮 `pnpm verify` 无法通过
