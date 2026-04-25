# 055 重启后续跑：`POST /v1/runs` 会话再挂载

## 背景

启用 SQLite 时，会话行保留在 DB 中，但进程重启后 `TheWorldAgent` 的内存会话表为空。仅依赖 DB 的客户端（例如 `theworld chat --continue` 从 `listSessions` 取 id）会在 **`POST /v1/runs`** 上得到 **404 Session not found**，因为原实现只检查 `agent.getSession(sessionId)`，未根据 DB 行恢复内存会话。

该问题**不属于** [`054_cli_chat_tty_interactive_ui.md`](./054_cli_chat_tty_interactive_ui.md) 范围；054 冻结边界明确 **禁止** 修改 `packages/server/`。本单单独授权服务端行为修正。

## 目标

在 **不改变** HTTP 路径、请求/响应 JSON 形状（contract）的前提下：当存在 DB 且 `sessions` 表中有对应 `sessionId` 时，若 agent 中尚无该会话，则在处理 run 前 **`agent.createSession({ id, kind })`**（`kind` 来自 DB），使后续 `importSessionHistory` 与 `agent.run` 与重启前语义一致。

## 允许修改

| 区域 | 说明 |
|------|------|
| `packages/server/src/http-server.ts` | 仅 `POST` `apiPathRuns()` 分支内会话解析与 `createSession` 再挂载逻辑 |
| `scripts/test-persistence.mjs` | 第二次启动后对同一 `sessionId` 再发起 `POST /v1/runs` + 拉流，回归「DB 有会话、内存空」路径 |

## 禁止修改

- `packages/shared/contracts/`、`packages/sdk/**`：不改对外 API 形状。
- 本单**不**承担 CLI TTY / Web Console 视觉任务（见 054、053）。

## 验收

- `node scripts/test-persistence.mjs` 通过（含重启后再次 run）。
- `pnpm --filter @theworld/server check` 通过。

## 决策记录

| 日期 | 决策 |
|------|------|
| （落地时补） | 与 054 解耦：服务端修补仅通过本编号工作单追踪。 |
