# 081 — 主界面色块可见性：对照 OpenCode（Desktop）分步复刻

## 元信息

- **状态**: active  
- **问题陈述**: 主界面上**肉眼难以看到**用背景色区分的「带」（Header / Main / Input / Status），与 `TUI_DESKTOP_DESIGN_SPEC.md` §2.3 及用户预期不符。  
- **参考实现（先模仿）**: 本机 **`~/Desktop/opencode`**（同 [`CLI_REFERENCE_SOURCES_INDEX.md`](../../requirements/CLI_REFERENCE_SOURCES_INDEX.md) 索引），**不**在工单内要求引入 OpenTUI 全栈，而是**学其模式**，在 `packages/cli`（Ink + React）中落地**等价可见效果**。  
- **约束**: 不扩张 server / SDK；变更限于 CLI TUI 与（必要时）`help`/环境说明一句。

## 背景：OpenCode 怎么做的（仓库路径锚点）

以下路径均相对 `~/Desktop/opencode`：

| 能力 | 说明 | 代表文件（grep / 阅读） |
|------|------|------------------------|
| 真·RGBA 主题 | 主题色解析为 `RGBA`，`box` 上 `backgroundColor={...}` 稳定铺色 | `packages/opencode/src/cli/cmd/tui/context/theme.tsx`、各 `theme/*.json` |
| 分层面板色 | 侧栏/子块用 `backgroundPanel`、`backgroundElement` 等与主 `background` 区分 | `packages/opencode/src/cli/cmd/tui/routes/session/sidebar.tsx`（如 `backgroundColor={theme.backgroundPanel}`、transcript 区 style） |
| 主会话布局 | 主列/侧栏/弹层大量 `box` 显式设 `backgroundColor` / 边框色 | `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx`（多处置 `backgroundColor`） |
| Home | 以 flex 分区 + Logo + Prompt 插槽；底部 footer slot | `packages/opencode/src/cli/cmd/tui/routes/home.tsx` |
| 栈差异 | **OpenTUI**（`@opentui/core` + Solid），非 Ink；盒模型对背景绘制与终端协商路径与 **Ink 5 `Box` 传 `style` → `ink-box`** 可能不一致 | — |

**根因（初步结论）**: OpenCode 依赖 OpenTUI 对 `backgroundColor` 的**可靠绘制**；当前 TheWorld 虽在 `TuiBox` 透传 `backgroundColor`，在 **Warp 等环境** 上仍常出现**几乎不可见**的区带。需在复刻中增加 **不依赖 `Box` 背景一条路径** 的**保底铺色**（见下节）。

## 复刻目标（对 TheWorld 的含义）

- **语义对齐 OpenCode 三层（简化）**  
  - 主工作区底：`background`（≈ 文档 `--background`）  
  - 侧栏/卡片/非主画布：`surface` 或加深的 `backgroundPanel`（可用现有 `tui-ink-palette` 中 `surface` / `statusBar` 做映射，必要时新增 token 名，与 OpenCode 仅概念对齐、非二进制兼容）  
  - 强调条/悬停/输入内井：`backgroundElement` 级（可用 `surface` 与 `background` 的固定对比差）
- **可见性（验收核心）**  
  - 在 **有真彩色** 的终端中，**无需猜** 能看出至少：**顶栏**、**主区**、**底输入轨**、**最底状态行** 四段与 OpenCode 主界面「分层感」**同阶**（不要求像素一致）。

## 分步计划（小步、可独立验收）

### Step 1 — 对照表（1 PR，只文档 + 表）

- 在工单附录或 `docs/` 下**极简** 一页「OpenCode 符号 → TheWorld 现状 → 目标」三列表（不抄大段代码；只路径 + 一句行为）。  
- **完成标准**: 评审能按表打开 OpenCode 与 TheWorld 各一眼对照。

### Step 2 — 保底铺色原语 `Text` 行（推荐名：`TuiTextFill` 或 `tui-fill-line.tsx`）

