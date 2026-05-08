# 145 · Desktop 对话区 Assistant 头像与 Agent 身份一致

## 背景

中区消息列表（`renderMessages`）中 assistant 气泡左侧头像曾硬编码为字母 **K**，与左栏会话列表、会话头（`getAgentName`）已解析出的 Agent 显示名不一致。用户在有 Agent 名称时仍看到 **K**，体验错误。

## 影响范围

| 层级 | 影响 |
|------|------|
| L4 桌面壳 | `apps/desktop/renderer/app.js` 消息渲染 |
| L4 桌面壳 | `apps/desktop/renderer/styles.css` 气泡头像内图片样式 |
| Contract | **不扩展**：仍使用现有 `getAgentName` / `getAgentAvatarUrl` / `agentDirectory`，与工单 126、125 一致 |

## 不做什么

- 不改后端 API 或 preload IPC 形状。
- 不为 tool/system 消息引入 per-agent 区分（保持 T/S）。
- 不在此单内将中区头像主题色改为与左栏完全动态的 `getAvatarTheme`（可后续 Polish）。

## 验收

1. 已为 Agent 配置显示名时，中区 assistant 气泡左侧显示该名称首字母（或配置的字母头像逻辑），而非 **K**。
2. 若 Agent 配置了头像 URL，中区 assistant 气泡左侧优先显示图片（与左栏一致）。
3. `pnpm verify` 通过。

## 状态

- **实施**：与本工单同步落地。
