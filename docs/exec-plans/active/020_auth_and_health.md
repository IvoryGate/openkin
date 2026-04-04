# 020 Auth & Health Check（鉴权、健康检查、优雅退出）

## 目标

为 Service 层补充三个独立但相互关联的工程能力：

1. **API Key 鉴权**：防止服务暴露在公网时被未授权调用
2. **健康检查端点**：`GET /health`，为运维和 Channel 层的依赖检测提供标准检查点
3. **优雅退出**：`SIGTERM` 信号处理，等待进行中的请求完成后再退出，防止 run 被强杀导致状态不一致

本计划不依赖 018/019（可与持久化计划并行推进），但建议在 018 稳定后再推进，以便健康检查能顺带报告 DB 状态。

---

## 背景

### 当前安全状态

| 能力 | 状态 |
|------|------|
| API Key 鉴权 | ✗（任意请求均可访问） |
| `GET /health` | ✗ |
| 优雅退出 | ✗（进程终止时进行中的 run 可能处于不一致状态） |
| 请求体大小限制 | ✗ |

### 为什么这三件事放一个计划

这三件事都属于服务框架的"运维就绪"能力，修改范围集中在 `http-server.ts` 和 `cli.ts`，
单独做每件事的改动量太小，合并一个计划节省计划管理成本。

---

## 已冻结决策

### API Key 鉴权

**机制：**
- Server 启动时从环境变量 `OPENKIN_API_KEY` 读取 API Key
- 客户端请求时在 HTTP 头携带：`Authorization: Bearer <key>`
- 如果 `OPENKIN_API_KEY` 未设置：**不启用鉴权**（开发环境默认不需要配置）
- 如果 `OPENKIN_API_KEY` 已设置：所有路由（除 `GET /health`）均检查此头，校验失败返回 `401`

**绕过列表（无论是否设置 key，均不检查）：**
- `GET /health`
- `/_internal/*`（已有 loopback 限制，不需要 API Key）

**Key 格式要求：** 无格式限制，任意字符串（推荐 32+ 字符随机字符串）

**SDK 配套：**
- `createOpenKinClient({ baseUrl, apiKey? })` 增加可选 `apiKey` 参数
- 如果设置，所有请求自动注入 `Authorization: Bearer <apiKey>` 头

### 健康检查

```
GET /health
```

**响应格式（无论是否设置 API Key，均无需鉴权）：**

```json
{
  "ok": true,
  "version": "0.1.0",
  "db": "connected",      // "connected" | "unavailable" | "not_configured"
  "uptime": 12345,        // 进程已运行的秒数
  "ts": 1712345678901    // Unix ms
}
```

- `db` 字段：如果 018 已引入 DB，做一次简单的 `SELECT 1` 探活；未引入 DB 时值为 `"not_configured"`
- 如果 DB 探活失败：`"db": "unavailable"`，HTTP status 仍为 `200`（health endpoint 不应该因为 DB 不可用而返回 5xx，让调用方自行决策）

**用途：**
- Channel Adapter 在启动时检查 service 是否就绪
- 部署系统（Docker / systemd）的 liveness probe
- `pnpm chat` CLI 在启动时检查 server 是否可达

### 优雅退出

```
SIGTERM → 停止接受新连接 → 等待进行中的请求完成（最长 30s）→ 关闭 DB → 退出
```

**实现策略：**
- 在 `cli.ts` 注册 `process.on('SIGTERM', ...)` 和 `process.on('SIGINT', ...)`
- 调用 `server.close(callback)` 停止接受新连接，等待现有连接处理完成
- 等待超时（30s）后强制退出（`process.exit(0)`）
- 关闭 DB：`db.close()`（在 server 关闭后）

**对进行中 SSE 流的处理：**
- SSE 是长连接，`server.close()` 不主动断开已建立的 SSE 连接
- 进行中的 run 会完成并发出 terminal event，客户端自然断开
- 超时 30s 后强制退出，未完成的 run 会在下次启动时通过 DB 查询发现（状态为非终态）

### 请求体大小限制

在 `readJsonBody` 函数中增加累积字节数检查：**默认限制 1 MB**（可通过环境变量 `OPENKIN_MAX_BODY_BYTES` 覆盖）。超限时返回 `413 Payload Too Large`。

---

## 影响范围

| 层级 | 影响 |
|------|------|
| `packages/server/src/http-server.ts` | 新增鉴权中间件逻辑、`GET /health` 路由、请求体大小限制 |
| `packages/server/src/cli.ts` | 注册 SIGTERM/SIGINT handler，优雅退出逻辑 |
| `packages/shared/contracts/src/index.ts` | 新增 `HealthResponseBody` DTO + `apiPathHealth()` 路由辅助 |
| `packages/sdk/client/src/index.ts` | `createOpenKinClient` 增加 `apiKey?` 参数；新增 `getHealth()` 方法 |
| `scripts/test-auth-health.mjs` | 新增 smoke 脚本 |
| `package.json`（根） | 新增 `test:auth-health`，纳入 `verify` |
| `docs/governance/SECURITY.md` | 更新鉴权状态说明 |

