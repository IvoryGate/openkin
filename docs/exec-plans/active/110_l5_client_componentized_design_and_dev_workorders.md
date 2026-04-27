# 110 · L5 客户端：参考图拆解、组件化设计与开发工单

## 任务边界

本单用于替代 `108/109` 的“原型优先”路径，冻结新的单一路径：

**参考图拆解 -> 组件 contract 冻结 -> 结合已实现能力生成开发工单 -> 分阶段客户端开发。**

本单是 L5 客户端开发入口，不承担 L3/L4/L1 contract 设计。

当前仓库客户端开发主线：**Electron（`apps/desktop`）**。  
`apps/web-console` 继续作为运维/控制台 surface，不承担桌面客户端主交互壳层。

## supersession 决策

- `108`（先接 Figma MCP 再原型）不再作为主路径
- `109`（设计资产治理）保留为治理基线，但不再单独驱动节奏
- 以后续客户端开发统一由 `110` 收口

## 影响范围（多层）

- **L5（直接）**
  - 客户端从“先原型”切换为“先组件拆解+工单化”
  - 设计输入改为参考图与设计 IA 文档双约束
- **L4（间接）**
  - L4 既有语义（context/memory/approval/background/plan）作为 UI 消费能力，不允许反向变更
- **L3/L1（不改）**
  - 不新增 API、DTO、event
  - 不扩展 SDK 对外接口

## 不做什么

- 不做新的跨层架构设计
- 不做 Figma/Pixso 平台接入决策争论
- 不在本单实现全量业务功能闭环
- 不为了 UI 需要新增服务端 contract
- 不在客户端 UI 中使用 emoji 作为图标或语义表达

## 参考图组件映射（冻结）

参考图：`assets/image-291c9a2a-dcde-4b07-b6fe-9d9a1f9c75ad.png`

- `AppShell/Desktop`
- `TopNav/MainTabs`
- `SessionRail/GroupSection`
- `SessionRail/SessionItem`
- `ConversationStage/EmptyHero`
- `ConversationStage/Composer`
- `InspectorRail/SkillsCard`
- `InspectorRail/ToolsCard`
- `InspectorRail/NotesCard`

设计基线文档：`docs/requirements/OPENKIN_DESKTOP_APP_DESIGN_INFORMATION_ARCHITECTURE.md` §11。
颜色与设计语言基线：`docs/requirements/OPENKIN_DESKTOP_COLOR_AND_DESIGN_LANGUAGE.md`。

## 分组件开发工单（budget 可串行执行）

### WO-1：壳层与导航骨架

- 目标：落 `AppShell/Desktop` + `TopNav/MainTabs`，固定三栏与顶栏结构
- 技术栈：`Electron`（基于 `apps/desktop`）
- 图标约束：统一使用 ByteDance IconPark 官方库
- 允许修改：
  - `apps/` 下客户端 UI 目录（按实际客户端路径）
  - `docs/requirements/`
  - `docs/exec-plans/active/`
- 不允许修改：
  - `packages/shared/contracts`
  - `packages/sdk/*` 对外接口定义
  - `packages/server` API contract
- 验收：
  - 主界面可渲染三栏壳层
  - `pnpm verify` 通过

### WO-2：左栏会话域组件化

- 目标：落 `SessionRail/GroupSection` + `SessionRail/SessionItem`
- 数据来源：仅复用既有 session surface（不新增字段）
- 验收：
  - 会话分组与列表状态可渲染
  - 选中态切换不影响中右栏布局
  - `pnpm verify` 通过

### WO-3：中区空态与输入区

- 目标：落 `ConversationStage/EmptyHero` + `ConversationStage/Composer`
- 数据来源：复用现有 run/message 能力，先做最小交互
- 验收：
  - 空态、输入态、提交后的 busy 态可切换
  - 不新增 run 相关协议字段
  - `pnpm verify` 通过

### WO-4：右栏信息卡片

- 目标：落 `InspectorRail/SkillsCard` / `ToolsCard` / `NotesCard`
- 数据来源：复用既有 tools/skills/status 或本地静态占位
- 验收：
  - 三卡片可独立渲染与折叠
  - 卡片替换不影响主布局
  - `pnpm verify` 通过

### WO-5：跨组件状态编排

- 目标：统一 idle/busy/failed 状态在三栏的表现
- 约束：只做前端表现层，不新增服务端状态类型
- 验收：
  - 关键状态在壳层与组件内一致
  - 无调试文本泄漏到最终 UI
  - `pnpm verify` 通过

### WO-6：联调与回归

- 目标：按既有测试回路完成客户端开发收尾
- 验收：
  - `pnpm verify` 通过
  - 文档与组件命名保持一致
  - 工单状态更新到 active/completed 索引

## 自动化约束与反馈回路

- 每个 WO 完成后必须执行：`pnpm verify`
- 若仅文档变更，可先执行：`pnpm lint:docs`
- 每轮反馈必须包含：
  - 当前 WO 编号
  - 修改文件列表
  - `pnpm verify` 结果
  - 是否命中升级条件

## 升级条件（命中即停）

- 需要新增/修改 L3 API、DTO、event
- 需要修改 SDK 对外接口
- 连续两轮无法通过 `pnpm verify`
- 组件设计无法映射到既有能力，需要架构级取舍

## budget 模式可复制工作单

```text
你当前处于 budget mode。

当前任务：
按 110 工单串行执行客户端组件开发（WO-1 到 WO-6），禁止跳单。

任务范围：
- 允许修改目录：
  - apps/（仅客户端相关）
  - docs/requirements/
  - docs/exec-plans/active/
  - docs/exec-plans/completed/
- 不允许修改目录：
  - packages/shared/contracts
  - packages/sdk/client 对外接口定义
  - packages/sdk/operator-client 对外接口定义
  - packages/server API contract

不做什么：
- 不新增跨层 contract
- 不扩展 endpoint/DTO/event
- 不重做架构方案

验收标准：
- 每个 WO 后 `pnpm verify` 通过
- 组件命名与 110 文档一致
- 明确记录本轮 WO 与测试结果

升级条件（命中任一立即停止并汇报）：
- 需要改动禁止目录才能继续
- 连续两轮无法通过 `pnpm verify`
- 需要在多个架构方案间做取舍
- 团队要求引入非 IconPark 主图标库或使用 emoji 作为产品图标
```