- 实现**单行**组件：`<Text width={w} backgroundColor={bg}>{' '.repeat(w)}</Text>`（或 Ink 支持下的等价，避免用 `Box` 作为唯一铺色源）。  
- 支持 `w = columns` 与 `NO_COLOR` 时降级为 0 高度或不渲染。  
- **完成标准**: 在样例页能单独看到一条**明显**色带；`pnpm --filter @theworld/cli check`。

### Step 3 — 顶/底/输入轨用「线带 + 色块」组合

- **Header 底部**: 在现有 `ChatTuiHeader` 下保留或替换为：至少 **一条** `TuiTextFill`（`surface`）+ 可选 **一条** 更细对比条（`border` token），**不**用 `┌` 类框线做分区主结构。  
- **Input 顶轨**: 在 `ChatTuiInputBar` 中，**输入井**用 `TuiTextFill` 或 `Text`+`background` 铺底 + 前景字（对齐 OpenCode Prompt 区「一整块底」的观感）。  
- **Status**: 全宽 `TuiTextFill` + 其上叠字（OpenCode `Footer` 为前景字为主；我们加强底条以可见）。  
- **完成标准**: 截图/录屏 中四段边界**可读**；`pnpm test:project-cli` 通过。

### Step 4 — 主区（Transcript + Home）铺底

- 主列容器：在 `run-chat-tui` 或子组件中，对 **flexGrow 主区** 增加**可见铺底**策略二选一或组合：  
  - **A**（优先）: 子树最底层放 `TuiTextFill` 堆叠为 **N 行**（N = 可用行数，由 `useStdout().stdout.rows` 与预留行数推导，与现有 `computeTranscriptBlockBudget` 系同一套行预算来源）；  
  - **B**: 仅对 `ChatTuiHomeShell` 与空态转录做满屏铺色，有消息时以消息块色为主（与 §2.3 一致）。  
- **完成标准**: Home 与无消息 Chat 时主区**明显**不同于 Header 的 `surface/background` 对比。

### Step 5 — 与 OpenCode 侧栏对标（仅宽屏）

- 参照 `opencode/.../session/sidebar.tsx` 的 `backgroundColor={theme.backgroundPanel}`：TheWorld `ChatTuiSidebar` 用 **`TuiTextFill` 满 sidebar 宽 × 高** 或**逐节** `surface` 条，使侧栏与主区对比度 ≥ 文档要求。  
- **完成标准**: `≥80` 列时侧栏「一条独立色带」可见。

### Step 6 — 回归与文档

- `pnpm verify`（或项目约定子集）。  
- 在 `080` 的验收中若已满足「无 HTTP 面变更」则 081 仅更新 `help` 若新增可见环境变量。  
- 关账：本文件移至 `../completed/`，`active/README` 指向下一张 **082**。

## 非目标

- 将 TheWorld CLI TUI 整体迁移到 OpenTUI / Solid。  
- 与 OpenCode 主题文件二进制兼容或复制其 JSON 全集。

## 风险

- 行数铺底过厚可能影响性能；需限制在「当前视口行数」内，并与滚动逻辑一致。  
- `TuiTextFill` 多行在极小终端需 clamp。

## 参考链接（仓库内）

- 设计: [`TUI_DESKTOP_DESIGN_SPEC.md`](../../requirements/TUI_DESKTOP_DESIGN_SPEC.md) §2.3  
- OpenCode 分析: [`CLI_REFERENCE_OPENCODE_AND_DESKTOP_SRC_ANALYSIS.md`](../../requirements/CLI_REFERENCE_OPENCODE_AND_DESKTOP_SRC_ANALYSIS.md)  
- 前置工单: [080_tui_desktop_spec_compliance.md](./080_tui_desktop_spec_compliance.md)（主题 token / TuiBox 已落地；081 专注**可见性**与 OpenCode 行为对齐）

---

### 附录 A：复刻时建议优先阅读的 OpenCode 文件（清单）

1. `packages/opencode/src/cli/cmd/tui/routes/session/sidebar.tsx`  
2. `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx`（搜索 `backgroundColor`）  
3. `packages/opencode/src/cli/cmd/tui/component/prompt/index.tsx`（如存在，看输入区）  
4. `packages/opencode/src/cli/cmd/tui/routes/home.tsx`  

（实现阶段按 Step 1 可扩为一页对照表。）
