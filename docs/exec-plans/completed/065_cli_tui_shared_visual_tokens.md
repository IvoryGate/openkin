# 065 CLI/TUI Shared Visual Tokens 与 Components 收口

> **状态：已被 supersede（2026-04-24）。** 本文对应较窄的 TUI-local 路线；新的主实施路径已升级为 shell parity 的 `067`–`072`，以上游设计 [`docs/requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md`](../../requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md) 为准。

## 目标

建立一层 CLI 与 TUI 共享的**小而稳定**视觉 token 基础，统一品牌、状态、正文角色与边框/弱化语义，减少散落 ANSI 和局部配色。

本单只做视觉表达的收口，不重做 transcript model 或 shell layout。

---

## 背景

- `THEWORLD_TUI_PRODUCT_DESIGN.md` 已冻结 token 角色集，但当前 CLI/TUI 仍有多处局部颜色与组件内临时样式。
- 若不把 token 体系单独收口，TUI 很难在不同组件间维持一致精致度，line UI 也会继续与 TUI 脱节。
- 本单建立的是**小 token 层**，不是完整主题系统。

---

## 修改范围（冻结）

**允许修改：**

- `packages/cli/src/style.ts`
- `packages/cli/src/chat-banner.ts`
- `packages/cli/src/chat-status.ts`
- `packages/cli/src/help.ts`
- `packages/cli/src/tui/chat-tui-banner.tsx`
- `packages/cli/src/tui/chat-tui-statusbar.tsx`
- `packages/cli/src/tui/**`（仅限为共享 token 接入所需的样式与小组件）
- `scripts/test-project-cli.mjs`
- `docs/requirements/THEWORLD_CLI_SHELL_DESIGN.md`
- `docs/requirements/THEWORLD_TUI_PRODUCT_DESIGN.md`
- 本工单与 `active/README.md`

**禁止修改：**

- `packages/shared/contracts/**`
- `packages/sdk/**`
- `packages/server/**`
- `packages/core/**`
- `apps/web-console/**`
- transcript reducer 设计（留给 `063`）
- shell layout / information architecture 重排（留给 `064`）
- 输入行为与窄终端策略实现（留给 `066`）

---

## 单一路径设计（冻结）

1. 冻结最小角色集：
   - `brand`
   - `accent`
   - `muted`
   - `dim`
   - `panelBorder`
   - `user`
   - `assistant`
   - `tool`
   - `success`
   - `warning`
   - `danger`
   - `focus`
2. line UI 与 TUI 必须从同一 token 来源派生。
3. 不允许继续在组件内部散写与 token 无关的临时颜色。
4. `NO_COLOR` / `TERM=dumb` 下必须优雅退化为无色但仍保留结构层级。
5. 不引入完整 ThemeProvider、多主题、自动主题切换。

---

## 验收标准

1. `pnpm --filter @theworld/cli check` 通过。
2. `pnpm test:project-cli` 通过。
3. `pnpm verify` 通过。
4. 关键 line UI / TUI 组件已通过共享 token 读取视觉语义，而非继续依赖 scattered ANSI。

---

## 升级条件

命中任一即停止并升级：

- 需要引入完整主题系统、多主题矩阵或外部 UI 依赖
- 需要为 token 设计新增 server / sdk surface
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

- 不引入大型主题系统
- 不增加新的 CLI 模式语义
- 不重写 transcript model 或 footer 交互逻辑
