# 132 · 左栏上置 cron/heartbeat，下置历史会话

## 任务边界

调整桌面端左侧栏信息布局：

1. 历史会话板块下移，贴近左栏下边缘
2. 左栏上方新增两个模块占位：`cron` 与 `heartbeat`
3. 保持现有会话渲染、选择与“更多会话”逻辑不变

## 影响范围

- `apps/desktop/renderer/index.html`
- `apps/desktop/renderer/styles.css`
- `docs/exec-plans/active/README.md`

## 验收标准

- 左栏上方可见 cron/heartbeat 模块
- 会话区域整体位于左栏下半区并贴近底部
- 会话滚动与点击交互正常
