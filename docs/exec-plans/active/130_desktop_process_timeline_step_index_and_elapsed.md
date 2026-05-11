# 130 · Desktop 过程时间线步骤序号与耗时标签

## 任务边界

在 `129` 折叠时间线卡片基础上增强可观测信息：

1. `tool/system` 过程卡片显示步骤序号（Step N）
2. 过程卡片显示相对耗时标签（例如 `+1.2s`）
3. 保持现有折叠交互与样式体系

## 影响范围

- `apps/desktop/renderer/app.js`
- `apps/desktop/renderer/styles.css`
- `docs/exec-plans/active/README.md`

## 不做什么

- 不改后端 contract
- 不新增 trace API
- 不改变消息角色语义

## 验收标准

- `tool/system` 卡片头包含 `Step N`
- 卡片头显示耗时标签（有时间戳时）
- `pnpm --filter @theworld/desktop check` 通过
