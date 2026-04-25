# 085 — 侧栏通栏单色（减少拼块感）

## 元信息

- **状态**: **done（`ChatTuiSidebar` 根通栏 `surface`、区段无拼块底）**  
- **父工单**: [083](./083_opencode_zen_layout_parent.md)  
- **目标**: 宽屏下右侧栏视觉上为 **整列同底色** 的「一条」，与主列 `background` 明确分层；**不用**多段小色块堆叠。  
- **实现要点**  
  - 根 `ChatTuiSidebar` 使用与内容一致的 **单一** `backgroundColor`（如 `surface`），子区块取消独立 `background` 或统一同色。  
  - 可保留 **极弱** 的 `border` 分隔或仅用留白/字重区分标题。  
- **验收**: ≥80 列时侧栏无「打补丁」感；TUI 无真彩时仍降级可读。

## 非目标

- 不等同 OpenCode `backgroundPanel` 色值；以 TheWorld token 为准。
