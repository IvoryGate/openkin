# 155-C4 — 频道消息 Markdown 渲染增强

> **状态**：📋 待开发
> **前置**：无
> **预估**：1d
> **优先级**：P1 — Agent 回复质量差

---

## 目标

频道消息气泡中的 Agent 回复支持 Markdown 渲染，包括代码块、加粗、列表、链接等。

## 当前问题

频道消息当前用 `escapeHtml(msg.content)` 渲染，Agent 回复中的代码块、列表等全部显示为纯文本，可读性极差。

## 实现方案

### 1. 渲染策略

- Agent 消息：使用 Markdown 渲染器（复用聊天 Tab 的 `renderMarkdownToHtml` 或引入 marked.js）
- 用户消息：保持纯文本渲染

### 2. 支持的 Markdown 元素

- **加粗/斜体**：`**bold**` / `*italic*`
- **行内代码**：`` `code` ``
- **代码块**：``` ```lang ... ``` ```（语法高亮 + 复制按钮）
- **列表**：有序/无序
- **链接**：`[text](url)` 自动转为可点击链接
- **标题**：`## Heading`（缩小字体）
- **表格**：简单表格渲染

### 3. 代码块

- 语法高亮（复用 highlight.js 或 Prism）
- 代码块右上角"复制"按钮
- 与聊天 Tab 代码块样式一致

### 4. XSS 防护

- Markdown 渲染需做 sanitize，防止 Agent 回复中注入恶意 HTML/JS

## 涉及文件

- `apps/desktop/renderer/app.js` — 引入 Markdown 渲染，修改 `renderChannelMessages`
- `apps/desktop/renderer/styles.css` — 气泡内 Markdown 样式

## 验收标准

1. Agent 回复中代码块有语法高亮和复制按钮
2. 加粗/斜体/列表/链接正确渲染
3. 用户消息仍为纯文本
4. 不存在 XSS 风险
5. 暗色主题下 Markdown 样式正常