---

## 允许修改的目录

- `packages/server/src/http-server.ts`
- `packages/server/src/cli.ts`
- `packages/shared/contracts/src/index.ts`
- `packages/sdk/client/src/index.ts`
- `scripts/`
- `docs/governance/SECURITY.md`
- `docs/exec-plans/active/`
- `package.json`（根，仅 `scripts` 字段）

## 禁止修改的目录

- `packages/core/`
- `packages/channel-core/`
- `apps/dev-console/`
- 现有路由语义（不改现有 REST 路由的请求/响应格式）

---

## 本轮范围

1. **修改** `packages/server/src/http-server.ts`
   - 新增 `apiKey?: string` 到 `CreateOpenKinHttpServerOptions`
   - 在路由处理前做鉴权检查（除 `/health` 和 `/_internal/*`）
   - 新增 `GET /health` 路由（探活 DB，返回 `HealthResponseBody`）
   - 在 `readJsonBody` 中累积字节数，超过 `maxBodyBytes` 时返回 413

2. **修改** `packages/server/src/cli.ts`
   - 从 `OPENKIN_API_KEY` 读取并注入到 server options
   - 注册 `SIGTERM` / `SIGINT` handler，调用 `server.close()` 后等待，超时强制退出

3. **修改** `packages/shared/contracts/src/index.ts`
   - 新增 `HealthResponseBody`
   - 新增 `apiPathHealth()`

4. **修改** `packages/sdk/client/src/index.ts`
   - `createOpenKinClient({ baseUrl, apiKey? })`：所有请求注入 `Authorization` 头
   - 新增 `getHealth()` 方法

5. **新增** `scripts/test-auth-health.mjs`
   - 场景 A：未设置 API Key，所有路由正常访问
   - 场景 B：设置 API Key，不带 key 的请求返回 401
   - 场景 C：设置 API Key，带正确 key 的请求返回 200
   - 场景 D：`GET /health` 不带 key 始终返回 200（且 `ok: true`）
   - 场景 E：请求体超过 1MB 限制，返回 413

6. **更新** 根 `package.json`：`"test:auth-health": "node scripts/test-auth-health.mjs"` 纳入 `verify`

7. **更新** `docs/governance/SECURITY.md`：说明 API Key 鉴权已实现、绕过列表

---

## 本轮不做

- 不实现 JWT / OAuth / SSO 鉴权
- 不实现多 API Key（单一全局 Key 即可）
- 不实现 CORS 配置（Channel 层需要时再做）
- 不实现速率限制（Rate Limiting）
- 不实现 `GET /health` 的深层依赖链（LLM 是否可达等）
- 不实现 per-route 权限粒度（当前只有全局 key）

---

## 验收标准

1. `OPENKIN_API_KEY` 未设置时，所有路由正常访问（向后兼容）。
2. `OPENKIN_API_KEY` 设置后，不带 key 的请求返回 `401`；带正确 key 返回正常响应。
3. `GET /health` 不需要鉴权，始终返回 `{ ok: true, ... }`。
4. `POST /v1/runs` 请求体超过 1MB 返回 `413`。
5. smoke 脚本五个场景全部通过。
6. `pnpm verify` 通过。

---

## 必跑命令

1. `pnpm verify`
2. `pnpm test:auth-health`

---

## 升级条件

命中以下任一情况时，弱模型必须立即停止并升级：

- 需要实现多用户 / 多 Key / JWT 等复杂鉴权方案
- `server.close()` 在某些 Node 版本下无法可靠关闭 SSE 长连接，需要特殊处理
- 需要修改现有路由的请求/响应 DTO（breaking change）
- 连续两轮无法让 `pnpm verify` 与 `test:auth-health` 同时通过

---

## 依赖与顺序

- **前置**：[`017`](../completed/017_sandbox.md)（第二层已收口）
- **与 018/019 无强依赖**（可并行，但 health 的 DB 探活需要 018 的 `Db` 接口已存在才能完整实现）
- **后续**：无直接解锁项，但建议在 020 完成后再推进 021/022

---

## 决策记录

| 决策点 | 选择 | 原因 |
|--------|------|------|
| 鉴权粒度 | 全局单 Key | 首期无多用户需求；最简实现；不设置即等同于无鉴权（开发友好） |
| Health 不需要鉴权 | 是 | 健康检查是运维基础设施，必须无条件可达 |
| 请求体限制 | 1MB 默认 | 防止超长 prompt 导致 OOM；Agent 输入超过此长度属于异常用例 |
| `/_internal/*` 不需要 API Key | 是（已有 loopback 限制） | 内部管理 API 的安全边界由网络隔离（loopback）保证 |
| 优雅退出超时 | 30s | 与 `run_script` 执行超时一致；给 SSE 流足够时间完成 |
