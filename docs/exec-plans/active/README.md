# 执行中 / 未归档的执行计划

本目录仅保留**仍在推进或作为入口说明**的文档；**已落库验收**的编号线性执行计划已归档到 [`../completed/`](../completed/)。

- **新工单编号**从 **073** 起在本文档或后续 PR 中登记。
- **056–066 / 059–072**（含 TUI 与 CLI Shell Parity 系列）的工单正文与 budget 副本已整体归档，历史索引见 [`../completed/README.md`](../completed/README.md) 中 **CLI TUI 与 Shell Parity 轨（056–072）** 一节。
- **低预算/承接说明（保留在 active，不作为线性工单正文）**：
  - [`THEWORLD_CLI_BUDGET_MODE_HANDOFF.md`](./THEWORLD_CLI_BUDGET_MODE_HANDOFF.md) — THEWORLD/CLI 模式与可交付约束总览
  - [`THEWORLD_CLI_SHELL_PARITY_BUDGET_MODE_HANDOFF.md`](./THEWORLD_CLI_SHELL_PARITY_BUDGET_MODE_HANDOFF.md) — Shell 形态对齐（含 067+ 的承接与 supersession 说明）
- **Desktop 详细设计稿（人类稿）**：[TUI 详细方案](../../requirements/TUI_DESKTOP_DESIGN_SPEC.md)（与 Desktop `docs/TUI_DESIGN.md` 同步；实施须遵守不扩张 contract 的约定）。

## 推进队列：Desktop TUI 设计实施（`073+`）

> **TUI 工单** 与 **功能工单** 分文件编号、**不混单**。同一方向按依赖顺序：073 → 074/075（Splash）→ 076（仅 YAML 加载层）→ 077（断点/侧栏）→ 078（数据）→ 079（列表 UI）。

| 编号 | 类型 | 说明 |
|------|------|------|
| [073_tui_desktop_spec_ingest_and_gap_matrix.md](./073_tui_desktop_spec_ingest_and_gap_matrix.md) | 文档 | 设计稿入仓对账、gap 表（不写业务代码） |
| [074_tui_splash_line_reveal_animation.md](./074_tui_splash_line_reveal_animation.md) | TUI | Splash Phase 1：逐行显现 |
| [075_tui_splash_cta_breathe_and_exit.md](./075_tui_splash_cta_breathe_and_exit.md) | TUI | Splash Phase 2/3：CTA、按键/自动进入 |
| [076_feature_tui_yaml_minimal_loader.md](./076_feature_tui_yaml_minimal_loader.md) | 功能 | `.theworld/tui.yaml` 最小解析（无组件） |
| [077_tui_responsive_breakpoints_sidebar.md](./077_tui_responsive_breakpoints_sidebar.md) | TUI | 断点 80 列、侧栏 ~20 列 |
| [078_feature_tui_session_list_data_adapter.md](./078_feature_tui_session_list_data_adapter.md) | 功能 | 会话列表数据适配（无全屏 UI） |
| [079_tui_session_list_fullscreen_overlay.md](./079_tui_session_list_fullscreen_overlay.md) | TUI | 全屏会话列表 + 基本键位 |

**后续（待拆单，勿与本批混提）**：Settings 全屏、消息块 Markdown/代码高亮增强、可配置主题 5+、Vim 多模式、`.yaml` 全键位表——均须**分别**为独立 TUI 或功能小工单。

## 本目录其他活动工单

- （无，除上表 073–079 外）
