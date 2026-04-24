# OpenCode 与 Desktop `src`：CLI 与终端 UI 设计分析报告

**性质**：对开发者本机两棵参考代码树的**只读、理念与设计语言级**整理，覆盖**功能架构**与**视觉/终端 UI 风格**；**不是**对第三方项目的完整设计手册，也**不**替代 TheWorld 的 contract 与执行计划。

**分析元数据**

| 项 | 值 |
|----|-----|
| 参考 A（OpenCode） | `~/Desktop/opencode`（Bun monorepo，`packages/opencode` 为 CLI 主包） |
| 参考 B（Desktop `src`） | `~/Desktop/src`（大体积应用源码；`ink/`、`components/design-system/`、`utils/theme.ts` 等） |
| 分析重点 | 功能与入口；**终端视觉语言（色板、字标、语义色、动效/闪烁、降载）**；TUI/主题；可观测 |
| 与 TheWorld 关系 | 理念与视觉参考；TheWorld 路线见 `THEWORLD_*`、HTTP+SSE、Ink 全屏 TUI（056/058） |

---

## 1. OpenCode 侧：功能与信息架构

### 1.1 产品定位与多形态

- **单一品牌**：命令行、文档、安装器统一「OpenCode / opencode」；多形态（脚本安装、brew、scoop、桌面应用）并存，**CLI 仍是核心操作面**。
- **多 Agent 模式（产品级）**：**build** 与 **plan**（只读/更谨慎）**Tab 切换**；`@general` 子能力——**模式 = 能力边界**，不只为换主题。
- 副路径：`serve`、Web、Desktop 等；CLI 是枢纽。

**对 TheWorld**：若将来有「只读/规划」类能力，应**与权限/工具策略**一起写进文档，而非只改状态栏字符串。

### 1.2 CLI 入口

- **yargs**：`hideBin`、`scriptName("opencode")`、**`.wrap(100)`**、help/h 与 version/v、全局 `--print-logs`。
- 子命令按文件拆分（`cli/cmd/run`、`tui/thread`、`tui/attach` 等）。

**对 TheWorld**：扩大子命令时，**统一 help 行宽、全局 flag 命名**可对齐此习惯。

### 1.3 TUI 与可配置性

- `cli/cmd/tui/*`、`util/scroll`、**`config/tui`**：TUI 为正式能力路径，**非 demo**；滚动等行为可配。
- 依赖中出现 **OpenTUI** 等，与 TheWorld 的 **React + Ink** 不同，但共享「**终端组件化 + 配置**」理念。

**对 TheWorld**：滚动/快捷键/只读等可独立 exec-plan，避免主 TUI 文件持续膨胀。

### 1.4 数据与工程底座（略）

- Drizzle、SQLite、Effect、Bun/Node 条件 import；`AGENTS.md` 风格即**仓库文化**。

---

## 2. Desktop `src` 侧：功能与信息架构

### 2.1 自定义 Ink + 主题门闸

- `ink.ts`：**所有** `render` / `createRoot` 经 **`ThemeProvider`** 包裹，再导出 Themed 组件与底层 `Base*`。  
- **理念**：与 Web 一致，**无 Provider 不渲染**（测试场景除外），避免**同一产品两套终端色**。

### 2.2 命令与特性开关

- `commands.ts`：大量子命令目录 + `bun:bundle` 的 `feature('…')` **编译期裁剪**。

### 2.3 传输与机读

- `cli/transports/*`、structuredIO、NDJSON 等 — **人走视觉轨、机走数据轨**。

### 2.4 成本与上下文

- `cost-tracker`、`context`（git、memory、memo）— **可观测与上下文不是事后补丁**。

### 2.5 桥接

- bridge/coordinator 等 — CLI 作为**多终端枢纽**，非孤立 REPL。

---

## 3. 视觉与终端 UI 设计语言（详细）

本节是**设计向**重点：从代码中可归纳的**色板、字标/图形语言、组件语义、动效、降载**与**跨端一致性**。

