# 086 — 输入栏下方：模型 + 阶段 + 上下文信息带

## 元信息

- **状态**: **done（`chat-tui-context-rail.tsx` + `ChatTuiStatusBar` `includeModelContext` 去重）**  
- **父工单**: [083](./083_opencode_zen_layout_parent.md)  
- **目标**: 对标 OpenCode 在 **Prompt 下** 的一行**弱对比**信息（如 Build/模型/用量）；与 **最底** 全宽状态行分工：**本带**偏「本轮模型与上下文」；**底栏**偏连接、会话、路径、版本。  
- **实现要点**  
  - 新组件如 `ChatTuiContextRail`：单行、`textMuted`、可选 `statusBar`/`surface` 底。  
  - `ChatTuiStatusBar` 在宽屏下**去重** `mdl`/`agt`/`ctx`（由 prop 或组合方式控制），避免同屏三行挤满。  
- **验收**: 与多行输入、082 假光标/隐藏光标的顺序兼容。
