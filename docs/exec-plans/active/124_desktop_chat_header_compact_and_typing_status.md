# 124 · Desktop 会话头紧凑化与输入中状态

## 任务边界

优化中间会话头占位与状态表达，贴近 IM 体验：

1. 取消大标题式会话编号展示，改为贴近上边缘的紧凑会话头
2. 会话头显示 agent 名称
3. 下方显示一行小字状态
4. 模型输出中显示“对方正在输入中...”

## 影响范围

- `apps/desktop/renderer/app.js`
- `apps/desktop/renderer/styles.css`

## 不做什么

- 不改后端 contract
- 不调整会话列表数据结构

## 验收标准

- 会话头明显更靠上，占位更小
- 展示 agent 名称与小字状态
- 运行中可见“对方正在输入中...”
- `pnpm --filter @theworld/desktop check` 通过
