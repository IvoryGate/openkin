# 093 · L3 Approval And Danger Protocol

## 目标

在第三层冻结危险操作分类与审批协议，使后续第四层可以把危险命令提醒、审批、继续执行、拒绝恢复做成正式产品流。

## 背景

用户明确要求：

- 有危险的东西必须提醒用户
- 危险命令不能默默执行
- approval 不能只是一段临时 UI 逻辑

这意味着第三层至少要先提供：

- risk classification
- approval request / response payload
- deny / timeout / resume semantics

## 已冻结决策

1. 本单做 **协议与基础状态**，不做第四层最终交互界面。
2. 风险分类必须至少覆盖：
   - shell / command
   - file mutation
   - network
   - destructive action
3. 本单不追求完整安全体系终态，但必须建立稳定协议。
4. approval 协议优先作为 operator / product-shell-facing substrate，不直接扩进 L5 多入口 continuity。

## 允许修改

- `packages/shared/contracts/src/`
- `packages/server/src/`
- `packages/sdk/operator-client/src/`
- `scripts/`
- `docs/architecture-docs-for-agent/third-layer/`
- `docs/architecture-docs-for-human/backend-plan/layer3-design/`
- `docs/exec-plans/active/`
- 根 `package.json`（仅脚本）

## 禁止修改

- `packages/core/src/` 主工具执行实现
- `packages/sdk/client/`
- `packages/channel-core/`
- `packages/cli/src/tui/`
- `apps/web-console/`

## 低能力模型执行前必须先读

- `AGENTS.md`
- `docs/index.md`
- `docs/governance/MODEL_OPERATING_MODES.md`
- `090_l3_run_identity_and_lifecycle.md`
- `091_l3_unified_event_plane.md`
- 与 tool permissions / errors / run state 直接相关的 contracts 与 server 文件

## 本轮范围

1. 冻结 risk classes
2. 冻结 approval request / response payload
3. 冻结 deny / timeout / resume / expired 语义
4. 让危险操作能通过第三层状态与事件被观察
5. 为第四层危险命令提醒与审批 UX 提供稳定 substrate

## 本轮不做

- 不做最终审批界面
- 不做跨 surface 审批 continuity
- 不做 channel-specific approval policy
- 不做完整 policy engine

## 验收标准

1. 第三层文档明确列出风险分类与 approval 状态
2. 至少有一条自动化验证覆盖：
   - approval requested
   - denied / timeout / resume 之一
3. 后续第四层可以直接消费本单协议实现危险命令提醒
4. `pnpm check` 通过
5. `pnpm verify` 通过

## 必跑命令

```bash
pnpm check
pnpm verify
```

## 升级条件

1. 需要重写底层工具权限架构
2. 需要把审批协议直接扩展为 L5 remote approval continuity
3. 风险分类无法在不改 core 主语义的前提下冻结
4. `pnpm verify` 连续两轮不通过

---

## 验收记录

**状态**：已完成（2026-04-16）

- **Contract**：`RiskClassDto`、`ApprovalStatusDto`、`ApprovalRecordDto`、`ApprovalEventDto`；路径 `apiPathApprovals` / `apiPathApprovalEvents` 等；`approvalEventToPlaneEnvelope`
- **Server**：`ApprovalPlane`（内存 + TTL 扫瞄 + SSE）；`createTheWorldHttpServer` 暴露 `approvalPlane`；路由 `POST/GET /v1/approvals`、`…/approve|deny|cancel`、`GET /v1/approvals/events`
- **语义**：`denied`（拒绝）、`expired`（短 TTL 超时 = timeout）、`approved`（resume/放行门闩）
- **文档**：`L3_APPROVAL_DANGER.md`；`L3_EVENT_PLANE` / `L3_RUN_LIFECYCLE` / `LAYER3_DESIGN` / `THIRD_LAYER_COVERAGE` 更新
- **Operator SDK**：类型与 `apiPathApproval*` 重导出
- **自动化**：`pnpm test:approval`
- **说明**：不修改 core 工具主路径；L4+ 在工具前缘调用 `POST /v1/approvals` 并消费 SSE
- **验收补充**：`ApprovalPlane` 的 TTL 扫描 timer 已 `unref`，并在 HTTP server `close` 时清理 SSE clients 与 timer，避免嵌入式 server 关闭后残留句柄。

父单 `089` 下一子单：**094 Context memory descriptors**。
