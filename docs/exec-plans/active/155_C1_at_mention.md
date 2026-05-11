# 155-C1 — @提及功能 — 输入@弹出 Agent 选择器 + 强制指定回复

> **状态**：📋 待开发
> **前置**：153-B2（已完成）
> **预估**：1.5d
> **优先级**：P0 — 核心交互缺失

---

## 目标

群聊中输入 @ 字符时弹出 Agent 选择器，被 @ 的 Agent 必须回复，气泡中 @AgentName 高亮显示。

## 实现方案

### 1. @弹出选择器

- 监听 `channel-composer-input` 的 `input` 事件
- 检测到光标前输入 `@` 时，在输入框上方弹出浮窗
- 浮窗列出当前群聊的所有 Agent（头像 + 名称 + 在线状态）
- 键盘上下键选择，Enter/点击确认
- 输入 `@x` 时过滤名称包含 "x" 的 Agent
- 按 Esc 或点击外部关闭浮窗

### 2. 消息文本解析

- 发送前用正则提取所有 `@AgentName`，匹配到对应 agentId
- 将匹配结果附加到消息元数据 `mentionedAgentIds: string[]`

### 3. 群聊路由修改

- 被 @ 的 Agent：上下文注入中移除 SKIP 指令，改为"你被 @ 了，必须回复"
- 未被 @ 的 Agent：保持原有 Self-Judge 逻辑

### 4. 气泡渲染

- `@AgentName` 用特殊样式渲染（品牌色高亮，加粗）

### 5. 私聊

- 私聊只有一个 Agent，@ 功能自动忽略（但保留语法不报错）

## 涉及文件

- `apps/desktop/renderer/app.js` — @检测、浮窗逻辑、路由修改、气泡渲染
- `apps/desktop/renderer/styles.css` — @浮窗样式、高亮样式
- `apps/desktop/renderer/index.html` — @浮窗容器

## 验收标准

1. 群聊输入框输入 @ 弹出 Agent 选择器
2. 选择 Agent 后自动插入 @AgentName
3. 被 @ 的 Agent 必须回复（不跳过）
4. 气泡中 @AgentName 高亮显示
5. 键盘导航（上下键+Enter+Esc）正常
6. 点击外部或按 Esc 关闭选择器
