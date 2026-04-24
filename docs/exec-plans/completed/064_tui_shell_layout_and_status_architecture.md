# 064 TUI Shell Layout 与 Session/Status Architecture

> **状态：已被 supersede（2026-04-24）。** 本文对应较窄的 TUI-local 路线；新的主实施路径已升级为 shell parity 的 `067`–`072`，以上游设计 [`docs/requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md`](../../requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md) 为准。

## 目标

在 `063` 的语义 transcript 基础上，重建 TUI 的 shell layout，使界面稳定收口为：

- `Header`
- `Transcript`
- `FooterAndInput`

并同步冻结 session identity 与 run status 的界面归属。

---

## 背景

- `THEWORLD_TUI_PRODUCT_DESIGN.md` 已明确：TheWorld TUI 的产品级外壳不是“被美化的日志页”，而是三层壳结构。
- 当前 TUI 虽已有顶部区、正文区和底部区，但信息职责仍有重叠，状态文案与正文叙事没有完全分离。
- `060` 已负责 CLI session identity 与 attach/pick 入口；本单只负责把该身份规则正确投射到 TUI 外壳中。

---

## 修改范围（冻结）

**允许修改：**

- `packages/cli/src/tui/run-chat-tui.tsx`
- `packages/cli/src/tui/chat-tui-statusbar.tsx`
- `packages/cli/src/tui/chat-tui-banner.tsx`
- `packages/cli/src/tui/**`（仅限 layout / header / footer 所需文件）
- `packages/cli/src/chat-status.ts`
- `packages/cli/src/chat-session-resolve.ts`（仅当需复用 session identity 规则）
- `scripts/test-project-cli.mjs`
- `docs/requirements/THEWORLD_TUI_PRODUCT_DESIGN.md`
- 本工单与 `active/README.md`

**禁止修改：**

- `packages/shared/contracts/**`
- `packages/sdk/**`
- `packages/server/**`
- `packages/core/**`
- `apps/web-console/**`
- `packages/cli/src/style.ts` 的共享 token 系统（留给 `065`）
- 输入快捷键、窄终端矩阵与手工 TTY 验证（留给 `066`）

---

## 单一路径设计（冻结）

1. Header 负责：
   - 品牌位
   - session identity
   - 当前 run phase
2. Transcript 只负责正文语义块，不再承担 phase 文案。
3. Footer/status rail 负责：
   - host
   - short session reference
   - model / agent / context 近似信息
   - 短键位提示
4. session identity 统一为 `displayName -> alias -> shortId`。
5. run phase 统一为：
   - `idle`
   - `thinking`
   - `streaming`
   - `failed`
   - `completed`
6. `failed` 必须同时反映到高优先级状态位和 transcript error block。

---

## 验收标准

1. `pnpm --filter @theworld/cli check` 通过。
2. `pnpm test:project-cli` 通过。
3. `pnpm verify` 通过。
4. TUI 代码中 header / transcript / footer 职责已明确分离，不再依赖 `run start/end` 作为主状态呈现。

---

## 升级条件

命中任一即停止并升级：

- 需要新增后端字段才能完成 session identity 或 status 设计
- 需要在本单内引入完整主题系统或新模式语义
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

- 不新造 session identity contract
- 不做视觉 token 大收口
- 不做 keyboard / input polish
- 不引入多 pane 调试视图