### 3.1 OpenCode CLI：字标、微型图形语言与 ANSI 角色分工

**文件锚点**：`packages/opencode/src/cli/ui.ts`、`cli/logo.ts`。

#### 3.1.1 双列 Logo 与「控制字符即像素」

- `logo` 常量为 **左/右两列** 字符串行（`glyphs.left` / `glyphs.right`），在 TTY 上**并排绘制**，形成**立体/分色块**观感。
- 像素级绘制**不是**直接贴 Unicode 图，而是定义一套**私有微语法**（`logo.ts` 的 `marks = "_^~,"`）：
  - **`_`**：只铺 **背景色块**（`draw` 中推 `48;5;235` 类 **bg** + 空格），用于留白或色块底。
  - **`^`**：上半块（`▀`）与前景配合，作字「笔画」的亮面。
  - **`~`**：阴影面（`shadow` 色 + `▀`），与亮面形成**深度**。
  - 普通可打印块符（`█` 等）走 **主前景色**。

**设计语言归纳**：在**不引入图像资源**的前提下，用 **4bit/8bit 终端控制序列 + 三档亮度（fg / shadow / bg）** 做「**伪 3D 字标**」；同一套 `draw()` 逻辑适用于左右半边，**左右可不对称配色**（`left` 用灰+深底，`right` 用默认 fg + 略浅底），强化品牌分割。

#### 3.1.2 多轨字标与降载

- 同一模块内还有 **Braille/点字风** 的 `wordmark[]` 行（`⠀`、`█▀▀█` 混排），用于**非 TTY** 时退化为**纯字符多行**（`logo()` 中 `!stdout.isTTY && !stderr.isTTY` 分支只拼接行，不写字节控制）。
- **设计语言**：**TTY 真彩色 / 256 色富渲染** vs **管道/无能力终端的纯文本** 显式**双轨**；不强行在 CI 中保留 ANSI。

#### 3.1.3 色板与语义（CLI 文本，非 TUI 壳）

- **256 色**用于字标区域：`38;5;235`、`38;5;238`（shadow 层次）、`48;5;235`（背景块）。
- **16 色 ANSI** 预置为**语义化样式表** `Style`：  
  `TEXT_HIGHLIGHT` 用 **96（亮青）**；`DIM=90`；`WARNING=93`、`DANGER=91`、`SUCCESS=92`、`INFO=94`；并各有 **BOLD 变体**。  
- **系统消息**（`error()`）统一 **Danger 粗体前缀 + 正文 normal**，避免一屏多段 ANSI 无结构。

**设计语言归纳**：**字标 = 高信息密度、品牌位**用 256/真彩；**长文本 CLI 回显**用有限 **16 色语义集**，降低终端配置差异与 wcwidth 问题。

#### 3.1.4 输出与空白节奏

- **人类向输出**走 **`process.stderr.write`**（`print` / `println`），与「管道/脚本占 stdout」习惯一致。
- `empty()`：用**「已输出空行则不再重复」**的 flag，避免**连续命令之间双倍空行**——属**版式节奏**层的小设计，而非纯功能。

---

### 3.2 OpenCode 其他界面（Web/控制台，简要）

- `packages/console/app` 等使用 **CSS 变量**：`--color-bg`、`--color-text`、`--color-primary` 及 **primary / danger / warning** 的 **hover / active** 变体。  
- **设计语言**：**语义 token**（主色/危险/警告）+ **状态阶梯**，与 CLI 的 `Style` 表**同一产品心智**，只是媒介从转义序列表为 CSS。

---

### 3.3 Desktop `src`：终端内的「完整主题系统」

**文件锚点**：`utils/theme.ts`（`Theme` 类型与多主题实色表）、`components/design-system/ThemeProvider.tsx`、`ThemedBox.tsx`、`components/design-system/color.ts`。

#### 3.3.1 从「颜色」到「角色 Token」

