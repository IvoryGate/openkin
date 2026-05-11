# 149-Step2 · http-desktop-bridge.js 改为基于 sdk/client

## 任务边界

本单将 `apps/desktop/renderer/http-desktop-bridge.js` 从手写 HTTP 调用改为基于 `sdk/client`。

**依赖**：149-Step1 完成。

## 影响范围

- `apps/desktop/renderer/http-desktop-bridge.js`
- `apps/desktop/package.json`（可能需要添加 `@theworld/sdk-client` 依赖）

## 不做什么

- 不修改 `apps/desktop/src/preload.ts`
- 不修改 `apps/desktop/src/global.d.ts`
- 不修改 `apps/desktop/renderer/app.js`
- 不修改 `packages/sdk/client`
- 不修改 `packages/shared/contracts`

## 实施步骤（单一路径）

1. 在 `apps/desktop/package.json` 添加 `@theworld/sdk-client` 依赖
2. 在 `http-desktop-bridge.js` 中 `import { createTheWorldClient } from '@theworld/sdk-client'`
3. 重写 `createHttpDesktopBridge()`：内部使用 `createTheWorldClient` 做所有 HTTP 调用
4. 保留 `resolveDesktopBridge(native)` 的 native/http 合并逻辑不变
5. `parseSseStreamEvents` 和 `parseSseStream` 改为从 `sdk/client` 导入（或 `shared-contracts`）
6. 删除 `http-desktop-bridge.js` 中所有 `fetchWithOptionalAuthRetry`、`buildHeaders`、`authHeadersOnly`、`fetchGetWithOptionalAuthRetry`、`parseSseStream`、`parseSseStreamEvents`、`streamChunks` 函数
7. 桥接方法的返回值需与 `global.d.ts` 中的 `TheworldDesktopBridge` 签名一致（类型适配层可在此处做映射）

### 关键约束：Electron renderer 可用性

`http-desktop-bridge.js` 运行在 Electron renderer 进程中，这是一个浏览器环境。需要确认：
- `@theworld/sdk-client` 的构建产物可在浏览器环境导入（ESM 或 IIFE）
- 如果 `sdk/client` 不支持浏览器直接导入，则保留 `http-desktop-bridge.js` 的 HTTP 手写逻辑，但在 Step 3 时在 preload 侧做收敛

### 桥接方法映射

| 当前方法 | sdk/client 对应 |
|---------|----------------|
| `listSessions(baseUrl, apiKey)` | `client.listSessions()` |
| `createSession(baseUrl, apiKey)` | `client.createSession()` |
| `getSessionMessages(baseUrl, sessionId, apiKey)` | `client.getMessages(sessionId)` |
| `createSessionMessage(baseUrl, sessionId, content, role, apiKey)` | `client.createSessionMessage(sessionId, body)` |
| `probeRunSurface(baseUrl, apiKey)` | `client.run({})` 的 404 判断 |
| `createRun(baseUrl, sessionId, text, apiKey, options)` | `client.run(request)` |
| `streamRunUntilTerminal(baseUrl, traceId, apiKey, onEvent)` | `client.streamRun(request, onEvent)` 或直接 GET SSE |
| `waitRunTerminal(baseUrl, traceId, apiKey)` | `client.streamRun + 空 listener` |
| `cancelRun(baseUrl, traceId, apiKey)` | `client.cancelRun(traceId)` |
| `listApprovals(baseUrl, apiKey)` | ⚠️ 不在 sdk/client 中（需补充或走 operator-client） |
| `approveApproval(...)` | ⚠️ 不在 sdk/client 中 |
| `denyApproval(...)` | ⚠️ 不在 sdk/client 中 |
| `getRunTrace(baseUrl, traceId, apiKey)` | ⚠️ 不在 sdk/client 中 |
| `listAgents(baseUrl, apiKey)` | ⚠️ 不在 sdk/client 中（operator surface） |
| `createAgent(...)` | ⚠️ 不在 sdk/client 中 |
| `updateAgent(...)` | ⚠️ 不在 sdk/client 中 |
| `deleteAgent(...)` | ⚠️ 不在 sdk/client 中 |
| `getSystemStatus(baseUrl, apiKey)` | ⚠️ 不在 sdk/client 中 |

**⚠️ 关键发现**：Approval、Agent CRUD、System Status 属于 operator surface，不在 `sdk/client` 的 `TheWorldClient` 接口中。这些需要通过 `sdk/operator-client` 或直接 HTTP 调用实现。

### 收敛策略调整

对于 client surface 的方法（session/message/run/cancel），统一走 `sdk/client`。

对于 operator surface 的方法（approval/agent/system status），有两种选择：
- **选择 A**：在 `http-desktop-bridge.js` 中继续保留这些方法的直接 HTTP 调用，但使用 `shared-contracts` 的类型和路由常量
- **选择 B**：引入 `sdk/operator-client` 做这些调用

**推荐选择 A**：当前 Desktop 是受信任客户端，可以直连 operator surface，但应使用 `shared-contracts` 的路由常量和 DTO 类型，避免硬编码。

## 验收标准

- [ ] `http-desktop-bridge.js` 中 client surface 方法使用 `sdk/client`
- [ ] operator surface 方法使用 `shared-contracts` 路由常量，不再硬编码
- [ ] `parseSseStream` / `parseSseStreamEvents` 不再重复实现
- [ ] Desktop 功能无退化
- [ ] `pnpm verify` 通过
- [ ] `pnpm --filter @theworld/desktop check` 通过

## 升级条件（命中即停）

- `sdk/client` 不可在 Electron renderer 环境运行
- 需要修改 `sdk/client` 的对外接口
- 需要修改 `shared-contracts` 的对外接口
- 连续两轮 `pnpm verify` 失败
