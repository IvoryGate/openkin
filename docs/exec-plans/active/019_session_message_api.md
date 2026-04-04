# 019 Session & Message API

## 目标

在 018 持久化层的基础上，把 Session 和 Message 能力完整暴露为 REST API，补全当前 004 只做了最小骨架的 Session 端点，
并新增 Message 历史查询接口。

完成后，客户端（SDK / Channel / CLI）可以：
- 列出所有 session（不再需要客户端自己记 ID）
- 查询某个 session 的完整消息历史（用于重建对话上下文或展示历史）
- 删除会话

---

## 背景

### 当前 Session/Message 能力缺口

| 能力 | 现状 |
|------|------|
| `POST /v1/sessions` | ✓（创建，返回 id） |
| `GET /v1/sessions/:id` | ✓（单条查询，内存） |
| `GET /v1/sessions` | ✗ |
| `DELETE /v1/sessions/:id` | ✗ |
| `GET /v1/sessions/:id/messages` | ✗ |
| 消息历史持久化 | 依赖 018 |

### 004 为何只做最小

004 的目标是冻结 SSE 协议和核心路由 contract，刻意不做 Session 列表和 Message History，
以避免过早锁定完整数据模型。018 稳定后，本计划填充这部分缺口。

---

## 已冻结决策

### 新增路由

```
GET    /v1/sessions                        列出所有 session（支持 limit/offset 查询参数）
DELETE /v1/sessions/:sessionId             删除 session（同时删除关联 messages 和 traces）
GET    /v1/sessions/:sessionId/messages    获取会话消息历史（支持 limit/before 查询参数）
```

不新增的路由（明确延后）：
- `PATCH /v1/sessions/:id`（session 元数据编辑，目前 session 除 kind 无可编辑字段）
- `GET /v1/messages/:id`（单条消息查询，当前无需求）

### DTO 设计

在 `packages/shared/contracts` 新增以下 DTO：

```typescript
// 列出 sessions
export interface ListSessionsRequest {
  limit?: number    // 默认 20，最大 100
  offset?: number   // 默认 0
}

export interface ListSessionsResponseBody {
  sessions: SessionDto[]
  total: number
}

// Message DTO
export interface MessageDto {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string            // 纯文本；tool 消息为 JSON 序列化的结构化内容
  createdAt: number          // Unix ms
}

// 会话消息历史
export interface ListMessagesRequest {
  limit?: number   // 默认 50，最大 200
  before?: number  // Unix ms，返回 createdAt < before 的消息（用于分页向上加载）
}

export interface ListMessagesResponseBody {
  messages: MessageDto[]
  hasMore: boolean
}
```

### 路由常量

在 `packages/shared/contracts` 新增：

```typescript
export function apiPathSessionMessages(sessionId: string): string {
  return `${API_V1_PREFIX}/sessions/${encodeURIComponent(sessionId)}/messages`
}
```

### 删除会话语义

- `DELETE /v1/sessions/:id` 返回 `204 No Content`（成功）或 `404`（不存在）
- 删除 session 时，SQLite 的 `ON DELETE CASCADE` 自动删除关联 `messages` 和 `agent_run_traces`
- 删除成功后，同一 session 的 SSE 流若还在传输，正常完成（不中断）

### 内存状态同步

`InMemorySessionRegistry` 保持不变，删除操作只对 DB 生效。
删除后再 `GET /v1/sessions/:id` 会走 DB 查询——如果内存里还有但 DB 已删除，DB 为准（通过 DB 查询覆盖内存）。

实现约定：**GET 单条和列表都以 DB 为数据源**（如果 `db` 存在）。内存作为运行时缓存，不再作为查询源。

---

## 影响范围

| 层级 | 影响 |
|------|------|
| `packages/shared/contracts/src/index.ts` | 新增 Message DTO、ListSessions/Messages DTO、路由辅助函数 |
| `packages/server/src/http-server.ts` | 新增三条路由 handler |
| `packages/sdk/client/src/index.ts` | 新增 `listSessions()` / `getMessages()` / `deleteSession()` 方法 |
| `scripts/test-session-message-api.mjs` | 新增 smoke 脚本 |
| `package.json`（根） | 新增 `test:session-message`，纳入 `verify` |
| `docs/architecture/first-layer/SDK.md` | 从 "延后" 移动 `listSessions()` 到 "已实现" |

---

## 允许修改的目录

