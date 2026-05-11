# 156 — 客户端连接失败：renderMarkdown 重复声明导致 SyntaxError

## 状态：已完成 ✓

## 问题描述

客户端启动后无法连接后端，所有后端数据（会话列表、消息、Agent 信息等）均无法渲染。

**根本原因**：`app.js` 中 `renderMarkdown` 函数被声明了两次：
- 第 952 行：早期简单版本（用于聊天消息气泡）
- 第 4883 行：增强版本（用于频道消息气泡，支持代码块提取保护、内联代码、更精细的列表处理）

在 ES Module 严格模式下，`function` 声明的重复会导致 `SyntaxError: Identifier 'renderMarkdown' has already been declared`，整个脚本无法执行，后端连接逻辑完全没有运行。

## 修复方案

1. 删除第 952 行的旧版 `renderMarkdown` 函数声明
2. 保留第 4883 行的增强版 `renderMarkdown` 函数（更完善的 Markdown 渲染，包含 XSS 防护、代码块提取保护、内联代码支持等）
3. 两个调用点（第 1756 行聊天气泡、第 4994 行频道气泡）都将使用增强版渲染器

## 影响文件

- `apps/desktop/renderer/app.js`

## 验收标准

1. 浏览器控制台不再出现 `renderMarkdown` 重复声明错误
2. 客户端能正常连接后端 `http://127.0.0.1:3333`
3. 会话列表、消息、Agent 信息等正常渲染
4. 聊天气泡和频道气泡均能正确渲染 Markdown 内容
5. `pnpm verify` 通过
