# 122 · Desktop 对话复制增强（代码块与公式）

## 任务边界

在 `120` Markdown 与 `121` KaTeX 基础上补齐复制体验：

1. 代码块支持一键复制原始代码文本
2. 块级公式支持一键复制 LaTeX 表达式
3. 复制反馈使用轻量文案状态（已复制/失败）

## 影响范围

- `apps/desktop/renderer/app.js`
- `apps/desktop/renderer/styles.css`

## 不做什么

- 不改后端 contract
- 不引入额外 UI 依赖
- 不改消息协议格式

## 验收标准

- 代码块右上角出现复制按钮，点击可复制
- 块级公式右上角出现复制按钮，点击可复制 LaTeX
- 复制失败有可见反馈
- `pnpm --filter @theworld/desktop check` 通过
