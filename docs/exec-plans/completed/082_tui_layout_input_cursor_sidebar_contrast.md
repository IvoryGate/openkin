# 082 — 主界面布局与输入体验：光标位、退格、侧栏宽、对比度

## 元信息

- **状态**: **completed**（2026-04-16 前后落地）  
- **来源**: 真机反馈（tmux + 终端截图，约 2026-04）与 `081` 落地后的回归感受。  
- **问题陈述**: 主界面**布局怪异**；**输入区主观上很窄**（水平/垂直）；**输入后无法退格**；**光标有时出现在最底状态栏**而非输入行；**色带/强调色对比度过高**；**宽屏侧栏仍显过窄**。  
- **约束**: 不扩张 server / SDK；变更以 `packages/cli` TUI 与 `tui-ink-palette` / 布局常数为主；遵守 [`TUI_DESKTOP_DESIGN_SPEC.md`](../../requirements/TUI_DESKTOP_DESIGN_SPEC.md) §2.2（侧栏断点）与 §2.3（色与层次）。  
- **前置**: [`081_tui_opencode_color_blocks_ink_parity.md`](../active/081_tui_opencode_color_blocks_ink_parity.md)（`TuiTextFill` / 整行铺色）；本工单在**可见性已改善**前提下做**交互与视觉收敛**。

## 实施摘要（关账）

| 项 | 实现要点 |
|----|-----------|
| 硬件光标在状态行 | `packages/cli/src/tui/tui-cursor-visibility.ts`：`TUI_CURSOR_HIDE/SHOW`；`ChatTuiApp` 挂载时 `?25l`，卸载 `?25h`。环境变量 **`THEWORLD_TUI_SHOW_CURSOR=1`** 时**不**隐藏，便于无障碍/调试。 |
| 退格 / 光标下标 | `useInput`：补充 **Ctrl+H**、**8 / 127** 字符的退格识别；`key.delete` 独立为向前删除；`useEffect` 在 **`draft` 变化**时 `cursorIndex` clamp 到 `draft.length`。 |
| 输入区宽/高 | `chat-tui-inputbar.tsx`：去掉 `marginX`，焦点条与文本井宽度 **`columns-2`**；`paddingTop={1}` 与 `reservedRows` 对齐。 |
| 主区色带 | `run-chat-tui`：Conversation 下由 **2 行** `TuiTextFill` 收为 **1 行** `border`，减轻「蓝+灰双条」刺眼感。 |
| 侧栏比例 | 见同期落地：`tuiSidebarWidthCols` ≈ 终端 **1/4**（`tui-layout-constants.ts`），`ChatTuiSidebar` `minWidth=width`。 |
| 对比度 | `tui-ink-palette.ts`：`dark` / `catppuccin` / `tokyonight` / `oneDark` 降饱和/柔化 `border`、`inputBorderFocus`、`accent`/`focus`/`brand` 等。 |
| 验证 | `pnpm --filter @theworld/cli check`、`pnpm test:project-cli` 通过。全量 `pnpm verify` 由合并前在本地跑。 |

---

## 原「现象与根因」表（归档）

| 现象 | 初步假设 | 结果 |
|------|-----------|------|
| 光标在状态栏 | 状态栏在树中**最后**绘制，硬件光标落末行 | 隐藏硬件光标 + 行内假光标 |
| 退格无效 | `^H` / `^?` 未进 `key.backspace`；`cursorIndex` 漂移 | 扩展退格检测 + `cursorIndex` clamp |
| 输入框很窄 | margin 与 padding 叠加 | 去 marginX，加 `paddingTop` |
| 侧栏 | 固定 20 列 | 约 **1/4** 列宽 + clamp |
| 对比过高 | 主题 token 过亮 | 多 preset 柔化 + 主区 1 条分隔色带 |

---

## 分步计划（历史正文）

（原文档 Step 1–6 与「目标/非目标/风险/参考」与归档前 `active/082_*.md` 一致，此处不重复全量粘贴；以本节 **实施摘要** 为验收准绳。）

## 非目标、风险、参考

- 同原工单；风险项「关闭硬件光标」的缓解方式：**`THEWORLD_TUI_SHOW_CURSOR=1`** 恢复显示。  
- 设计: [`TUI_DESKTOP_DESIGN_SPEC.md`](../../requirements/TUI_DESKTOP_DESIGN_SPEC.md) §2.2、§2.3  
- 前序: [077 响应式+侧栏](./077_tui_responsive_breakpoints_sidebar.md)  
