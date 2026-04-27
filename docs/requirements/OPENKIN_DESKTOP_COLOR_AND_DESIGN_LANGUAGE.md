# theworld Desktop Color System and Design Language

> 状态：active draft（2026-04-27）  
> 输入来源：参考图 `assets/image-94637fb2-4be4-464c-b9be-08d124e466f8.png` + `网页设计基础规范.md`  
> 目标：把视觉参考收口为可开发的设计语言（token + 组件规则 + 状态规则）。

---

## 1. 设计目标与边界

本文件解决三个问题：

1. 从参考图提炼稳定颜色体系
2. 给出开发可直接消费的 design token
3. 约束组件状态和排版层级，降低实现偏差

本文件不做：

- 不重做品牌视觉策略
- 不扩展后端协议或 SDK contract
- 不定义业务流程优先级

---

## 2. 参考图颜色特征（视觉分析）

参考图整体是低饱和、中高明度的「纸感中性色」体系，特点如下：

- **主背景接近暖灰白**，不是纯白
- **面板层级靠轻微明度差**，不是强阴影
- **强调色偏炭灰/石墨灰**，用于按钮与关键可点击项
- **交互高亮很克制**，主要通过边框、填充和字重变化
- **阅读区对比度靠文本灰阶**，不是大面积彩色块

---

## 3. 颜色系统（Core Palette）

以下为开发基线色板（Hex），允许在实现中有微小偏差（±3%）：

### 3.1 Primary / Accent

- `brand.primary`: `#4A4A4A`（主操作按钮、关键图标）
- `brand.primary.hover`: `#3F3F3F`
- `brand.primary.active`: `#353535`
- `brand.onPrimary`: `#F5F5F2`

### 3.2 Neutral（页面主体系）

- `neutral.0`: `#FFFFFF`（高亮前景）
- `neutral.50`: `#F8F7F4`（页面底色）
- `neutral.100`: `#F3F2EE`（一级面板）
- `neutral.150`: `#EEEDE8`（二级面板）
- `neutral.200`: `#E7E5DF`（分组背景）
- `neutral.300`: `#D8D5CD`（边框/分割线）
- `neutral.500`: `#A8A59D`（弱文本/占位）
- `neutral.700`: `#6E6B64`（次要文本）
- `neutral.900`: `#2D2C29`（主文本）

### 3.3 Semantic（功能语义）

- `semantic.success`: `#6F8A6A`
- `semantic.warning`: `#B08A5A`
- `semantic.danger`: `#A36262`
- `semantic.info`: `#7A8798`

语义色使用规则：默认只用于状态徽标、提示条、轻量边框，不用于大面积背景。

---

## 4. 语义 token 映射（推荐）

### 4.1 Background / Surface

- `bg.app = neutral.50`
- `bg.sidebar = neutral.100`
- `bg.panel = neutral.100`
- `bg.panelMuted = neutral.150`
- `bg.input = neutral.0`

### 4.2 Border / Divider

- `border.default = neutral.300`
- `border.soft = #EDEBE5`
- `border.strong = #CFCBC1`
- `border.focus = brand.primary`

### 4.3 Text

- `text.primary = neutral.900`
- `text.secondary = neutral.700`
- `text.tertiary = neutral.500`
- `text.inverse = brand.onPrimary`

### 4.4 Interactive

- `interactive.primary.bg = brand.primary`
- `interactive.primary.fg = brand.onPrimary`
- `interactive.primary.hover = brand.primary.hover`
- `interactive.primary.active = brand.primary.active`
- `interactive.ghost.hover = neutral.150`
- `interactive.selected.bg = #ECEAE3`

---

## 5. 排版与间距语言（结合参考规范）

参考 `网页设计基础规范.md`，并对桌面应用做收口：

### 5.1 Typography

- 最小正文字号：`12px`
- 常规正文：`14px`
- 辅助说明：`12px`
- 小标题：`16px`
- 页面标题：`20px`

字重：

- `regular (400)`：正文
- `medium (500)`：组件标题/标签
- `semibold (600)`：关键强调

行高：

- `12px` -> `18px`
- `14px` -> `22px`
- `16px` -> `24px`
- `20px` -> `30px`

### 5.2 Spacing（8pt 体系）

- 基础单位：`4`
- 常用间距：`4/8/12/16/24/32`
- 卡片内边距默认：`16`
- 组件组间距默认：`12`
- 栏间大间距默认：`24`

---

## 6. 组件级应用规则（对齐 110 工单）

### 6.1 `AppShell/Desktop`

- 背景：`bg.app`
- 左右栏与中区通过 `border.soft` 分割
- 不使用强阴影，优先 1px 分割线

### 6.2 `SessionRail/*`

- 默认背景：`bg.sidebar`
- 选中项背景：`interactive.selected.bg`
- 会话标题：`text.primary`
- 摘要与时间：`text.tertiary`

### 6.3 `ConversationStage/*`

- 主内容背景：`bg.app`
- 输入框背景：`bg.input`
- 输入框边框：`border.default`
- 发送按钮：`interactive.primary.*`

### 6.4 `InspectorRail/*`

- 卡片背景：`bg.panel`
- 卡片分组背景：`bg.panelMuted`
- 卡片标题：`text.secondary`
- 功能项图标：默认 `text.secondary`，悬停 `text.primary`

---

## 7. 状态设计语言

统一状态集合：

- `idle`
- `hover`
- `focus`
- `selected`
- `disabled`
- `loading`
- `error`

颜色表达规则：

- `focus`：`border.focus` + 轻微外环（10% alpha）
- `disabled`：对组件整体降至 45%-60% 对比，不改布局
- `error`：`semantic.danger` 仅用于提示与关键边界，不污染整块背景

---

## 8. 可访问性与实现约束

- 正文文本与背景对比建议不低于 WCAG AA（4.5:1）
- 辅助文本不低于 3:1（仅用于非关键信息）
- 颜色不是唯一语义渠道：错误/成功必须附带 icon 或文案
- 不允许直接在组件里写死 hex，统一通过 token 引用
- 不允许在 UI 文案、按钮、系统提示中使用 emoji

---

## 9. 图标语言规范

统一要求：

- 图标库固定为 ByteDance IconPark 官方库
- 不混用其他来源图标库作为主工具图标
- 图标需保持统一 stroke、尺寸与视觉风格

推荐资源：

- [ByteDance IconPark Official](https://iconpark.oceanengine.com/official)

落地规则：

- 工具栏、侧栏、功能按钮优先使用 line 风格图标
- 默认尺寸 `16/18/20` 三档，不使用任意值
- 图标颜色默认跟随 `text.secondary`，hover 切到 `text.primary`
- 危险操作图标仅在确认态使用 `semantic.danger`
- emoji 仅允许出现在用户生成内容中，不可作为产品 UI 资产

---

## 10. 开发落地建议

1. 先在客户端定义 token 文件（如 `tokens/color.ts` 或 CSS variables）
2. `WO-1` 优先落壳层、文本和边框 token
3. `WO-2`~`WO-4` 按组件域映射语义 token
4. `WO-5` 统一状态语义，不新增服务端状态字段
5. 每轮通过 `pnpm verify` 验收

---

## 11. 与现有文档关系

- 结构与组件边界：`OPENKIN_DESKTOP_APP_DESIGN_INFORMATION_ARCHITECTURE.md`
- 开发执行顺序：`110_l5_client_componentized_design_and_dev_workorders.md`
- 模型工作方式：`MODEL_OPERATING_MODES.md` / `MODEL_PROMPT_CHEATSHEET.md`
