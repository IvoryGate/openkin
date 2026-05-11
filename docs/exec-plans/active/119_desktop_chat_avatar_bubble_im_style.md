# 119 · Desktop 对话区 IM 化（头像 + 气泡）

## 任务边界

将中间消息列表从纯文本卡片改为 IM 风格对话区：

1. 每条消息显示头像与气泡
2. 助手消息左对齐，用户消息右对齐
3. 气泡具有可读宽度约束、圆角、行高和留白
4. 保留现有会话数据流与发送逻辑，不改后端 contract

## 影响范围

- `apps/desktop/renderer/styles.css`
- `apps/desktop/renderer/app.js`
- （可选）`apps/desktop/renderer/index.html` 无结构性破坏修改

## 不做什么

- 不改 run/session API
- 不引入新 UI 框架
- 不调整侧栏布局逻辑

## 验收标准

- 对话区呈现“头像 + 气泡”样式，视觉接近 IM 应用
- 用户/助手消息左右分侧明确
- 多行文本与长文本换行可读
- `pnpm --filter @theworld/desktop check` 通过
