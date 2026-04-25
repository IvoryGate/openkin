# 052 Run 取消 API（operator / client surface）

## 目标

提供 **显式取消** 进行中的 Run 的能力，为 CLI/Web 的「停止生成」、超时治理与后续 `/rewind` 前置能力提供 **协议锚点**。

本期最小增量（冻结）：**一种** HTTP 语义（`POST` 取消 或 `DELETE`，**实现前在决策记录勾选**），作用于 `traceId`（与现有 trace/run 模型一致）。

---

## 背景

- [`active/README`](../active/README.md) 原「建议 052」。
- 当前流式 Run 可能长时间占用；无标准取消面时，客户端只能断连，**服务端状态**可能长期 `running`。

---

## 修改范围（冻结）

**允许修改：**

- `packages/shared/contracts/src/index.ts` — path helper、请求/响应 envelope（成功 noop / 202 / body 形状在决策记录冻结）。
- `packages/server/src/http-server.ts` — 新路由；与内存 `TraceStreamHub` / run 调度器协作 **中止** 后续 LLM/tool 步骤（具体实现可标记 run `cancelled` 与现有 `RUN_CANCELLED` 错误码对齐）。
- `packages/sdk/client/src/index.ts` 或 `operator-client` — **择一** 暴露给调试工具（与 046 `session runs` 归属策略一致，写在决策记录）。
- `scripts/` — smoke：发起长 run → cancel → 终态符合预期。
- `docs/architecture-docs-for-agent/third-layer/THIRD_LAYER_COVERAGE.md`。

**禁止修改：**

- 不改变 **已完成** run 的 DB 历史行语义（不物理删除 trace）。
- 不在本单实现 **批量 cancel all sessions**。

---

## 决策记录（已冻结）

| 项 | 冻结选择 |
|----|----------|
| HTTP 方法 | `POST /v1/runs/:traceId/cancel` |
| 表面归属 | `client-sdk`；`operator-client` 继续只承接观测与运维入口 |
| 幂等 | 重复 cancel 已终态 run：**200**，返回 `{ cancelled: false, reason: 'already_finished' }` |

## 收口说明

- 本单冻结的能力边界是“普通客户端可显式请求停止自己的 in-flight run”，因此保持在 `packages/sdk/client`，不把 cancel 混入 operator surface。
- 当前实现以进程内 `AbortController` 为锚点：命中活跃 run 时返回 `{ cancelled: true }`；命中已终态 run 时返回幂等 noop；未知 `traceId` 或非活跃 run 返回 **404**。
- 本单不承诺跨进程分布式 cancel，也不新增 cancel 审计表；若未来需要多副本协同，必须另开 ADR / 工作单。

---

## 验收标准

1. `pnpm check` / `pnpm verify` 通过。
2. smoke：取消后 run 不再产生新 tool/文本事件；终态与文档一致（现由 `pnpm test:run-cancel` 覆盖 active-run 取消路径，`pnpm test:sdk` 覆盖已终态 run 的幂等 noop）。
3. 未知 `traceId` → **404**。

---

## 升级条件

- 需要 **新 DB 表** 表达 cancel 事件审计 → 可接受小 migration，若超过「单列/单表」范围则拆单。
- 需要 **跨进程分布式 cancel**（多副本 server）→ 停止，另开 ADR。

---

## 必跑命令

```bash
pnpm check
pnpm verify
```

---

## 不做什么

- 不实现 **消息级删除**（rewind）。
- 不实现 **用户级 rate limit**（另单）。
