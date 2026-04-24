# 075 TUI：开屏 Splash — Phase 2/3（CTA 与退出至 Home/Chat）

> **类型**：**仅 TUI**（在 **074** 完成逐行显现后的**衔接**层）。  
> **设计依据**：[`TUI_DESKTOP_DESIGN_SPEC.md`](../../requirements/TUI_DESKTOP_DESIGN_SPEC.md) §2.2.1 Phase 2 呼吸、Phase 3 CTA 呼吸，以及**任意键 / 3s 自动**进入 Home。

## 前提

- **074** 已合入并可在 TTY 下看到 Phase 1 逐行显现。

## 范围

- 在 Phase 1 完成后：
  - **可选**整段 Logo 一次「呼吸」闪烁（或稿中简化版 1 次亮/暗切换）；若与窄屏冲突，以**不闪屏**的亮度切换为主。
  - 展示 `> Press any key to enter <` 或稿中等价短 CTA，带**可辨**的周期闪烁（如 ~500ms），**不**与 status bar 混用同一条线。
- **输入**：**任意键** 结束 Splash；**3 秒**无键自动进入与任意键**相同**的下一态。
- **下一态**：与当前主流程一致，进入 **Home shell** 或直接可输入的 Chat 壳（**保持 074 之后当前仓库默认行为**；本单不擅自改业务路由，仅将「结束 Splash」接回该默认）。

## 验收

- 全链路：启动 → Phase1（074）→ 本单 Phase2/3 → 进入主界面；任意键与 3s 自动两条路径**手工**各验一次。  
- `pnpm --filter @theworld/cli check`；`pnpm test:project-cli` 若因 Splash 时序变长，允许在测试脚本中 `THEWORLD_TUI_SPLASH=0` **仅用于 CI**（需在工单实现中**文档化**于 `help` 或内联帮助一行）。

## 不做什么

- 不实现侧栏、会话列表、主题包、`.yaml` 解析（若需统一关闭 Splash 位点，**优先** env，与 076 解耦）。  
- 不实现 Visual/Vim/Command 模式（稿 §4.2）。
