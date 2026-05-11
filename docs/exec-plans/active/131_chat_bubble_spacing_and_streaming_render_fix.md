# 131 · 对话气泡间距与流式渲染修复

## 任务边界

修复当前中区对话体验的两个问题：

1. 气泡尺寸/间距异常，避免出现大面积空白
2. 助手回答支持逐步渲染的流式视觉反馈

## 影响范围

- `apps/desktop/renderer/app.js`
- `apps/desktop/renderer/styles.css`
- `docs/exec-plans/active/README.md`

## 验收标准

- 用户消息与助手消息间距正常
- 气泡宽度贴合内容，不出现巨大空白框
- 助手消息在响应期间有持续增长的流式显示
- `pnpm --filter @theworld/desktop check` 通过
