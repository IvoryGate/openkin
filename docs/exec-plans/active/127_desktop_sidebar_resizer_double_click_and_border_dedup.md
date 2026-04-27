# 127 · Desktop 侧栏拖拽双击复位与分割线去重

## 任务边界

在现有左右侧栏拖拽能力上做交互与视觉精修：

1. 拖拽分割条支持双击恢复默认宽度
2. 移除左栏原有右边框与右栏原有左边框
3. 仅保留分割条本身作为边界线，避免重复线条

## 影响范围

- `apps/desktop/renderer/app.js`
- `apps/desktop/renderer/styles.css`
- `docs/exec-plans/active/README.md`

## 不做什么

- 不改后端 contract
- 不改侧栏最小/最大宽度规则
- 不改会话与消息业务逻辑

## 验收标准

- 双击左/右分割条可恢复默认宽度（300）
- 左栏右边线与右栏左边线不再重复出现
- 分割条视觉与拖拽交互保持正常
- `pnpm --filter @theworld/desktop check` 通过
