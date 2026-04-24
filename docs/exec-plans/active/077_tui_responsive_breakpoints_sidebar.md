# 077 TUI：响应式断点 — 侧栏与主区（§2.2.3）

> **类型**：**仅 TUI 布局**（`Box`/`width` 或现有 `wideLayout` 变量）。  
> **设计依据**：[TUI_DESKTOP_DESIGN_SPEC.md §2.1、§2.2.3](../../requirements/TUI_DESKTOP_DESIGN_SPEC.md)（`≥80` 列显侧栏约 20 列）。

## 范围

- 在 `run-chat-tui`（或已集中计算列宽的单一位置）将「宽屏+侧栏」的断点与侧栏**列宽**调整为与稿一致：**≥80 列**显示侧栏，侧栏约 **20 列**（或等比例 `min`/`max` 不破坏现有窄屏逻辑）。  
- 与 **076** 无硬依赖；若 076 已提供 `show_sidebar: false` 的布尔，本单在接入点**只读**该字段（若 076 未合入，先按 env/常量，076 后补接）。  
- 更新/补充 `tui-transcript-viewport` 或 transcript 的 flex 计算，使主区在侧栏出现时可滚区域不塌缩。

## 验收

- 在 **80 列、24 行** 伪终端可看到侧栏；**79 列** 侧栏隐藏，无异常换行。  
- `pnpm --filter @theworld/cli check`；`pnpm test:project-cli` 通过。  
- 不新增 server 调用。

## 不做什么

- 不实现 SessionList 全屏、Settings（→ 078–080）。  
- 不改 `076` 的 YAML schema（只消费已有字段时除外）。
