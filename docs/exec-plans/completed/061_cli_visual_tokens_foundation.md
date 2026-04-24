# 061 CLI 语义 Token 与视觉基础层

> **状态：已被 supersede（2026-04-24）。** 本文档对应旧的增量路线；当前新的主实施路径已提升为 shell parity 的 `067`–`072`，以上游设计 [`docs/requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md`](../../requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md) 为准。

## 目标

为 TheWorld CLI 建立一层**小而稳定**的视觉 token 基础，统一行模式与 TUI 的语义色/强调角色，减少组件中散落的裸 ANSI 与局部配色。

本单只做视觉基础层，不引入新模式、新主题体系或新 contract。

---

## 背景

- 当前 `packages/cli/src/style.ts` 还是薄的 ANSI 常量表。
- TUI 组件与行模式组件都已存在，但视觉语义尚未收口为统一 token。
- 参考项目的关键启发是“先语义角色，后具体颜色”，而不是把完整桌面主题系统搬进来。

---

## 修改范围（冻结）

**允许修改：**

- `packages/cli/src/style.ts`
- `packages/cli/src/chat-banner.ts`
- `packages/cli/src/chat-status.ts`
- `packages/cli/src/chat-stream-sink.ts`
- `packages/cli/src/help.ts`
- `packages/cli/src/tui/**`
- `scripts/test-project-cli.mjs`
- `docs/requirements/THEWORLD_CLI_SHELL_DESIGN.md`
- 本工单与 `active/README.md`

**禁止修改：**

- `packages/shared/contracts/**`
- `packages/sdk/**`
- `packages/server/**`
- `packages/core/**`
- `apps/web-console/**`
- 不引入新 npm 依赖

---

## 单一路径设计（冻结）

1. 将 CLI 视觉角色收口为一组小 token，例如：
   - `brand`
   - `accent`
   - `dim`
   - `success`
   - `warning`
   - `danger`
   - `panelBorder`
   - `muted`
2. 行模式与 TUI 都通过同一来源消费这些 token。
3. `NO_COLOR` / `TERM=dumb` 下继续退化为纯文本，不做 fake theme。
4. 本单不引入 light/dark/auto/daltonized 多主题，只做单主题语义层。

---

## 验收标准

1. `pnpm --filter @theworld/cli check` 通过。
2. `pnpm test:project-cli` 通过，且无 TTY 依赖新增。
3. `pnpm verify` 通过。

---

## 升级条件

- 需要新增多主题切换或 auto theme
- 需要改 TUI 以外的产品 contract 才能表达视觉状态
- `pnpm verify` 连续两轮不通过

---

## 必跑命令

```bash
pnpm --filter @theworld/cli check
pnpm test:project-cli
pnpm verify
```

---

## 不做什么

- 不做完整 ThemeProvider
- 不做 light/dark 切换
- 不做 mode 色相体系（如 fake plan/build/permission）
- 不做选区系统或复杂 shimmer 编排
