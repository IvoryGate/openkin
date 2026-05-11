# 117 · Desktop 输入栏视觉对齐与实时上下文环组件

## 任务边界

本单聚焦 `116` 输入栏的视觉与交互精修，对齐参考稿：

1. 底栏左侧操作入口改为无边框样式（模型选择、联网、附件、图片、控制）
2. 模型选择图标替换为数学风格图标
3. 模型区与右侧区之间使用真实短竖线分隔
4. 右侧 `Context` 改为圆角矩形组件
5. `Context` 内环形为实时渲染组件（基于当前输入与工具状态动态变化），非静态 icon

## 影响范围

- `apps/desktop/renderer/index.html`
- `apps/desktop/renderer/styles.css`
- `apps/desktop/renderer/app.js`

## 不做什么

- 不新增后端接口
- 不改变 run/session 主流程
- 不引入额外 UI 依赖库

## 验收标准

- 左侧底栏按钮默认无边框、无胶囊外框
- 模型图标已替换为数学感图形
- 左右分组间有短竖线（非字符）
- 右侧 `Context` 为圆角矩形并显示实时环形占用
- 输入内容或开关状态变化时，环形占用值同步更新
- `pnpm --filter @theworld/desktop check` 通过
