# L4 Single-Agent Plan → Review → Execute（105）

## 目标

提供 **单 agent** 的本地 plan 工件、显式 review gate（accept / revise / cancel）与执行入口；**不**替代 L3 危险工具审批。

## 工件

- 路径：`<cwd>/.theworld/plan/state.json`（`PlanArtifactV1`）；可选 `THEWORLD_PLAN_CWD` 覆盖基准目录（测试用）
- CLI：`theworld plan init | show | status | review … | execute --session <id>`

## 实现

- `packages/cli/src/l4-plan-workflow.ts` — load/save、模板、`formatPlanHuman`
- `packages/cli/src/cmd-plan.ts`

## 验收

- `pnpm test:l4-plan`

## 相关

- [L4_PRODUCT_SHELL_MAP.md](./L4_PRODUCT_SHELL_MAP.md)
- 执行计划（归档）：`docs/exec-plans/completed/105_l4_single_agent_plan_review_execute.md`
