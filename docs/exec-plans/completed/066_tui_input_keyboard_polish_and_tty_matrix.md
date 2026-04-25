# 066 TUI Input / Keyboard Polish、Narrow Terminal 与 TTY 验证矩阵

> **状态：已被 supersede（2026-04-24）。** 本文对应较窄的 TUI-local 路线；新的主实施路径已升级为 shell parity 的 `067`–`072`，以上游设计 [`docs/requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md`](../../requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md) 为准。

## 目标

在 `063`–`065` 完成后，收口 TUI 输入区、键盘交互与窄终端降载行为，并补齐本轮 TUI 重设计的手工 TTY 验证矩阵。

---

## 背景

- 新的 transcript model、shell layout 和 visual tokens 只能解决结构与视觉问题；真正的产品级完成度还取决于输入区状态、键盘行为和窄终端表现。
- `THEWORLD_TUI_PRODUCT_DESIGN.md` 已冻结：输入区必须区分 `idle / busy / blocked`，窄终端与 `NO_COLOR` 必须可降载，非 TTY 不进入 TUI。
- 本单是 TUI 产品化收口单，也是本轮重设计的最终 gate。

---

## 修改范围（冻结）

**允许修改：**

- `packages/cli/src/tui/run-chat-tui.tsx`
- `packages/cli/src/tui/**`
- `packages/cli/src/chat-input.ts`
- `packages/cli/src/chat-args.ts`
- `packages/cli/src/chat-status.ts`
- `scripts/test-project-cli.mjs`
- `docs/requirements/THEWORLD_TUI_PRODUCT_DESIGN.md`
- `docs/requirements/PROJECT_CLI.md`
- 本工单与 `active/README.md`

**禁止修改：**

- `packages/shared/contracts/**`
- `packages/sdk/**`
- `packages/server/**`
- `packages/core/**`
- `apps/web-console/**`
- 新增 server / sdk contract
- 引入新的 CLI 模式语义或多 pane 调试面板

---

## 单一路径设计（冻结）

1. 输入区必须显式区分：
   - `idle`
   - `busy`
   - `blocked`
2. 窄终端下优先保留 transcript 宽度与高优先级状态，允许 banner / status rail 收缩。
3. `NO_COLOR` / `TERM=dumb` 下去掉颜色与不必要动效，但仍保留层级与标签。
4. 非 TTY 继续走 line UI contract，不为 TUI 兼容性污染非 TTY 路径。
5. 本单必须给出一份手工 TTY 验证矩阵，至少覆盖：
   - 常规宽终端
   - 窄终端
   - `NO_COLOR`
   - 失败态
   - 结束态

---

## 验收标准

1. `pnpm --filter @theworld/cli check` 通过。
2. `pnpm test:project-cli` 通过。
3. `pnpm verify` 通过。
4. 手工 TTY 验证矩阵已执行并汇报关键观察项。

---

## 升级条件

命中任一即停止并升级：

- 需要新 server contract 才能表达输入或状态需求
- 需要引入新的终端框架才能解决输入问题
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

- 不新增 fake `plan/build/permission` 模式
- 不引入多主题系统
- 不为 TUI 反向设计新的后端能力
