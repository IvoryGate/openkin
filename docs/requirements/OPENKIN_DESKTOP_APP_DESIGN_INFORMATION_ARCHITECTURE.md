# OpenKin Desktop App Design Information Architecture

> 状态：active draft（2026-04-27）  
> 范围：当前项目的桌面端应用设计（Pixso/Figma 设计文件组织与交付约束）  
> 目的：冻结“一个文件内如何分页面、分图层、分组件”，避免持续返工与画布污染。

---

## 1. 目标与边界

本文件只解决设计资产组织问题，不讨论后端协议或 SDK contract。

本文件要冻结：

- 设计文件层级（File / Page / Frame / Layer）
- 页面分配与职责边界
- 组件与状态的归属页
- 命名规范与尺寸基线
- 交付与验收清单

本文件不做：

- 视觉风格大改（配色、品牌系统另文档维护）
- 产品需求优先级讨论
- 前端实现细节（代码层 token、组件 API）

---

## 2. 文件结构理念（核心）

OpenKin 桌面应用采用：

- **一个设计 File**：承载当前项目的完整桌面端设计资产
- **多个 Page**：按职责划分（交付页、状态页、组件页、归档页）
- **Frame 是交付单位**：每个最终界面必须是独立 Frame

层级关系：

`File > Page > Frame > Layer`

执行原则：

1. 页面负责组织，不直接承载交付。
2. 交付内容必须落在 Frame 中，不允许散落在页面根节点。
3. 每次改动前先选中目标 Frame，禁止默认根层写入。
4. 历史草稿不与交付画板同页混放。

---

## 3. 页面分配（当前项目标准）

### `00_Cover`

用途：

- 项目名、版本号、更新时间、负责人
- 本次设计变更摘要（1-2 屏信息）

### `01_Screens_Desktop`

用途：

- 主交付页面（桌面端标准画板）

建议包含：

- `OpenKin_Notes_1440`
- `OpenKin_Schedule_1440`
- `OpenKin_Calendar_1440`

规则：

- 一屏一 Frame
- 仅保留“当前交付版本”，历史版本移动至归档页

### `02_Screens_States`

用途：

- 同一界面不同状态（空态/加载态/错误态/权限态）
- 仅做状态展示，不承载组件定义

### `03_Components_Core`

用途：

- 核心布局组件

建议组件：

- `Sidebar/Main`
- `Center/Landing`
- `Shell/Desktop`

### `04_Components_RightPanel`

用途：

- 右侧信息区组件与变体

建议组件：

- `RightPanel/Mode=Notes`
- `RightPanel/Mode=Schedule`
- `RightPanel/Mode=Calendar`

### `05_Tokens_Styles`

用途：

- 颜色、字体、间距、圆角、阴影、栅格基线

### `06_Flows_Prototype`

用途：

- 页面间跳转关系
- Demo 演示路径

### `99_Archive`

用途：

- 废弃草稿与历史版本

硬规则：

- 不可删但必须隔离
- 不得在交付评审时引用归档页

---

## 4. 桌面尺寸与网格基线

当前项目冻结以下尺寸策略：

- 主交付基线：`1440 x 900`
- 展示扩展稿：`1920 x 1080`（可选）

三栏布局基线（1440）：

- 左栏：`260`
- 中区：`860`
- 右栏：`320`

要求：

- 所有桌面主屏保持同一栏宽，不允许按状态随意改栏宽。
- 状态差异只发生在内容层，不发生在壳层网格。

---

## 5. 命名规范

### 页面命名

格式：`NN_Category`

例如：

- `01_Screens_Desktop`
- `04_Components_RightPanel`

### Frame 命名

格式：`Module_State_Size`

例如：

- `OpenKin_Notes_1440`
- `OpenKin_Schedule_1440`

### 组件命名

格式：`Domain/Component[/Variant]`

例如：

- `Sidebar/Main`
- `RightPanel/Mode=Notes`

禁止：

- `body` / `div` / `frame 1` / `复制 2` 作为最终交付命名

---

## 6. 图层关系与清理规则

每个交付 Frame 必须满足：

1. 顶层仅三大容器：
   - `LeftPane`
   - `CenterPane`
   - `RightPane`
2. 容器内再细分业务层，不超过三级深度（特殊图标/蒙层除外）。
3. 不允许跨 Frame 的漂移图层。

建议图层骨架（以 Notes 为例）：

- `OpenKin_Notes_1440`
  - `LeftPane`
    - `SectionToday`
    - `SessionList`
    - `BottomActions`
  - `CenterPane`
    - `TopTabs`
    - `Hero`
    - `Composer`
  - `RightPane`
    - `EnergyBlock`
    - `ToolboxBlock`
    - `ToggleBlock`
    - `NotesBlock`

---

## 7. 组件化策略（本项目建议）

先稳定 Screen，再抽组件：

