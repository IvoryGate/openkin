# L4 Terminal Product Shell Polish（106）

## 目标

在 099–105 语义落地后，统一 **help、onboarding、home hints、NO_COLOR** 下的可发现性文案，使 session runs、plan、inspect resume 等与 `L4_PRODUCT_SHELL_MAP` 一致。

## 实现落点

- `packages/cli/src/help.ts` — root `First run` 段含 L4 104–105 引导
- `packages/cli/src/l4-onboarding.ts` — Discoverability 扩展
- `packages/cli/src/chat-banner.ts` — line 模式 home hints
- `pnpm test:l4-polish` — 稳定字符串与 `NO_COLOR` 下 help 可读性

## 验收

- `pnpm test:l4-polish`
- `pnpm verify`

## 相关

- 执行计划（归档）：`docs/exec-plans/completed/106_l4_terminal_product_shell_polish.md`