- `Theme` 不是「palette 8 个色」，而是 **40+ 个角色键**，覆盖：
  - **产品身份与模式**：`claude`、`planMode`、`ide`、`permission`、`autoAccept`、`fastMode` 等。
  - **界面结构**：`text`、`inverseText`、`subtle`、`inactive`、`background`、`promptBorder`、TUI 相关 `clawd_body`、`userMessageBackground`、`messageActionsBackground` 等。
  - **语义与状态**：`success`、`error`、`warning`、`merged` 及成对的 **`warningShimmer`** 等（见下节）。
  - **Diff 专用**：`diffAdded` / `diffRemoved` 与 **dimmed / word 级** 变体，**词级**与**行级**色分离。
  - **多代理标识**：`red_FOR_SUBAGENTS_ONLY` 等 **7+1** 子代理色系（彩虹辅助）。
  - **彩虹关键词**（`rainbow_red`… + 各自 `*_shimmer`）用于「ultrathink」等强提示。
  - **可访问/速率**：`rate_limit_fill/empty`；**选区** `selectionBg` 等。

**设计语言归纳**：终端里仍坚持 **设计 token**，而不是散落的 `chalk.xxx`；**模式（plan/IDE/permission）有独立色相**，和 OpenCode 的 build/plan **产品分轨**是同一类思维。

#### 3.3.2 Shimmer：动效在色板中的「第二档」

- 大量 key 有 **`xxxShimmer`** 伴侣色（更亮或更饱和的同一色相），供 **spinner、hover、轻提示** 使用，**不依赖**终端闪烁控制码。  
- **设计语言**：**动效 = 在两条固定色间切换**（或短周期交替），在 **NO_COLOR** 或 dumb TERM 下可降级为**无闪或字符旋转**，可预测、可测。

#### 3.3.3 显式 `rgb()` 与主题变体

**浅色主题**在注释中写清：用**显式 `rgb(…)`** 减轻「用户把终端 16 色改得面目全非」导致的产品色漂移。  
- 提供 **dark / light / *-daltonized / *-ansi** 多档，**色盲/色弱与纯 ANSI 退化** 与 **审美主题** 分开维度。

**设计语言归纳**：**可重复的品牌色 > 随终端而变的默认 ANSI**；**无障碍**单独成题（daltonized），不是只换一套对比度。

#### 3.3.4 主题解析与 Themed 组件

- `ThemedBox` 的 `borderColor` / `backgroundColor` 等接受 **`Theme` 的 key 或 原始色串**（`rgb(`、`#`、`ansi256(`、`ansi:`）。先解析再下传到 Ink 的 `Box`。  
- `color.ts` 的 `color(…, theme, type)`：**curry** 到具体 `text`，与「主题 + 前/背景类型」正交。  
- **设计语言**：**组件 API 与 Figma/Design Token 的「先语义、后色值」一致**，换主题不改调用点。

#### 3.3.5 选区、背景与「不滥用反色」

- 注释中明确：**选区**用**实色底**去模拟「原生选区」、避免 **SGR-7 反色** 在**语法高亮**多色前景上**碎块化**。  
- **设计语言**：在终端里，**高亮策略**是 **UX 级决策**（与 IDE 选区行为对齐），不交给默认终端行为。

#### 3.3.6 Auto 与系统外观

- `ThemeProvider` 支持 **`auto`**，结合 **`$COLORFGBG`**、**OSC 11** 与 `watchSystemTheme`（在 `feature('AUTO_THEME')` 下）跟随系统明/暗。  
- **设计语言**：**终端 UI 与 OS 明视觉一致**，不是孤立的「终端皮肤」；TheWorld 若扩展主题，**auto** 是完整体验的一环。

---

### 3.4 两源在「设计语言」上的对照

