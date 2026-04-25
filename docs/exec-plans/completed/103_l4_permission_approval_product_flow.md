# 103 · L4 Permission Approval Product Flow

## 目标

把 L3 approval / danger protocol 组合成本地 CLI/TUI 中可见、可控、可恢复的权限与审批产品流。

本单让危险操作提醒和审批不再只是协议，而是用户能理解和操作的工程产品能力。

## 背景

`093` 已提供：

- `RiskClassDto`
- approval REST API
- approval SSE
- approve / deny / cancel / expired 语义

但 L4 仍缺少：

- 当前 permission mode 展示
- 危险命令显式提醒
- 待审批状态
- 批准后继续执行
- 拒绝后的恢复路径
- 审批记录可追踪

## 已冻结决策

1. 本单做 L4 产品流，不重写 L3 approval schema。
2. 首期可通过 CLI/TUI 组合现有 approval API，不要求工具 runtime 全自动拦截所有危险操作。
3. 危险工具 metadata 必须和 `096` 的 `ToolEntryDto.riskClass` / `category` 对齐。
4. Approval flow 是本地产品能力，不扩展为 L5 remote approval continuity。

## 允许修改

- `packages/cli/src/`
- `packages/sdk/operator-client/src/`（仅限 approval API helper）
- `scripts/`
- `docs/architecture-docs-for-agent/fourth-layer/`
- `docs/architecture-docs-for-human/backend-plan/layer4-design/`
- `docs/exec-plans/active/`
- 根 `package.json`（仅脚本）

## 禁止修改

- `packages/core/src/` 主工具执行策略
- `packages/server/src/approval-plane.ts` schema / route 语义（除非发现 bug，需升级）
- `packages/sdk/client/`
- `packages/channel-core/`
- Web / Desktop / channel approval continuity
- 完整 policy engine

## 低能力模型执行前必须先读

- `AGENTS.md`
- `docs/index.md`
- `docs/governance/MODEL_OPERATING_MODES.md`
- `098_l4_engineering_product_shell_parent.md`
- `093_l3_approval_and_danger_protocol.md`
- `096_l3_tooling_exposure_and_introspection.md`
- `scripts/test-approval.mjs`
- `scripts/test-introspection.mjs`

## 本轮范围

1. 定义 L4 permission mode 与 approval product states。
2. 在 CLI/TUI 中展示 risky tools / pending approvals / resolution。
3. 提供本地 approve / deny / cancel 操作入口。
4. 定义 denied / expired 后的用户恢复提示。
5. 增加自动化验证覆盖 approval product flow 或 CLI output。

## 本轮不做

- 不做远程审批。
- 不做 channel 侧审批。
- 不做完整 sandbox / policy engine。
- 不保证所有工具调用自动阻断；若需要，应升级为后续 L3/L4 协同设计。
- 不做 L6 workflow approval gate。

## 验收标准

1. 用户能在本地产品壳看到待审批项与风险类别。
2. 用户能通过本地 CLI/TUI approve / deny / cancel。
3. denied / expired 状态有明确恢复或继续提示。
4. 工具风险展示与 `GET /v1/tools` metadata 对齐。
5. `pnpm check` 通过。
6. `pnpm verify` 通过。

## 必跑命令

```bash
pnpm check
pnpm verify
```

## 升级条件

1. 需要让 core tool runtime 强制 gate 所有危险工具。
2. 需要修改 L3 approval DTO 或 route。
3. 需要设计 remote / channel approval continuity。
4. `pnpm verify` 连续两轮不通过。

---

## 关账与交付

- 登记表：`L4_APPROVAL_PRODUCT_FLOW.md`；`L4_PRODUCT_SHELL_MAP` / `THIRD_LAYER_COVERAGE` 已写清 `GET /v1/approvals` 列表
- 服务器：`ApprovalPlane.listAll()`；`GET /v1/approvals` 返回 `ListApprovalsResponseBody`
- `operator-client`：`listApprovals`、`getApproval`、`createApproval`、`approveApproval`、`denyApproval`、`cancelApproval`
- CLI：`l4-approval-surface.ts`；`inspect approvals`；`inspect approval <id> [approve|deny|cancel]`；`inspect tools` 行内 `risk` / `cat`；`inspect status` 提醒；`chat` 灰字；`slash` `/approvals`
- TUI：rail 在 ctx+mem 后追加 `appr·N pending`（`listApprovals` + 当前 session 过滤）
- 自动化：`pnpm test:l4-approval`（已并入 `verify`）

**下一子单：[`104`](./104_l4_background_resume_recover.md).**
