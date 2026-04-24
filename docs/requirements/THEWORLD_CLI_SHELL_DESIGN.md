# TheWorld CLI Shell Design

> **状态：被更高层 shell parity 设计扩展（2026-04-24）。** 本文继续作为 `059` / `060` 的上游 shell 冻结文档，但新的主实施路径已升级为 [`THEWORLD_CLI_SHELL_PARITY_DESIGN.md`](./THEWORLD_CLI_SHELL_PARITY_DESIGN.md) 与 `067`–`072`。

## 目标

本文件将两份参考报告中的可吸收结论，收口为 TheWorld 下一阶段 CLI 的**冻结设计方向**。

它解决的是：

- TheWorld CLI 下一阶段该吸收哪些热门 CLI/TUI 设计语言
- 哪些能力应该继续留在 CLI shell 层，不上升为跨层 contract
- 哪些增量适合继续拆成 budget-mode 可执行的小工单

它**不**替代：

- `docs/requirements/PROJECT_CLI.md` 的总需求草案
- 已完成的 `054`–`058` 交互/TUI 工单
- 任何新的 Service / SDK contract 设计
- `THEWORLD_TUI_PRODUCT_DESIGN.md` 对全屏 TUI 的产品级冻结
- `THEWORLD_CLI_SHELL_PARITY_DESIGN.md` 对整套 CLI shell 的更高层产品级冻结

---

## 当前边界

TheWorld 当前已经具备：

- 统一 CLI 入口：`pnpm theworld` / `pnpm world`
- 行模式 chat、`--continue` / `--resume`、slash、本地 alias
- `sessions` / `inspect` / `tasks` 三组子命令
- 可选 Ink 全屏 TUI（`056`–`058`）

下一阶段**不**再解决「能不能做 TUI」，而是解决：

1. CLI 的**信息架构**是否够清晰
2. 人类输出与机读输出是否有清晰分轨
3. 行模式与 TUI 的视觉 token 是否仍在分散生长
4. Session 入口与继续对话是否足够产品化

---

## 从参考项目吸收什么

### 1. 吸收：人机双轨

参考项目最值得吸收的不是某个 ASCII logo，而是：

- 人类可读输出与机读输出**不混流**
- 终端壳层把 stdout / stderr / JSON 当作产品 contract，而不是纯实现细节

对 TheWorld 的冻结结论：

- `--json` 路径继续保持**稳定机读**
- 人类可读的 help / banner / error / status / chat 提示，应逐步收口为**单独输出轨**
- TUI 模式继续保持 056 已冻结的 stdout 契约，不回退到混写 raw `stdout`

### 2. 吸收：语义 token，而不是散落 ANSI

参考项目的共同点是：

- 先定义语义角色，再映射到颜色
- 主题系统是壳层治理的一部分

对 TheWorld 的冻结结论：

- 不再继续让 `style.ts` 只是零散 ANSI 常量表
- 下一阶段要引入**小而稳定**的 CLI token 层，统一行模式与 TUI 的颜色/强调/边框语义

### 3. 吸收：品牌区多轨降载

参考项目都强调：

- 富终端可以更强品牌位
- 非 TTY / `NO_COLOR` / 窄终端必须可降载

对 TheWorld 的冻结结论：

- 保留现有 banner / ASCII / statusbar 路线
- 继续坚持「有能力则富渲染，没能力则纯文本」，不追求单一路径硬撑所有终端

### 4. 吸收：模式只有在能力边界真实存在时才可见

参考项目把 `plan` / `build` / `permission` 之类模式做成产品能力边界，而不只是色带文案。

对 TheWorld 的冻结结论：

- 当前**不**在 CLI 层引入假的 `plan/build` 模式开关
- 若未来要显示模式，必须已有真实的工具权限、只读约束或 orchestration surface 与之对应

---

## 明确不吸收什么

本轮明确不做：

- 不照搬 OpenCode / Desktop 的完整主题系统、auto theme、daltonized 主题矩阵
- 不在 CLI 层引入 Bun / feature-gate 式编译期开关体系
- 不新增 NDJSON / bridge / cost-tracker / token 精算等新协议
- 不在 CLI 层私自发明多 Agent、plan mode、heartbeat 聚合等共享 contract
- 不因为参考项目有更强 UI，就反向修改当前 Service / SDK surface