- `packages/shared/contracts/src/index.ts`
- `packages/server/src/http-server.ts`
- `packages/sdk/client/src/index.ts`
- `scripts/`
- `docs/architecture/first-layer/SDK.md`
- `docs/exec-plans/active/`
- `package.json`（根，仅 `scripts` 字段）

## 禁止修改的目录

- `packages/core/`
- `packages/channel-core/`
- `apps/dev-console/`
- `packages/server/src/db/`（只读 DB，不改 schema）
- 现有路由与 DTO（不得 breaking change `004` 已冻结的 endpoint）

---

## 本轮范围

1. **修改** `packages/shared/contracts/src/index.ts`
   - 新增 `MessageDto`、`ListSessionsResponseBody`、`ListMessagesResponseBody`
   - 新增 `apiPathSessionMessages()` 路由辅助函数
   - 新增 `ListSessionsRequest`、`ListMessagesRequest`

2. **修改** `packages/server/src/http-server.ts`
   - `GET /v1/sessions`：从 DB 读取，支持 `limit`/`offset` 查询参数（默认 20/0）
   - `DELETE /v1/sessions/:id`：DB 删除，返回 204；不存在返回 404
   - `GET /v1/sessions/:id/messages`：从 DB 读取，支持 `limit`/`before` 参数

3. **修改** `packages/sdk/client/src/index.ts`
   - 新增 `listSessions(params?)` → `GET /v1/sessions`
   - 新增 `getMessages(sessionId, params?)` → `GET /v1/sessions/:id/messages`
   - 新增 `deleteSession(sessionId)` → `DELETE /v1/sessions/:id`

4. **新增** `scripts/test-session-message-api.mjs`
   - 启动带 DB 的 server 子进程
   - 创建两个 session → 提交 run → 等待 `run_completed`
   - 断言：`GET /v1/sessions` 返回两条
   - 断言：`GET /v1/sessions/:id/messages` 返回消息（至少含 user / assistant）
   - 断言：`DELETE /v1/sessions/:id` 成功，再查询返回 404

5. **更新** 根 `package.json`：`"test:session-message": "node scripts/test-session-message-api.mjs"` 纳入 `verify`

6. **更新** `docs/architecture/first-layer/SDK.md`：`listSessions()` 从 deferred 移至 implemented

---

## 本轮不做

- 不实现 `cancelRun()`（仍延后）
- 不实现消息编辑 / 撤回
- 不实现 session 标签或搜索
- 不实现 Message 分页的 cursor 模式（只做 `limit + before` 时间分页）
- 不实现 Trace 查询 API（属于 021）
- 不改 `InMemorySessionRegistry` 接口

---

## 验收标准

1. `GET /v1/sessions` 返回持久化的 session 列表（重启后仍可见）。
2. `DELETE /v1/sessions/:id` 删除成功后 404，且 messages / traces 联级删除。
3. `GET /v1/sessions/:id/messages` 返回完整消息历史（含 user + assistant 轮次）。
4. SDK 三个新方法可正常调用。
5. smoke 脚本所有断言通过。
6. `pnpm verify` 通过。

---

## 必跑命令

1. `pnpm verify`
2. `pnpm test:session-message`

---

## 升级条件

命中以下任一情况时，弱模型必须立即停止并升级：

- 需要修改 004 已冻结的路由或现有 DTO（breaking change）
- 需要在 `packages/core/` 引入 DB 依赖
- 需要实现消息内容的 MIME / 多模态格式（超出首期纯文本范围）
- 连续两轮无法让 `pnpm verify` 与 `test:session-message` 同时通过

---

## 依赖与顺序

- **前置**：[`018`](./018_persistence_layer.md)（DB 表 + Repository 必须存在）
- **后续**：
  - [`021`](./021_observability.md) — Trace 查询 API（依赖 `agent_run_traces` 表）

---

## 决策记录

| 决策点 | 选择 | 原因 |
|--------|------|------|
| 分页方式 | `limit + before`（时间游标） | 聊天历史向上翻页的自然模式；避免跳页后偏移错误 |
| 删除语义 | 软删除还是硬删除 | 首期硬删除；无审计需求；SQLite CASCADE 自动清理 |
| `GET /v1/sessions` 数据源 | DB（如存在） | 保证重启后一致；内存只是运行时缓存 |
| SDK 是否同步增加方法 | 是，与路由同步 | SDK 是唯一受支持的客户端接入点，保持与服务层 parity |
