# 120 · Desktop 对话气泡 Markdown 渲染

## 任务边界

在 `119` IM 气泡消息样式基础上，增强消息内容展示：

1. 对话气泡支持 Markdown 渲染（标题、段落、列表、代码块、行内代码、链接、强调）
2. 兼容大模型常见输出格式（多段落、代码 fenced block）
3. 保持安全渲染，避免直接注入未转义 HTML

## 影响范围

- `apps/desktop/renderer/app.js`
- `apps/desktop/renderer/styles.css`

## 不做什么

- 不改后端 contract
- 不修改 run/session 主流程
- 不在本单引入复杂富文本编辑能力

## 验收标准

- 消息气泡中的 Markdown 可正确渲染为结构化内容
- 代码块、行内代码、列表和链接有清晰样式
- 非法/危险 HTML 不直接执行
- `pnpm --filter @theworld/desktop check` 通过
