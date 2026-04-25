# 084 — 多行输入草案（最多 6 行，左下固定撑高）

## 元信息

- **状态**: **done（代码已合入 `run-chat-tui` / `chat-tui-inputbar` / `tui-input-draft`）**  
- **父工单**: [083](./083_opencode_zen_layout_parent.md)  
- **目标**: 输入区在 **Shift+Enter** 下插入换行，**最多 6 行**（含）；**Enter** 仍发送整段草案（trim 按现有 `runOneTurn` 规则）。粘贴多行时 **裁剪** 到 6 行。  
- **实现要点**  
  - `draft` 含 `\n`；`cursorIndex` 一维，与 `useInput` 中退格/左右一致。  
  - `run-chat-tui`：`key.return` + `key.shift` → 换行；无 shift → 发送。  
  - `ChatTuiInputBar`：按行渲染，当前行内嵌假光标。  
  - `computeTranscriptBlockBudget` 的 `reservedRows` 随**可见草案行数** `min(6, countLines)` 增加（相对单行基线 +0～+5）。  
- **验收**: 宽/窄屏均可用；`pnpm --filter @theworld/cli check`、project-cli 通过。

## 非目标

- 多行「框」内跨行用上下键移动（与当前「上下键滚 transcript」可冲突；若后续要，需另单协调焦点模式）。
