# 083 — OpenCode 式「Zen」布局总览（父工单）

## 元信息

- **状态**: active（**084–086 已在 `packages/cli` 落地**；**087** 鼠标滚轮仍为调研/未编码）  
- **子项**: 见 **084–087**；实现可增量合并，不必等全套闭环。  
- **参考**: 用户提供的 OpenCode 会话 TUI 截图 + [`CLI_REFERENCE_SOURCES_INDEX.md`](../../requirements/CLI_REFERENCE_SOURCES_INDEX.md) 中的 OpenCode 路径索引。  
- **目标陈述**: 主会话界面接近 **全屏分区**：**左侧**主列为可滚动**对话流**、**左下**固定**输入区**（可随多行草案增高），**其下**为 **模型/上下文/阶段** 等**一条信息带**，**最底**为路径/连接等状态；**右侧**为 **整列单色侧栏**（无零散拼块感），整体**少色、偏灰/暗**，避免霓虹条。  
- **非目标**: 不引入 OpenTUI/Solid 全栈；不复制 OpenCode 主题 JSON；不扩张 server。

## 子工单（按依赖大致顺序）

| 编号 | 链接 | 范围 |
|------|------|------|
| 084 | [多行输入 · 最高 6 行](./084_tui_opencode_multiline_draft_six_max.md) | 草案 `draft` 支持 `\n`、Shift+Enter 换行、最多 6 行、行预算与侧栏/底栏解耦；输入框视觉撑高。 |
| 085 | [侧栏通栏单色板](./085_tui_opencode_sidebar_solid_rail.md) | 右栏整列统一 `surface`（或 `panel` 语义色），区段用排版区分而非多块背景。 |
| 086 | [输入下「模型/上下文」信息带](./086_tui_opencode_input_below_context_rail.md) | 输入与最底全宽状态行之间，增加一条**紧凑、弱对比**的模型+阶段+ctx 行；底栏可去重。 |
| 087 | [转录区鼠标滚轮](./087_tui_transcript_mouse_wheel_scroll_ink5.md) | Ink5 无内置鼠标事件：调研 `xterm`/`SGR 1000h`+stdin 解析；可选页 Up/Down 强化为「类网页滚动」的过渡方案。 |

## 设计对齐（TheWorld 自有皮）

- 颜色仍走 `tui-ink-palette` 与 `TUI_DESKTOP_DESIGN_SPEC` §2.3，**不**复刻 OpenCode 色值。  
- 交互键位在 `help` / 输入区 hint 中写明（如 Shift+Enter 换行）。

## 关账

- 子单各自归档后，本文档可标 **completed** 并移至 `../completed/`，或保留为**索引**指回各子单。
