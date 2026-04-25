# 101 · L4 Context Engineering Surface

## 目标

把 L3 `ContextBuildReportDto` 与 `GET /v1/runs/:traceId/context` 产品化为本地 CLI/TUI 可见、可解释、可调试的 context engineering surface。

本单让“上下文如何被构建和压缩”从内部机制变成用户能理解的产品能力。

## 背景

`094` 已提供 context / compact / memory descriptors，但当前本地产品仍缺少：

- 当前上下文占用显示
- compact 边界显示
- prompt source breakdown
- memory contribution visibility
- 当前有效上下文摘要

## 已冻结决策

1. 本单消费 L3 descriptors，不重写第一层压缩算法。
2. CLI 和 TUI 应共享同一套 context summary 模型。
3. 首期以 inspect / status / TUI panel 为主，不做完整可编辑 context policy。
4. token 数可以沿用 L3 估算语义，不要求真实 tokenizer。

## 允许修改

- `packages/cli/src/`
- `packages/sdk/operator-client/src/`（仅限封装 `apiPathRunContext` / context report 读取）
- `scripts/`
- `docs/architecture-docs-for-agent/fourth-layer/`
- `docs/architecture-docs-for-human/backend-plan/layer4-design/`
- `docs/exec-plans/active/`
- 根 `package.json`（仅脚本）

## 禁止修改

- `packages/core/src/context.ts` 主算法
- `packages/server/src/context-build-hook.ts`（除非发现 L3 bug，需升级）
- `packages/sdk/client/`
- `packages/channel-core/`
- L5/L6 文档与实现

## 低能力模型执行前必须先读

- `AGENTS.md`
- `docs/index.md`
- `docs/governance/MODEL_OPERATING_MODES.md`
- [`098`](../active/098_l4_engineering_product_shell_parent.md)
- `../completed/099_l4_product_control_plane_and_shell_map.md`
- `../completed/100_l4_onboarding_setup_discoverability.md`
- `094_l3_context_memory_descriptors.md`
- `scripts/test-context-descriptors.mjs`

## 本轮范围

1. 增加本地 context inspect 命令或 surface。
2. 将 blocks / compact / memory contributions 转换为用户可读 summary。
3. 在 TUI 或 CLI status 中展示最近 run 的 context 状态。
4. 明确无 context report 时的降级提示。
5. 增加自动化验证覆盖 context surface 输出。

## 本轮不做

- 不做可编辑 context policy。
- 不做完整 layered memory 写入策略。
- 不做真实 tokenizer 精确统计。
- 不做 remote context viewer。
- 不做 Web Console UI。

## 验收标准

1. 用户能通过本地 CLI/TUI 查看某次 run 的 context breakdown。
2. 输出能区分 system / memory / history / recent 等 layer。
3. compact 前后估算、dropped blocks、memory source 至少可见。
4. 无报告或旧 run 时有明确降级提示。
5. `pnpm check` 通过。
6. `pnpm verify` 通过。

## 必跑命令

```bash
pnpm check
pnpm verify
```

## 升级条件

1. 需要改变 L3 `ContextBuildReportDto` schema。
2. 需要重写第一层 context / memory 算法。
3. 需要把 context viewer 扩展到 Web / Desktop / remote。
4. `pnpm verify` 连续两轮不通过。

---

## 关账与交付

- 登记表：`docs/architecture-docs-for-agent/fourth-layer/L4_CONTEXT_ENGINEERING.md`；人类向：`docs/architecture-docs-for-human/backend-plan/layer4-design/L4_CONTEXT_ENGINEERING.md`
- `operator-client`：`getRunContext(traceId)`；类型 `ContextBlockDescriptorDto` 等 re-export
- CLI：`l4-context-view.ts` 共享 human / TUI one-liner 格式化；`theworld inspect context <traceId>`（`--json`）；行模式 `chat` 后提示 `theworld inspect context <traceId>`；`slash` `/context`
- TUI：context rail `l4ContextHint`（最近 run 成功后的摘要一行）
- `l4-product-map.ts`：`inspect:context`、`slash:/context`
- 自动化：`pnpm test:l4-context`（已并入 `verify`）

**下一子单：[`104`](./104_l4_background_resume_recover.md).**（`102` / `103` 已归档：[`./102_l4_layered_memory_product_surface.md`](./102_l4_layered_memory_product_surface.md)、[`./103_l4_permission_approval_product_flow.md`](./103_l4_permission_approval_product_flow.md)。）
