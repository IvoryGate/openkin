# 121 · Desktop 对话公式渲染（KaTeX）

## 任务边界

在 `120` Markdown 渲染基础上，补齐数学公式展示能力：

1. 支持行内公式（`$...$`、`\(...\)`）
2. 支持块级公式（`$$...$$`、`\[...\]`）
3. 在消息气泡中使用 KaTeX 渲染，保持与 Markdown 共存

## 影响范围

- `apps/desktop/renderer/index.html`
- `apps/desktop/renderer/app.js`
- `apps/desktop/renderer/styles.css`
- `apps/desktop/package.json`（依赖声明）

## 不做什么

- 不改后端 contract
- 不引入服务端公式预渲染
- 不扩展编辑器侧公式输入辅助

## 验收标准

- 气泡中公式可渲染为 KaTeX 输出
- Markdown 与公式混排正常
- 公式错误不导致消息渲染中断
- `pnpm --filter @theworld/desktop check` 通过
