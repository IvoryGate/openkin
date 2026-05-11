# 133 · 左栏 heartbeat 心电图区（节律动画）

## 任务边界

增强左栏 heartbeat 区域的可视化表达：

1. 在 `heartbeat` 模块与历史会话区之间新增心电图动画区
2. 动画采用可配置节律（固定节拍序列）而非随机跳动
3. 心电图区占据中间剩余空间，作为状态感知主视觉

## 影响范围

- `apps/desktop/renderer/index.html`
- `apps/desktop/renderer/styles.css`
- `apps/desktop/renderer/app.js`
- `docs/exec-plans/active/README.md`

## 验收标准

- 左栏中部出现持续跳动的心电图动画
- 心电图区自动填充 heartbeat 与历史会话之间空白
- 节律有明显“心跳”峰值变化，非纯线性滚动
- `pnpm --filter @theworld/desktop check` 通过