1. 在 `01_Screens_Desktop` 完成三态视觉对齐。
2. 抽壳层组件到 `03_Components_Core`：
   - `Shell/Desktop`
   - `Sidebar/Main`
   - `Center/Landing`
3. 抽右栏组件到 `04_Components_RightPanel`，建立三态变体。
4. 用实例回填 Screen 页面，验证实例替换稳定。

组件抽取验收：

- 组件实例替换后不破版
- 文案可覆盖（最小字段可编辑）
- 变体切换不引发布局位移

---

## 8. 交付流程（执行清单）

每次迭代按以下流程：

1. 新增版本前，先把旧稿移入 `99_Archive`。
2. 仅在目标页面操作，不跨页混改。
3. 每次只处理一个状态（Notes/Schedule/Calendar）。
4. 完成后同步更新 Cover 页版本号与变更摘要。

发布前最小检查：

- [ ] 页面命名符合规范
- [ ] 三个主屏尺寸一致（1440x900）
- [ ] 三栏宽度一致（260/860/320）
- [ ] 无 `body/div/frame 1` 等临时命名
- [ ] 归档页与交付页已隔离

---

## 9. 与当前项目的对齐说明

本文件服务于当前 OpenKin 桌面应用设计工作，作为设计资产组织层面的统一约束。

颜色与开发设计语言见：`OPENKIN_DESKTOP_COLOR_AND_DESIGN_LANGUAGE.md`。

若后续出现以下情况，需要更新本文件：

- 交付尺寸从 1440 基线迁移到其他标准
- 三栏结构改为四栏或单栏响应式主导
- 组件库策略从页面内维护迁移到独立设计系统文件

---

## 10. 立即可执行动作

1. 在现有 File 内创建本文件定义的 8 个 Page。
2. 把现有可用主稿移动到 `01_Screens_Desktop`。
3. 把历史草稿全部移动到 `99_Archive`。
4. 先把主稿重命名为：
   - `OpenKin_Notes_1440`
5. 再复制生成：
   - `OpenKin_Schedule_1440`
   - `OpenKin_Calendar_1440`

完成以上 5 步后，设计文件会从“实验态”进入“可维护态”。

---

## 11. 参考图驱动的组件拆解（开发前冻结）

本节基于当前参考图（`assets/image-291c9a2a-dcde-4b07-b6fe-9d9a1f9c75ad.png`）冻结客户端开发前的组件边界。

### 11.1 画面结构与组件域

按三栏结构拆解为 4 个组件域：

1. `AppShell/Desktop`
   - 顶部全局导航（聊天/频道/工作台/知识库/社群）
   - 全局留白、窗口级布局、左右面板边界
2. `SessionRail/Left`
   - 时间分组（今天/昨天/本周）
   - 会话列表项（标题、摘要、时间、选中态）
   - 底部操作入口（设置/辅助入口）
3. `ConversationStage/Center`
   - 空态 Hero（图标、标题、副标题）
   - 输入区（模型选择、工具入口、提交）
   - 对话内容区（进入开发阶段后替换空态）
4. `InspectorRail/Right`
   - 结构化卡片：技能包、工具包、笔记区
   - 列表项与快捷动作（搜索、开关、分组）
   - 轻量建议与提示区

### 11.2 组件命名与最小层级

交付层组件命名冻结如下（Figma 与代码同名）：

- `AppShell/Desktop`
- `TopNav/MainTabs`
- `SessionRail/GroupSection`
- `SessionRail/SessionItem`
- `ConversationStage/EmptyHero`
- `ConversationStage/Composer`
- `InspectorRail/SkillsCard`
- `InspectorRail/ToolsCard`
- `InspectorRail/NotesCard`

每个组件最多三层嵌套；超过三层必须拆为子组件，不允许继续堆叠临时图层。

### 11.3 与当前已实现能力的对齐（仅复用，不扩约）

客户端首轮开发只允许复用已实现能力：

- 会话与消息：`sdk/client` 已有 session/message/run/cancel/health surface
- 运维/观测：`sdk/operator-client` 已有 tasks/logs/tools/skills/session runs/status surface
- 产品语义：L4 已有 context/memory/approval/background/plan 等既有产品语义

明确不做：

- 不新增服务端 endpoint / DTO / event
- 不新增 SDK 外部能力面
- 不让 UI 组件反向定义 L3/L4 contract

### 11.4 开发前验收清单（组件视角）

- [ ] 参考图已拆成上述 9 个组件并命名一致
- [ ] 左中右三栏宽度与 `260/860/320` 基线一致
- [ ] 空态与输入区组件可独立替换，不破坏 `AppShell/Desktop`
- [ ] 右侧卡片全部可独立折叠或替换，不影响中区布局
- [ ] 组件映射只引用现有 SDK/L4 能力，不引入新 contract

