# 073 TUI：Desktop 设计稿入仓与现实现对账（文档收口）

> **类型**：仅文档 + 设计稿路径收口（**不包含** TUI/业务代码变更）。  
> **上游**：[`docs/requirements/TUI_DESKTOP_DESIGN_SPEC.md`](../../requirements/TUI_DESKTOP_DESIGN_SPEC.md)（自 Desktop `docs/TUI_DESIGN.md` 落库）。  
> **原则**：与 [`../completed/067_cli_shell_home_and_information_architecture.md`](../completed/067_cli_shell_home_and_information_architecture.md) 等已关闭工单一致——**不扩张** `packages/shared/contracts`、`packages/sdk` 对外面；设计稿中超出 contract 的项用单独 **功能工单** 收紧范围后再做。

## 本工单交付物

1. 确认 `docs/requirements/TUI_DESKTOP_DESIGN_SPEC.md` 在分支内为当前参考副本，文首**副本说明**指向 Desktop 源文件。
2. 更新 [`docs/exec-plans/active/README.md`](./README.md) 队列，登记本工单与后续 074+ 的**编号占位**（见该 README）。
3. 本文**第二节**的 gap 表作为后续 TUI/功能工单的**唯一**对账基线；行项目对应独立小工单，**不**在本单实现。

## 对账表（现实现 vs 设计稿 §）

| 设计要点（TUI_DESKTOP_DESIGN 章节） | 现实现（`packages/cli`） | 后续工单方向（类型） |
|-----------------------------------|-------------------------|----------------------|
| §2.1 四段布局 Header / Main+可选 Sidebar / Input / Status | 已有 Header、Transcript、Input、StatusBar、可选 Sidebar（宽屏逻辑与稿「≥80 列侧栏」**阈值不一致**，当前约 118 列 | **TUI**：074+ 中单独一条仅调响应式断点 |
| §2.2.1 开屏 Splash 三阶段动画 | 无独立 Splash，多为 Home/横幅 | **TUI**：074、075 分步做 |
| §2.2.2 多页面 Splash/Home/Chat/SessionList/Settings… | 主要为单屏 Chat + Home shell | **TUI** / **功能** 拆分见 078–080 |
| §3 多主题 5+ Phase | `style.ts` 语义色 + `NO_COLOR` 降载；无多主题 JSON | **功能** 后序（主题 ID + palette）；**TUI** 只消费 token |
| §4 Vim 多模式 + 大快捷键表 | 主要 readline/Ink `useInput`、slash | **TUI** 分键位逐步加；**功能** 若有需共享状态机再单开 |
| §5.1 会话管理全功能 | 已有 session resolve、`sessions` 子命令；TUI 内嵌列表未完整 | **功能** 先数据适配器，**TUI** 后全屏 UI |
| §5.2–5.4 富消息/tool 块 | `tui-transcript-model` 块类型、stream sink 已有基础 | **TUI** 逐块美化；与功能分离 |
| §6 `tui.yaml` | 未实现 | **功能** 单工单：仅 loader + 默认 fallbacks（见 076） |
| 附录 文件结构 `components/` `pages/theme/` | 当前扁平 `tui/*.tsx` | 重构另起 TUI 工单，**不**与功能loader 混提 |

## 验收

- [ ] `docs/requirements/TUI_DESKTOP_DESIGN_SPEC.md` 存在且文首含副本说明。  
- [ ] `active/README.md` 登记 073 及 074+ 队列标题。  
- [ ] 本对账表无要求「本工单写代码」。

## 不做什么

- 不修改 `packages/cli/src` 下实现代码。  
- 不在此单定稿 Vim 全键位或 40+ 主题，仅列 gap。
