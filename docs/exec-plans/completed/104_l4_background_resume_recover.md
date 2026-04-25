# 104 · L4 Background Resume Recover

## 目标

建立本地 background / attach / detach / resume / interrupt / recover 产品工作流，让 CLI/TUI 能承接长时间工程任务。

本单聚焦 single-agent 本地连续性，不做 remote continuity 或 multi-agent workflow。

## 背景

`090` 已冻结 run lifecycle hints，`046` 提供 session run 列表，`052` 提供 cancel，`091` 提供 event plane 基础。L4 需要把这些组合成产品语义：

- foreground / background
- attached / detached
- resume / continue
- interrupt / cancel
- failed recover
- approval blocked 后继续
- restart 后可见

## 已冻结决策

1. 本单使用 L3 run/session/task primitives 组合本地产品能力。
2. 首期不承诺跨设备或远程恢复。
3. 背景状态应通过 CLI/TUI 可见，而不是只存在于服务内部。
4. recover 是产品语义，可以先定义可执行路径和限制，不要求自动修复所有失败。

## 允许修改

- `packages/cli/src/`
- `packages/sdk/operator-client/src/`（仅限 session runs / trace / approval / status helper）
- `scripts/`
- `docs/architecture-docs-for-agent/fourth-layer/`
- `docs/architecture-docs-for-human/backend-plan/layer4-design/`
- `docs/exec-plans/active/`
- 根 `package.json`（仅脚本）

## 禁止修改

- L3 run schema 大改
- `packages/core/src/run-engine.ts` 主状态机重写
- `packages/sdk/client/`
- `packages/channel-core/`
- L5 remote continuity
- L6 workflow scheduler

## 低能力模型执行前必须先读

- `AGENTS.md`
- `docs/index.md`
- `docs/governance/MODEL_OPERATING_MODES.md`
- `098_l4_engineering_product_shell_parent.md`
- `090_l3_run_identity_and_lifecycle.md`
- `091_l3_unified_event_plane.md`
- `093_l3_approval_and_danger_protocol.md`
- `scripts/test-session-runs.mjs`
- `scripts/run-run-cancel-smoke.ts`
- [`103`](../completed/103_l4_permission_approval_product_flow.md)（审批阻塞后续路径）

## 本轮范围

1. 定义 L4 background / attach / detach / resume / recover vocabulary。
2. 增加本地 CLI/TUI 查看 active/background/recent runs 的入口。
3. 提供 interrupt / cancel / continue / resume 的本地工作流。
4. 为 failed / cancelled / approval-blocked 状态提供 recover 提示。
5. 增加自动化验证覆盖至少一种 resume 或 recover product path。

## 本轮不做

- 不做跨机器恢复。
- 不做云端 run registry。
- 不做多 agent workflow resume。
- 不做所有失败类型的自动修复。
- 不做 channel / Web / Desktop continuity。

## 验收标准

1. 用户能在本地产品壳查看最近 runs 与状态。
2. 用户能 interrupt/cancel 正在运行或可取消的 run。
3. 用户能从 session 或 run 入口继续工作。
4. 失败、取消、审批卡住等状态有明确 recover 提示。
5. `pnpm check` 通过。
6. `pnpm verify` 通过。

## 必跑命令

```bash
pnpm check
pnpm verify
```

## 升级条件

1. 需要新增全局 run registry 或修改 L3 run list schema。
2. 需要重写 run engine 才能实现恢复。
3. 需要将本地 resume 直接扩展成 remote continuity。
4. `pnpm verify` 连续两轮不通过。
