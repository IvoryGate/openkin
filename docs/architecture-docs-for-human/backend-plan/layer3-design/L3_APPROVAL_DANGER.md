# L3 · Approval and danger protocol（093）

本文件冻结第三层**风险分类**与**审批**的请求/响应与状态语义，供第四层在本地工程壳中实现危险命令提醒、审批、拒绝与「放行后继续」而不在第三层内嵌产品 UI。

与 **持久化 `RunFinalStatus`（090）** 的关系见 [L3_RUN_LIFECYCLE.md](./L3_RUN_LIFECYCLE.md)：`awaiting_approval` 不写入该枚举，审批对象独立生命周期。

## 风险分类 `RiskClassDto`

| 值 | 说明 |
|----|------|
| `shell_command` | 执行或拟执行系统 / Shell 命令（含 `run_command` 等） |
| `file_mutation` | 写文件、覆盖、删除等文件系统副作用 |
| `network` | 外呼网络或下载 |
| `destructive` | 不可逆或大范围破坏（可与其他类重叠；用于强调严重度） |

新类别若进入 contract，应同步版本化 `RiskClassDto`，避免随意扩展字符串。

## 审批状态 `ApprovalStatusDto`

| 值 | 说明 |
|----|------|
| `pending` | 已创建，等待人审或超时 |
| `approved` | 已同意（L4+ 可继续执行被拦动作） — **与「resume」对审批对象而言等价** |
| `denied` | 已拒绝，不应再执行被拦动作 |
| `expired` | 超时未决（**timeout 语义**与 `expired` 对齐） |
| `cancelled` | 在仍为 `pending` 时被显式取消（如用户关单） |

`ttlMs` 省略时默认 5 分钟；`ttlMs: 0` 表示不自动到期，只能通过 approve / deny / cancel 收束。

## API（operator 面、进程内）

- `POST /v1/approvals` — 创建 `ApprovalRecordDto`（L4+ 在工具前缘调用；本仓库 smoke 可直连验协议）
- `GET /v1/approvals/:id` — 当前记录
- `POST /v1/approvals/:id/approve` — 体可选 `reason` — **放行**
- `POST /v1/approvals/:id/deny` — 体可选 `reason` — **拒绝**
- `POST /v1/approvals/:id/cancel` — 挂起中取消
- `GET /v1/approvals/events` — SSE；`data` 为 `EventPlaneEnvelopeV1`，`domain: approval`

实现为**内存**状态；重启丢失。审计与跨副本以未来持久化/094+ 为准。

## 事件 `ApprovalEventDto`

- `type: 'approval_requested'`：新建待审
- `type: 'approval_resolved'`：终态，且 `resolution` 为 `approved` | `denied` | `expired` | `cancelled`

`approvalEventToPlaneEnvelope`（`packages/shared/contracts`）与 [L3_EVENT_PLANE.md](./L3_EVENT_PLANE.md) 的 `domain: approval` 行一致。

## 与 Run / 工具执行

093 **不**在 `packages/core` 主工具管线上自动拦截；L4+ 在调用 `POST /v1/runs` 或工具前后根据本协议**自行**创建审批并消费事件。本单提供稳定 operator substrate 与 `pnpm test:approval` 可重复验证。

父单 `089`：094 已收口；下一 substrate 子单以 `089` 队列为准（如 **095 Multimodal contract**）。
