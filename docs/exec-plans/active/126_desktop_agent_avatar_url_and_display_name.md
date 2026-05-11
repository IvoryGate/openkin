# 126 · Desktop Agent 真实头像与显示名接入

## 任务边界

在 `125` 左栏 agent 身份展示基础上增强真实感：

1. 优先展示 Agent 真实头像 URL（若可用）
2. 优先展示 Agent 显示名（若可用）
3. 无头像时回退字母头像与稳定配色

## 影响范围

- `apps/desktop/src/preload.ts`
- `apps/desktop/src/global.d.ts`
- `apps/desktop/renderer/app.js`
- `apps/desktop/renderer/styles.css`
- `docs/exec-plans/active/README.md`

## 不做什么

- 不改后端 contract
- 不新增 API
- 不改会话业务流程

## 验收标准

- 有头像 URL 的 agent 在左栏显示头像图片
- 有显示名的 agent 标题使用显示名
- 无头像时仍稳定回退到字母头像
- `pnpm --filter @theworld/desktop check` 通过
