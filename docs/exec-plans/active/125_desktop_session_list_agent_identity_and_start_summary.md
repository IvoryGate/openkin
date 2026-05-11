# 125 · Desktop 左栏会话按 Agent 身份展示

## 任务边界

为后续多身份 Agent 场景，重构左栏会话项展示语义：

1. 会话标题显示对应 Agent 名称
2. 会话头像与 Agent 对应（可区分不同 Agent）
3. 会话副标题显示“对话开始摘要”，便于快速识别会话内容

## 影响范围

- `apps/desktop/renderer/app.js`
- `apps/desktop/renderer/styles.css`
- `docs/exec-plans/active/README.md`

## 不做什么

- 不改后端 contract
- 不新增 API
- 不改中区消息交互逻辑

## 验收标准

- 左栏每个会话项可看到 agent 名称
- 头像可区分不同 agent
- 副标题是首轮对话摘要（或合理占位）
- `pnpm --filter @theworld/desktop check` 通过
