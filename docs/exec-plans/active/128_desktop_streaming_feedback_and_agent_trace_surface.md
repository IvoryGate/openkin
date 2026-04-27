# 128 · Desktop 流式反馈与 Agent 过程可视化

## 任务边界

优化对话实时体验与过程可见性：

1. 用户发送后立即获得响应反馈（不等待终态）
2. 运行期间进行增量刷新，尽早展示模型输出
3. 将思考过程、工具调用结果、沙箱命令等过程信息以结构化样式展示

## 影响范围

- `apps/desktop/renderer/app.js`
- `apps/desktop/renderer/styles.css`
- `docs/exec-plans/active/README.md`

## 不做什么

- 不改后端 contract
- 不新增 API
- 不改桌面窗口与侧栏布局框架

## 验收标准

- 发送后 100ms 级别看到“正在响应”反馈
- run 期间消息区可增量更新，而非只在终态一次性刷新
- `tool/system` 角色内容可被区分展示
- `pnpm --filter @theworld/desktop check` 通过
