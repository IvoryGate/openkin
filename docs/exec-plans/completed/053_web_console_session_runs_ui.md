# 053 Web Console 会话增强（Runs 与展示名）

## 目标

在 [`apps/web-console`](../../apps/web-console) 中增强 **会话详情/列表** 的可观测性：

1. 展示 **Session Runs** 列表（消费 `GET /v1/sessions/:id/runs` 或等价 client 封装）。
2. 当 **050** 交付后，展示并允许编辑 **服务端 `displayName`**（若 050 未合并，本单 **仅做 runs UI**，展示名字段为可选后续 PR）。

---

## 背景

- [`046`](../completed/046_session_runs_api.md) 已定义 runs 列表 API。
- [`active/README`](../active/README.md) 原「建议 053」。

---

## 修改范围（冻结）

**允许修改：**

- `apps/web-console/**` — 路由、视图组件、调用 server 的 fetch 封装。
- 若缺少 typed client：可在 `packages/sdk/client` 增加 **只读** `listSessionRuns`（若尚未存在）；**禁止** 在本单大范围改 SDK。

**禁止修改：**

- `packages/server/` — 无新 endpoint 需求时不动；若发现 API 缺口 → **升级条件**，回退到 049/050/046 等工作单。
- `packages/core/` — 不在范围。

---

## 与依赖工作单的关系（冻结）

| 依赖 | 说明 |
|------|------|
| 046 | **硬依赖**：runs 列表 API 必须可用。 |
| 050 | **软依赖**：展示名编辑；未就绪时 UI 不显示编辑控件即可。 |

---

## 验收标准

1. `pnpm check`（含 `vue-tsc`）通过。
2. `pnpm verify` 通过；根 `verify` 继续依赖 `pnpm check` 覆盖 `vue-tsc`，并显式运行 `pnpm build:web-console` 作为构建门禁。
3. 用户在 Web 中打开某 session 可见 runs 表（至少列：traceId、status、createdAt）。

---

## 升级条件

- 需要 **新 server API**（非 046/050 能覆盖）→ 停止本单 UI，先开 API 单。

---

## 必跑命令

```bash
pnpm check
pnpm verify
```

---

## 不做什么

- 不做 **完整 observability 大屏**（指标图表另单）。
- 不在本单实现 **SSE 实时刷新 runs**（可后续增强）；首版允许手动刷新或进入页面时拉取。
