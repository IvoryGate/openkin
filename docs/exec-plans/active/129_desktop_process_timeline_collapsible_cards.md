# 129 · Desktop 过程时间线卡片（可折叠）

## 任务边界

在 `128` 过程可视化基础上继续增强：

1. 将 `tool/system` 消息改为“过程时间线卡片”
2. 卡片支持折叠/展开
3. 默认折叠长内容，降低主对话阅读干扰

## 影响范围

- `apps/desktop/renderer/app.js`
- `apps/desktop/renderer/styles.css`
- `docs/exec-plans/active/README.md`

## 不做什么

- 不改后端 contract
- 不改 run/session 接口
- 不新增右栏复杂流程图组件

## 验收标准

- `tool/system` 消息以卡片形式展示
- 卡片可点击展开/折叠
- 内容过长时默认折叠
- `pnpm --filter @theworld/desktop check` 通过
