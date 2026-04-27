# 114 · Desktop 壳层比例严格对齐参考图

## 任务边界

本单用于对齐 `image-c2538e83-8d1b-409b-aefe-eaa7ac01c5ed.png` 的壳层比例与左栏视觉结构，解决当前实现（`image-3378fd7a-ef34-4be9-8a76-6a3ca143fa37.png`）偏差。

核心要求：

1. 左中右三栏比例按参考图重排（左栏不得异常放大或压缩）
2. 左栏会话项改为参考图样式（头像位 + 品牌行 + 标题行 + 时间）
3. 会话列表超量时保留「更多会话」卡片，进入专门会话界面

## 影响范围

- `apps/desktop/renderer/index.html`
- `apps/desktop/renderer/styles.css`
- `apps/desktop/renderer/app.js`

## 不做什么

- 不改后端接口与 contract
- 不改 preload API 语义
- 不引入 emoji
- 不扩展业务功能（只做壳层/列表视觉与交互）

## 单一路径实施

1. 固定三栏比例接近参考图（左约 23%，中约 53%，右约 24%）
2. 左栏拆成 mini-rail + session-main，main 区保持单列会话卡片
3. 会话卡片头像位改为图标槽，不使用文字占位 `OK`
4. 默认列表仅显示前 8 条，尾部显示「更多会话」入口
5. 点击「更多会话」进入专门列表页，支持返回与会话选择

## 验收标准

- 视觉比例与参考图同量级（1024 宽下左栏约 220~250px，右栏约 230~260px）
- 左栏会话卡片结构与参考图一致（头像、品牌、标题、时间）
- 会话过多时左栏高度稳定，出现更多会话卡片
- `pnpm --filter @theworld/desktop check` 通过
- `pnpm verify` 通过
