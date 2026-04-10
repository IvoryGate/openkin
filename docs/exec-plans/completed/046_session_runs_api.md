# 046 Session Runs API

## 目标

在第三层 operator surface 补充一个缺失的 Run 列表接口：

```
GET /v1/sessions/:sessionId/runs
```

支持 `?status=running|completed|failed` 过滤。

这个接口填补了当前诊断 Server 卡顿时（想知道哪些 Run 卡在 `running` 状态）的缺口。

---

## 背景

`THIRD_LAYER_COVERAGE.md` 中已标记「活跃 Run 列表」为 ⬜ 待规划。当前 `agent_run_traces` 表已经持久化了所有 Run 的最终状态；Server 侧内存中对活跃 Run 并无额外持久化，因此：

- `running` 状态的 Run 只在内存 `TraceStreamHub` 中有 `reserve` 记录（进程重启后消失）
- `completed` / `failed` 状态的 Run 完整保存在 DB 的 `agent_run_traces` 表

**取舍决策（已冻结）：**

1. 接口只查 DB（`agent_run_traces`），不尝试从内存 `streamHub` 判断 running 状态
2. 之所以如此：持久化 Run 的终态足以覆盖 Debug 用例；真正「活跃」的判断依赖内存状态，进程重启后无意义，且与持久化语义不一致
3. 如果 `status=running` 被传入，则返回 DB 中 `status='running'` 的行（这种行在进程崩溃后会成为"孤儿 running"，可用于诊断上次崩溃）
4. 接口归属 **operator surface**，与 `GET /v1/sessions/:id/traces` 平行，不进入 `packages/sdk/client`

---

## 修改范围（冻结）

**允许修改：**

- `packages/shared/contracts/src/index.ts` — 新增 `apiPathSessionRuns(sessionId)` 函数与 `ListSessionRunsResponseBody` 类型
- `packages/server/src/http-server.ts` — 新增路由 `GET /v1/sessions/:id/runs`
- `packages/server/src/db/repositories.ts` — 确认 `traces.listBySession` 支持 status 过滤（如不支持则扩展）
- `packages/sdk/operator-client/src/index.ts` — 新增 `listSessionRuns(sessionId, params?)` 方法
- `scripts/test-introspection.mjs` 或新增 `scripts/test-session-runs.mjs` — 补充 smoke test
- `package.json` — 如新增 smoke 则注册 `test:session-runs` 脚本并追加到 `verify`
- `docs/architecture-docs-for-agent/third-layer/THIRD_LAYER_COVERAGE.md` — 更新状态矩阵

**禁止修改：**

- `packages/core/` — 核心运行时不变
- `packages/sdk/client/` — client surface 不变
- `packages/channel-core/` — 通道层不变
- DB schema（`agent_run_traces` 表结构）— 不加列，只是查询层

---

## 接口设计（冻结）

```
GET /v1/sessions/:sessionId/runs
  ?status=running|completed|failed   (可选，不传返回全部)
  ?limit=<n>                          (可选，默认 20，最大 100)
  ?before=<timestamp_ms>              (可选，时间游标)
```

**响应格式：**

```json
{
  "ok": true,
  "data": {
    "runs": [
      {
        "traceId": "...",
        "sessionId": "...",
        "agentId": "...",
        "status": "completed",
        "stepCount": 3,
        "durationMs": 1234,
        "createdAt": 1712345678000
      }
    ],
    "hasMore": false
  }
}
```

复用现有 `TraceSummaryDto`（`packages/shared/contracts/src/index.ts` 已定义）。

---

## 验收标准

1. `pnpm check` 通过
2. `pnpm verify` 通过（新 smoke 已注册进 verify）
3. 手工验证：
   - 发起一个 run 后调用 `GET /v1/sessions/:id/runs` 能看到该 run 记录
   - `?status=completed` 只返回已完成的 run
   - 不存在的 sessionId 返回 404

---

## 升级条件

如遇到以下情况停止并升级到 high-capability mode：

- 需要修改 DB schema
- 需要改 `TraceSummaryDto` 的字段定义
- 需要把这个接口同时暴露到 client surface
- `pnpm verify` 连续两轮不通过

---

## 必跑命令

```bash
pnpm check
pnpm verify
```

---

## 不做什么

- 不做内存层的 active run 查询（只查 DB）
- 不把这个接口加到 `packages/sdk/client`
- 不改 Web Console UI
