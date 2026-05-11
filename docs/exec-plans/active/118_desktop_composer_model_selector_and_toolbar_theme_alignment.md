# 118 · Desktop 输入栏模型选择组件与工具栏视觉对齐

## 任务边界

在 `117` 基础上精修输入栏交互与样式一致性：

1. `Context` 组件隐藏数字文本，仅保留环形可视化
2. 底栏左侧图标按钮高度提升，与 `Context` 组件视觉高度对齐
3. 模型选择改为单一选择组件（机器人图标 + 模型名 + 箭头）
4. 模型选择箭头具备未激发 / 激发状态变化
5. 模型选择弹层改为主题风格自绘菜单，不使用系统默认下拉样式

## 影响范围

- `apps/desktop/renderer/index.html`
- `apps/desktop/renderer/styles.css`
- `apps/desktop/renderer/app.js`

## 不做什么

- 不改后端 contract
- 不扩展 run/session 业务语义

## 验收标准

- `Context` 组件不显示百分比数字
- 左侧 icon 与 `Context` 组件高度一致
- 模型选择组件为单体交互控件，箭头状态可见
- 模型菜单弹层风格跟随主题
- `pnpm --filter @theworld/desktop check` 通过
