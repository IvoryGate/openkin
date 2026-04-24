# 050 Session 展示名 / 重命名 API（PATCH /v1/sessions/:id）

## 目标

提供 **服务端持久化** 的会话展示字段（如 `displayName` / `name`），使 Web Console、CLI `/rename`、以及未来「按名 resume」可统一以 **同一数据源** 为准，替代仅 CLI 本地文件的别名方案（可与现有本地别名 **并存一段过渡期**，具体消费策略由后续 CLI 工作单决定，**本单不强制删除** CLI 文件别名）。

---

## 背景

- [`active/README`](../active/README.md) 原「建议 050」。
- 当前 `SessionDto` 无人类可读名称字段；`/rename` 若仅存本地 JSON，多机与 Web 不一致。

---

## 修改范围（冻结）

**允许修改：**

- `packages/shared/contracts/src/index.ts` — `SessionDto` 增加可选 `displayName`（或 `name`，**二选一在实现前写入本节「决策记录」**）；`PATCH` 请求/响应 body 类型；`apiPathSession(id)` 路由常量若需 PATCH 子路径则补充。
- `packages/server/src/db/` — migration 或 schema 初始化：sessions 表增加 **可空** `display_name`（或等价列名与 TS 映射一致）。
- `packages/server/src/http-server.ts` — `PATCH /v1/sessions/:id`：仅允许更新展示名（及文档规定的白名单字段），**禁止** 通过 PATCH 改 `kind` / 伪造 `id`。
- `packages/sdk/client/src/index.ts` — `patchSession` 或 `updateSessionDisplayName` 方法。
- `scripts/` — 相应 smoke（`test-session-message` 或独立脚本）+ `package.json` / `verify` 注册。
- `docs/architecture-docs-for-agent/third-layer/THIRD_LAYER_COVERAGE.md`。

**禁止修改：**

- `packages/core/` — 消息与 Run 语义不变。
- 不在本单实现「删除消息 / rewind」（见 052 等）。

---

## 决策记录（已冻结）

| 项 | 冻结选择 |
|----|----------|
| 字段名 | `displayName`（DTO / SDK / Web 统一用 camelCase；DB 列为 `display_name`） |
| 最大长度 | 256 字符；超长返回 **400** |
| 鉴权 | 与现有 `GET /v1/sessions/:id` 一致；无额外 RBAC |

---

## 验收标准

1. `pnpm check` / `pnpm verify` 通过。
2. `PATCH` 后 `GET` session 或 `list` 中可见更新字段。
3. 非法 sessionId → **404**；非法 body → **400**。

---

## 升级条件

- 需要 **跨 session 批量 rename** → 新工作单。
- 需要 **审计日志 / 多租户隔离** → 新工作单。

---

## 必跑命令

```bash
pnpm check
pnpm verify
```

---

## 不做什么

- 不修改 CLI 行为（CLI 消费 050 属于 **054** 或独立 055 级工作单）。
- 不在本单引入 Web Console UI（见 **053**）。
- 不在本单移除 CLI 本地 `session-alias` 文件；服务端 `displayName` 与本地 alias 允许并存，统一消费策略另开单收口。
