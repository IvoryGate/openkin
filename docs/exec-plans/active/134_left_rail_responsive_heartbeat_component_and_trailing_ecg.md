# 134 · 左栏响应式 + heartbeat 组件化 + 拖尾心电图

## 任务边界

修复左栏布局与 heartbeat 可视化体验：

1. 左栏采用响应式分区，确保历史会话区域不被挤出
2. heartbeat 与心电图合并为同一组件，不再拆分为独立区块
3. 心电图改为“有高低起伏 + 拖尾移动”效果，避免整条实线观感

## 影响范围

- `apps/desktop/renderer/index.html`
- `apps/desktop/renderer/styles.css`
- `apps/desktop/renderer/app.js`
- `docs/exec-plans/active/README.md`

## 验收标准

- 小/中等窗口高度下历史会话仍完整可见并可滚动
- heartbeat 组件内部包含心电图区
- 心电图存在基线起伏、峰值、拖尾透明渐变效果
- `pnpm --filter @theworld/desktop check` 通过