---

## TheWorld CLI 下一阶段冻结设计

### 1. CLI 继续定位为 shell

CLI 是 `shared contracts` 与 `sdk/*` 之上的壳层，不是产品 contract 的定义者。

因此下一阶段优先做：

- 输出 contract
- help / 子命令信息架构
- session 入口与继续对话体验
- 行模式与 TUI 共用的视觉 token
- TUI 内部的信息密度与布局收口

而不是优先做：

- 新 endpoint
- 新 DTO
- 多壳层共享的新运行语义

### 2. 输出 contract 先于视觉细节

下一阶段的首要工程化主题不是“再加一个动效”，而是：

- 什么必须去 stdout
- 什么必须去 stderr
- 什么可以进 `--json`
- 什么不得污染 pipe / CI

这是受参考项目影响后，对 TheWorld 最值得先冻结的点。

### 3. Session 入口必须产品化

当前 TheWorld 已有 `displayName`、本地 alias、`--resume`、`--continue`。

下一阶段要把它们收口成统一的 session identity 体验：

- 用户先看到可读标题，再看到短 id
- 本地 alias 是本地便捷层，不替代服务端 `displayName`
- TTY 下可以有更顺手的 attach / pick 路径

### 4. 视觉系统做“小而稳”的收口

本轮不追求大型 ThemeProvider，而是冻结一条更适合 budget-mode 的路径：

- 先做一层小 token
- 先统一 line UI 与 TUI 的语义颜色
- 先把组件里散落的裸 ANSI / 局部配色收口

### 5. TUI 优化继续停留在既有 contract 内

TUI 后续增强只能消费现有：

- session / messages / stats
- host / agentId / env label
- streamRun 既有事件

不为状态栏和布局再新增 server API。

---

## 下一阶段工单序列

按冻结顺序，当前主路径的 budget-mode 工单为：

1. `059`：CLI 输出轨与 help contract
2. `060`：Session identity 与 TTY attach/pick 体验
3. `067`：CLI shell home 与 information architecture
4. `068`：CLI conversation runtime shell
5. `069`：CLI session 与 thread UX
6. `070`：CLI input 与 command affordances
7. `071`：CLI shell design system 与 degradation
8. `072`：CLI shell validation 与 acceptance harness

budget-mode 的总控交接入口见：

- `docs/exec-plans/active/THEWORLD_CLI_BUDGET_MODE_HANDOFF.md`

依赖关系：

- `059` 先行，先收口输出与信息架构
- `060` 依赖 `059` 的帮助/输出约束，冻结 session identity 与 attach/pick 体验
- `067` 依赖 `059/060`，先补 home shell 与入口信息架构
- `068` 依赖 `067`，重建 active conversation shell
- `069` 依赖 `068`，收口 thread / picker / identity 叙事
- `070` 依赖 `069`，收口输入与命令 affordance
- `071` 依赖 `070`，统一 shell 设计系统与降载
- `072` 依赖 `071`，重建 acceptance harness

旧的 `061`–`066` 已不再作为主路径；它们属于较窄的 TUI-local 增量方案，保留仅供历史参考。

---

## 对弱模型的执行约束

后续 budget-mode 默认必须遵守：

- 不新增 Service / SDK contract
- 不引入新的模式语义（如 fake `plan mode`）
- 不把参考项目的实现结构直接搬进仓库
- 每单只在冻结目录内推进
- 每单完成后必须跑 `pnpm verify`

---

## 相关文档

- `docs/requirements/CLI_REFERENCE_SOURCES_INDEX.md`
- `docs/requirements/CLI_REFERENCE_OPENCODE_AND_DESKTOP_SRC_ANALYSIS.md`
- `docs/requirements/PROJECT_CLI.md`
- `docs/requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md`
- `docs/requirements/THEWORLD_TUI_PRODUCT_DESIGN.md`
- `docs/exec-plans/active/056_cli_chat_fullscreen_tui.md`
- `docs/exec-plans/active/057_cli_chat_tui_visual_identity.md`
- `docs/exec-plans/active/058_cli_chat_tui_lazyvim_dashboard.md`
