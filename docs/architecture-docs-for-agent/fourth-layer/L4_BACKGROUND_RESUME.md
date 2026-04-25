# L4 Background / Resume / Recover（104）

## 目标

在 L3 `TraceSummaryDto`、session runs 列表（046）、取消（052）之上，给出 **本地产品词表** 与可执行入口，使用户能查看 run 状态、取消、并在失败/审批阻塞后知道下一步。

## 实现

- `packages/cli/src/l4-background-resume.ts` — `L4_BACKGROUND_RESUME_VOCAB`、`formatSessionRunsHuman`、`formatL4RunsSessionRailSuffix`（TUI 状态行 `run·N active`）
- `theworld inspect resume` — 打印词表（无网络 I/O）；`--json` 输出固定 stub
- `theworld sessions runs <sessionId>` · `theworld sessions cancel-run <traceId>`
- 聊天内 `/runs`；TUI 在上下文/审批提示后追加 session runs 摘要

## 验收

- `pnpm test:l4-background`

## 相关

- [L4_PRODUCT_SHELL_MAP.md](./L4_PRODUCT_SHELL_MAP.md)（099）
- 执行计划（归档）：`docs/exec-plans/completed/104_l4_background_resume_recover.md`