| 维度 | OpenCode CLI | Desktop `src` 终端 | 共同点 |
|------|----------------|----------------------|--------|
| 字标 | 微语法 + 分屏双色 + 256 色；Braille/块字多轨 | （主在对话 UI，大入口另议） | **无图资源、字符即设计** |
| 色与语义 | 16 色表 + 256 字标 | 大 `Theme` token + rgb + 多主题 | **先语义、后十六进制** |
| 动效 | 偏少；Braille/块字可自带节奏 | Shimmer 成对、彩虹、rate 条 | **可预测的「第二档色」** |
| 降载 | TTY/非 TTY 双轨；无彩即无序列 | `light-ansi`、daltonized、NO_COLOR 路径 | **不假装有能力** |
| 输出面 | stderr 人读、结构留给管道 | 同屏多轨（+ transports） | **人机分离** |

---

## 4. 功能维度的两源总表

| 维度 | OpenCode | Desktop `src` | TheWorld 当前（简写） |
|------|----------|-----------------|------------------------|
| 运行与构建 | Bun monorepo | Bun + feature 条件编译 | pnpm、Node 22、包 `@theworld/cli` |
| CLI 解析 | yargs | 大型 commands 注册 + feature | 自研 args + 少量 flag |
| 终端 UI | 自有 UI + TUI 子命令 | Ink + 完整 Theme + Themed* | React Ink、056/057/058 |
| 可观测 | 与本地 DB/统计结合 | 成本、token、行变更、git 上下文 | 行模式 status、TUI 状态栏 |
| 模式 | build / plan 产品级 | `planMode` 等色与能力（与 UI 强绑定） | 与 server/contract 协同演进 |

---

## 5. 可沉淀到 TheWorld 的「设计原则」清单（非实现承诺）

1. **模式与能力挂钩**：只读/规划不只做 UI 标签，要能与**工具/写权限**说法一致。  
2. **人机双轨**：人读 = stderr 或 TUI 壳；机读 = `--json` / 管道，**不混流**（056 已部分体现）。  
3. **字标/品牌区**可用 **多轨降载**（全彩 / 纯字），与 OpenCode 一致。  
4. **语义色表**维持小集合（`Style` 或 token），**TUI 扩展色**可逐步收到单一 `theme` 或 `tui-tokens` 文件，向 Desktop 的「键→色」收敛。  
5. **动效**优先用 **色阶/shimmer/字符**（Braille/块光栅），少依赖全屏重绘。  
6. **选区/输入区**若增强，**提前**决定是「反色」还是「实底」，避免与多色正文打架（Desktop 的 selection 哲学）。  
7. **可配置、可验**：TUI/主题相关增量仍走 **exec-plan + `pnpm verify`**。

---

## 6. 与 TheWorld 当前实现的衔接（仅对照）

- **LazyVim 风、横幅、Powerline 状态栏**（057/058）≈ 在**字标**与**条带分区**上靠近参考项目的「品牌位 + 信息密度」，TheWorld 用 **cyan/蓝/magenta 分段** 与 **NO_COLOR 降级** 是合理子集。  
- 若继续加深「设计语言」，可考虑：**单一 `tui/theme.ts` 或 tokens** 收敛 Ink 的 `color` / `backgroundColor` 与 `style.ts` 的 `S.*`，**不**在组件内写裸转义。  
- **THEWORLD_CHAT_TUI_MODEL** 为展示标签；与 OpenCode/Desktop 的「多档模式显式可见」一致时，**未来**可扩展为与 server 配置对齐的只读展示（需 contract）。

---

## 7. 参考阅读

- OpenCode 仓库：[`anomalyco/opencode`](https://github.com/anomalyco/opencode)（以远程最新为准。）  
- TheWorld：`../exec-plans/active/056_cli_chat_fullscreen_tui.md`、`../exec-plans/active/058_cli_chat_tui_lazyvim_dashboard.md`、`./PROJECT_CLI.md`。

---

**文档位置**：本文件 + [`CLI_REFERENCE_SOURCES_INDEX.md`](./CLI_REFERENCE_SOURCES_INDEX.md)（摘要目录）。
