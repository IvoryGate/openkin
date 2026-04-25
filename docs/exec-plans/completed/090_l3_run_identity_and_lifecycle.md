# 090 · L3 Run Identity And Lifecycle

## 目标

在第三层冻结一套可被后续事件、调度、审批、恢复能力共同依赖的 Run / Session 生命周期语义。

本单只解决“系统如何稳定标识一次运行与其生命周期状态”，不解决第四层如何把它展示成完整产品体验。

## 背景

根据 `ENGINEERING_PRODUCT_CAPABILITIES.md`，第四层后续需要：

- foreground / background session
- attach / detach / resume
- blocked-by-approval
- failed-but-recoverable

如果第三层没有稳定的 Run identity 与状态模型，后续 `091–095` 都会在不同地方重复定义状态词汇。

## 已冻结决策

1. 本单先冻结 **语义与 contract**，不直接实现第四层 UX。
2. 不新增 client-facing 产品交互；必要变更优先落在 operator / event / internal substrate。
3. 不在本单引入 multi-agent、workflow、team 等第六层对象。
4. 如需新增状态，必须明确它属于：
   - persistence state
   - event state
   - approval / recovery state
   不能混成一套模糊枚举。

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

- `packages/core/src/` 主运行语义
- `packages/sdk/client/`
- `packages/channel-core/`
- `packages/cli/src/tui/`
- `apps/web-console/`

## 低能力模型执行前必须先读

- `AGENTS.md`
- `docs/index.md`
- `docs/governance/MODEL_OPERATING_MODES.md`
- `docs/architecture-docs-for-agent/third-layer/THIRD_LAYER_COVERAGE.md`
- `docs/architecture-docs-for-human/backend-plan/layer3-design/LAYER3_DESIGN.md`
- `docs/architecture-docs-for-agent/fourth-layer/ENGINEERING_PRODUCT_CAPABILITIES.md`
- 与 run / stream / traces / tasks 直接相关的 server/contracts 文件

## 本轮范围

1. 冻结第三层的 run identity 对象与状态集合
2. 明确 foreground / background / resumable / blocked / recoverable 的协议归属
3. 明确 attach / detach / resume / interrupt 在第三层的最小服务语义
4. 补充或更新相应 DTO、route contract、operator 查询或状态字段
5. 为后续 `091` 事件层提供可依赖的状态 vocabulary

## 本轮不做

- 不做 CLI / TUI attach UI
- 不做 background session 产品流
- 不做多 agent 运行对象
- 不做 channel continuity

## 验收标准

1. 第三层文档明确列出新的 run lifecycle 语义
2. 至少有一条自动化验证覆盖：
   - foreground run
   - blocked / cancelled / recoverable 之一
3. 后续 `091–095` 可以直接引用本单定义的状态 vocabulary
4. `pnpm check` 通过
5. `pnpm verify` 通过

## 必跑命令

```bash
pnpm check
pnpm verify
```

## 升级条件

出现以下任一情况立即停止并升级：

1. 需要修改 core run-engine 主状态机
2. 需要把新 lifecycle 语义直接暴露到 `packages/sdk/client`
3. 发现 run / session / task 三者的边界无法在 L3 内独立冻结
4. `pnpm verify` 连续两轮不通过

---

## 验收记录

**状态**：已完成（2026-04-16）

- **Contract**：`RunId`；`RunExecutionMode` / `RunStreamAttachment` 与默认常量；`CreateRunRequest` / `CreateRunResponseBody`；`TraceDto` / `TraceSummaryDto` 含生命周期字段终态
- **Server**：`runLifecycleMeta` 内存表 + `parseRunLifecycleHints`；`POST /v1/runs` 返回 `executionMode` + `streamAttachment`；`GET` trace 与会话 run 列表合并元数据
- **文档**：`docs/architecture-docs-for-human/backend-plan/layer3-design/L3_RUN_LIFECYCLE.md`；`THIRD_LAYER_COVERAGE.md` 小节；`LAYER3_DESIGN.md` 链入
- **Operator SDK**：`@theworld/operator-client` 重导出 `RunId` / `RunExecutionMode` / `RunStreamAttachment`
- **自动化**：
  - `foreground`：`test:session-runs`、`test:sdk`（`run-sdk-smoke`）校验默认 `foreground`+`attached`
  - `cancelled`：既有 `test:run-cancel`（`run-run-cancel-smoke`）+ 本单对响应体字段断言
- **未做单测**：`blocked`（留 093）；`recoverable` 在 `L3_RUN_LIFECYCLE.md` 中说明为对 `RunError.retryable` + 新 run 的语义，不新增独立脚本

父单 `089` 下一子单：**091 Unified Event Plane**。
