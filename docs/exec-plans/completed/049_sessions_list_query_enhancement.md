# 049 Sessions 列表查询增强（GET /v1/sessions）

## 目标

扩展 `GET /v1/sessions` 的查询能力，使客户端（含 CLI `--continue`、operator 工具）能 **稳定、可分页地** 按业务维度筛选会话，而不依赖「全量拉取后在客户端过滤」。

本期最小增量（冻结）：

1. **`agentId` 过滤**：`?agentId=<id>` 仅返回该 agent 的会话（与 `sessions.agent_id` 列对齐）。
2. **时间游标**：`?before=<createdAt_ms>` 仅返回 `created_at < before` 的记录（与列表 `ORDER BY created_at DESC` 组合，用于稳定翻页）。
3. **合同与文档**：`ListSessionsRequest` / server 实现 / `THIRD_LAYER_COVERAGE` 一致；**不改变** 现有 `kind`、`limit`、`offset` 语义。

> 说明：当前 server 与 contract 已支持 `kind` 查询参数（见 `http-server.ts` 与 `ListSessionsRequest`）。本工作单 **不重复**「仅加 kind」；若实现时发现与文档不一致，以「对齐文档」为验收子项，不扩大 scope。

---

## 背景

- [`active/README`](../active/README.md) 原「建议 049」指向本能力。
- `packages/server/src/db/repositories.ts` 中 `listAll` 目前支持 `kind + limit + offset`，**不支持** `agentId` / `before` 组合索引路径。

---

## 修改范围（冻结）

**允许修改：**

- `packages/shared/contracts/src/index.ts` — 扩展 `ListSessionsRequest`（`agentId?`、`before?`）；必要时扩展响应 `hasMore` 计算约定（若当前仅用 `total` 推断，则文档化行为）。
- `packages/server/src/db/repositories.ts` — `SessionRepository.listAll` / `count` 支持新参数（新增 prepared statement，避免 SQL 拼接注入）。
- `packages/server/src/http-server.ts` — 解析 query、传入 repository。
- `packages/sdk/client/src/index.ts` — `listSessions` 传参透传（若类型已兼容则仅补 JSDoc）。
- `packages/sdk/operator-client/src/index.ts` — 若 operator 暴露 `listSessions`，同步参数。
- `scripts/test-session-message.mjs` 或新建 `scripts/test-sessions-list.mjs` — 覆盖 `kind` + `before` + `agentId` 至少各一条断言路径。
- `docs/architecture-docs-for-agent/third-layer/THIRD_LAYER_COVERAGE.md` — 更新矩阵。

**禁止修改：**

- `packages/core/` — 运行时不变。
- `packages/channel-core/` — 不在范围。
- **不加** sessions 表新列（`agent_id` 已存在则只用查询；若列不存在则本单 **停止** 并走升级条件）。

---

## 接口与行为（冻结）

- Query 参数全部为 **可选**；未传行为与当前一致。
- `before` 为毫秒时间戳；非法值返回 **400** + 稳定 `code`（与现有 envelope 错误风格一致）。
- `agentId` 与 `kind` 可同时生效（AND）。
- 排序：**仍** `created_at DESC`（与现有一致）。

---

## 验收标准

1. `pnpm check` 通过。
2. `pnpm verify` 通过（新或扩展现有 smoke 已挂入 verify）。
3. 手工或脚本：`GET /v1/sessions?kind=chat&before=...` 与 `?agentId=...` 返回集合符合过滤语义。

---

## 升级条件

- 需要 **新增 DB 列** 才能表达 `agentId`（当前 schema 无该语义字段）→ 停止，另开 migration 工作单。
- 需要破坏 `ListSessionsResponseBody` 形状（非可选扩展）→ 停止，升级评审 contract 版本策略。

---

## 必跑命令

```bash
pnpm check
pnpm verify
```

---

## 不做什么

- 不在本单实现「全文搜索 session」「按 title 搜索」（无字段）。
- 不修改 `POST /v1/sessions` 创建语义。
- 不实现 GraphQL 或第二套 list API。
