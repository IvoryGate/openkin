# 113 · WO-2 左栏样式与会话溢出交互修复

## 任务边界

本单用于修复桌面端左栏偏差，按参考图收口以下三项：

1. 左栏宽度与结构（不得被压缩成窄栏）
2. 会话卡片样式（含头像位）
3. 会话过多时仅展示前 N 条，并提供「更多会话」卡片跳转到专门界面

## 影响范围

- **直接影响**
  - `apps/desktop/renderer/index.html`
  - `apps/desktop/renderer/styles.css`
  - `apps/desktop/renderer/app.js`
- **不影响**
  - `packages/server` API contract
  - `packages/shared/contracts`
  - `apps/desktop/src/preload.ts` 接口语义

## 不做什么

- 不新增后端字段
- 不改 session 获取接口
- 不引入 emoji
- 不引入非 IconPark 作为产品图标规范依据

## 单一路径实施

1. 左栏升级为「窄工具栏 + 会话主栏」双层结构，恢复参考图比例
2. 会话项采用卡片化排版，增加固定头像槽位
3. 主栏列表最多展示 10 条，超出显示「更多会话」卡片
4. 点击「更多会话」进入专门会话界面，支持返回主界面与会话选择

## 验收标准

- 左栏视觉层级与参考图一致（主栏不再压缩）
- 会话列表有头像位与标题/副标题/时间三级信息
- 会话超过 10 条时不会拉高左栏，出现「更多会话」入口
- 进入专门会话界面可查看全部并选择会话返回
- `pnpm --filter @theworld/desktop check` 通过
- `pnpm verify` 通过

## 升级条件

- 需要改 API 才能实现 overflow 交互
- 连续两轮 `pnpm verify` 失败
