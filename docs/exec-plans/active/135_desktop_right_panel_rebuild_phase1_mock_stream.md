# 135 · Desktop 右栏重构 Phase 1（Mock 信息流面板）

## 任务边界

在桌面端右栏完成一套可复用的信息流面板骨架，仅接入 mock 数据，不引入真实后端依赖：

1. 输入捕捉区（CaptureBox）
2. 候选卡片流（StreamList + CandidateCard）
3. 状态筛选（全部 / 待确认 / 已采纳）
4. 冻结区折叠面板（FrozenSection，默认收起）
5. 底部摘要（FooterSummary）

## 目录与模块拆分

新增目录：`apps/desktop/renderer/components/right-panel/`

- `RightPanel.js`
- `RightPanelHeader.js`
- `CaptureBox.js`
- `StreamList.js`
- `CandidateCard.js`
- `FrozenSection.js`
- `FooterSummary.js`
- `types.js`
- `mockData.js`

约束：

- 每个模块职责单一，便于后续替换数据源
- 先完成视觉与交互骨架，不做复杂业务逻辑
- 组件间通过显式 props / 回调连接，降低耦合

## 影响范围

- `apps/desktop/renderer/index.html`
- `apps/desktop/renderer/styles.css`
- `apps/desktop/renderer/app.js`
- `apps/desktop/renderer/components/right-panel/*`
- `docs/exec-plans/active/README.md`

## 验收标准

- 右栏为固定 360px 信息流面板，垂直分层清晰
- Header 分段筛选具备可控 state 与视觉反馈
- CaptureBox 输入提交后清空，并新增 mock 候选项
- StreamList 可按筛选状态显示候选卡片
- FrozenSection 默认收起，可展开/收起
- FooterSummary 展示待确认数、已采纳数、最近 heartbeat 时间
- 空状态文案可见：`暂无候选内容，记录点什么吧。`
