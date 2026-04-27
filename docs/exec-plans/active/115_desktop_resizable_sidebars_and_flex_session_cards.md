# 115 · Desktop 双侧栏可拖拽宽度与会话卡片弹性布局

## 任务边界

本单在 `114` 基础上做三项明确实现：

1. 左右侧栏默认宽度都为 `300px`
2. 左右侧栏都支持拖拽调整宽度
3. 左栏会话卡片改为弹性布局（flex）

## 影响范围

- `apps/desktop/renderer/index.html`
- `apps/desktop/renderer/styles.css`
- `apps/desktop/renderer/app.js`

## 不做什么

- 不改后端接口与 contract
- 不修改 preload API 语义
- 不做业务逻辑扩展（仅布局与交互）

## 验收标准

- 启动后左右栏均为 300px
- 拖动分割条可以实时改变对应侧栏宽度
- 会话卡片为 flex 布局，内容在不同宽度下保持可读
- `pnpm --filter @theworld/desktop check` 通过
- `pnpm verify` 通过
