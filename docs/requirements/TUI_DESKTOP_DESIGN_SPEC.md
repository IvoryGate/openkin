# OpenKin (TheWorld) TUI 详细设计方案

> **仓库副本说明（2026-04-24）**  
> 权威人类稿来源：本机 **Desktop `docs/TUI_DESIGN.md`**（与仓库路径 `docs/requirements/TUI_DESKTOP_DESIGN_SPEC.md` 同步维护）。  
> 实施时须同时遵守仓库已冻结的 contract 与 [`THEWORLD_CLI_SHELL_PARITY_DESIGN.md`](./THEWORLD_CLI_SHELL_PARITY_DESIGN.md) / [`THEWORLD_TUI_PRODUCT_DESIGN.md`](./THEWORLD_TUI_PRODUCT_DESIGN.md)；不得因本文档扩张 server/SDK 面。

## 文档概述

本文档基于对 OpenCode TUI 和 Claude Code (src) CLI 的深入分析，为 OpenKin (TheWorld) 提供完整的 TUI 设计方案。

**分析范围**:
- OpenCode: `packages/opencode/src/cli/cmd/tui/` (完整 TUI 系统)
- Claude Code: `src/cli/print.ts` + `src/constants/outputStyles.ts`
- OpenKin 当前: `packages/cli/src/tui/` (Ink React 基础实现)

---

## 第一部分：核心设计理念

### 1.1 设计哲学

**OpenCode 的核心理念**:
- **分层架构**: TUI 作为独立 Layer 注入，使用 Effect 运行时管理依赖注入
- **事件驱动**: 所有 TUI 状态变化通过 BusEvent 定义，组件间解耦
- **配置即代码**: `.opencode` 配置文件驱动 TUI 行为
- **主题优先**: 40+ 主题支持，用户视觉定制是核心体验

**Claude Code 的核心理念**:
- **输出风格**: 通过 `outputStyle` 配置 AI 的输出行为模式 (Explanatory/Learning)
- **状态注入**: System Prompt 中动态注入输出风格指令
- **模式切换**: 用户可切换 AI 响应模式

**OpenKin 应采取的理念**:
- **色块优先于字符**: 使用背景色块区分区域，而非 ASCII 边框
- **语义着色**: 代码块、状态、错误使用语义颜色，而非单一强调色
- **主题驱动**: 与 OpenCode 对齐，支持完整主题系统
- **模式可选**: 保留输出风格配置，但非核心

---

## 第二部分：页面与布局设计

### 2.1 整体布局结构

```
┌────────────────────────────────────────────────────────────┐
│  Header (48px 固定)                                    │
│  ┌──────────────────────────────────────────────┐   │
│  │ Logo · 会话标题         模型选择器  ·菜单      │   │
│  └──────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────┤
│                                                    │
│  Main Content (自适应)                              │
│  ──────────────────────────────────────────────      │
│  ┌──────────────────────────────────────────┐      │
│  │                                  │ Side  │      │  ← 响应式: ≥80 列显示
│  │       Transcript                 │ bar   │      │
│  │       (消息流)                 │(可选) │      │
│  │                                  │      │      │
│  └──────────────────────────────────────────┘      │
│                                                    │
├────────────────────────────────────────────────────┤
│  Input Area (最小 96px，最大 200px)                  │
│  ┌──────────────────────────────────────────────┐   │
│  │ > 输入框...                        [Send]    │   │
│  └──────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────┤
│  Status Bar (24px 固定)                              │
│  连接状态 · Token 计数 · 步骤数 · 运行时间      │
└────────────────────────────────────────────────────┘
```

### 2.2.1 开屏动画 (游戏风格)

**设计: 使用 ASCII Art Logo，逐字符/逐行出现 + 呼吸效果，下方用 > < 包裹提示**

**Logo ASCII Art**:
```
████████╗██╗  ██╗███████╗██╗    ██╗ ██████╗ ██████╗ ██╗     ██████╗ 
╚══██╔══╝██║  ██║██╔════╝██║    ██║██╔═══██╗██╔══██╗██║     ██╔══██╗
   ██║   ███████║█████╗  ██║ █╗ ██║██║   ██║██████╔╝██║     ██║  ██║
   ██║   ██╔══██║██╔══╝  ██║███╗██║██║   ██║██╔══██╗██║     ██║  ██║
   ██║   ██║  ██║███████╗╚███╔███╔╝╚██████╔╝██║  ██║███████╗██████╔╝
   ╚═╝   ╚═╝  ╚═╝╚══════╝ ╚══╝╚══╝  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═════╝ 
```

**动画逻辑**:

```
Phase 1: Logo 逐行出现 (从上到下，每行间隔 100ms)
  行1 ████████╗
        ↓
  行1-2 ████████╗
        ↓  ██╔══╝
        ↓
  行1-3 ████████╗     → ... → 全部 6 行出现
        ↓  ██╔══╝
        ↓  ██║
        ↓
  
Phase 2: 呼吸效果 (Logo 完成后整个闪烁 1 次)
  完整 Logo (亮) → 完整 Logo (暗) → 完整 Logo (亮)

Phase 3: 提示语呼吸闪烁 (无限循环)
  > Press any key to enter <  ←→  暗/亮 (每 500ms 切换)

退出动画:
  全部 6 行逐行消失 → 进入 Home
```

**最终效果**:
```
┌───────────────────────────────────────────────────────┐
│                                                       │
│  ████████╗██╗  ██╗███████╗██╗    ██╗ ██████╗   │
│  ╚══██╔══╝██║  ██║██╔════╝██║    ██║██╔═══██╗  │ ← 逐行出现
│     ██║   ███████║█████╗  ██║ █╗ ██║██║   ██║   │
│     ██║   ██╔══██║██╔══╝  ██║███╗██║██║   ██║   │
│     ██║   ██║  ██║███████╗╚███╔███╔╝╚██████╔╝   │
│     ╚═╝   ╚═╝  ╚═╝╚══════╝ ╚══╝╚══╝  ╚═════╝   │
│                                                       │
│              >  Press any key to enter  <               ← > < 包裹，文字呼吸闪烁
│                                                       │
└───────────────────────────────────────────────────────┘
         ↓ 任意键 或 3秒自动
         进入 Home 页面
```
动画帧示例 (Logo 逐字符出现 + 呼吸效果):

帧 1:                    帧 2:                  帧 3:
T                       TH                     TH
                        TE                     THE
                                              THEW
                                                  
THEWORLD               THEWORLD               THEWORLD

> Press any key >      > Press any key >      > Press any key <
(to enter)             (to enter)           (to enter)

帧 4:                  帧 5 (循环):
T                     [Logo 闪烁]
THEWORLD
>  Press any key to enter  <
                          
动画效果:
1. Logo 逐字符从左到右出现 (每帧一个字符)
2. 完成后 "THEWORLD" 闪烁 2 次
3. "> Press any key to enter <" 呼吸闪烁 (每 500ms 切换)
4. 任意键 → 播放消失动画 → 进入 Home
5. 3 秒无操作 → 自动进入 Home
```

**最终效果**:
```
┌───────────────────────────────────────────────────────┐
│                                                       │
│                                                       │
│              T  H  E  W  O  R  L  D                  ← Logo 逐字符出现
│              (间隔 80ms 一字符)
│                                                       │
│              >  Press any key to enter  <               ← > < 包裹，无边框
│                      ↑                              
│                    呼吸闪烁
│                                                       │
└───────────────────────────────────────────────────────┘
         ↓ 任意键 / 3秒自动
         进入 Home
```

### 2.2.2 页面定义

| 页面 | 路由条件 | 说明 |
|------|----------|------|
| **Splash** | 启动时 | 开屏动画 (游戏风格) |
| **Home** | 动画后默认 | 欢迎页 + 最近会话列表 |
| **Chat** | 会话进行中 | 消息流 + 输入框 |
| **SessionList** | `Ctrl+L` | 会话列表管理 |
| **Settings** | `Ctrl+,` | 设置面板 |
| **TaskDetail** | 任务查看 | 任务详情面板 |

### 2.2.3 响应式侧边栏

```
响应式规则:
- 终端宽度 ≥ 80 列: 显示侧边栏 (20 列)
- 终端宽度 < 80 列: 隐藏侧边栏，全屏显示 Transcript
- 可通过配置强制显示/隐藏
```

**侧边栏内容**:
- 最近会话列表 (5 个)
- 快速新建会话按钮
- 设置入口

### 2.3 区域设计 (色块优先)

**设计方案: 用色块区分，而非字符边框**

```
Header:
  背景: --color-surface (主题色)
  底部边框: 1px --color-border

Transcript 区域:
  背景: --color-background
  用户消息: 左对齐，背景 --color-user-message (10% primary + 90% background)
  助手消息: 左对齐，背景 --color-assistant-message (10% accent + 90% background)
  工具调用: 背景 --color-tool-call (5% warning + 95% background)
  工具结果: 背景 --color-tool-result
  错误: 背景 --color-error (10% error + 90% background)，左边框 3px --color-error

Input 区域:
  背景: --color-surface
  输入框: --color-input (边框 1px border)
  焦点: 边框 --color-focus

Status Bar:
  背景: --color-surface (比主背景深 5%)
  文字: --color-text-muted
```

---

## 第三部分：视觉设计系统

### 3.1 主题架构

**OpenCode 主题模型**:
```typescript
// packages/ui/src/theme/types.ts
interface DesktopTheme {
  id: string
  name: string
  light: ThemeVariant  // 明暗分离
  dark: ThemeVariant
}

interface ThemeVariant {
  // 种子色
  seeds: {
    neutral: HexColor   // 背景基础
    primary: HexColor  // 主色
    success: HexColor   // 成功
    warning: HexColor   // 警告
    error: HexColor     // 错误
    info: HexColor      // 信息
  }
  // 或直接 palette
  palette: ThemePaletteColors
}
```

**OpenKin 主题设计**:
```typescript
// 简化版主题
interface TheWorldTheme {
  id: string
  name: string
  background: string   // #0a0a0a (dark) / #ffffff (light)
  surface: string   // 面板背景
  text: string      // 主文字
  textMuted: string
  
  // 语义色 (语义化命名)
  userMessage: string    // 用户消息背景
  assistantMessage: string  // 助手消息背景
  toolCall: string      // 工具调用背景
  toolResult: string   // 工具结果背景
  success: string    // 成功状态
  warning: string    // 警告状态
  error: string      // 错误状态
  info: string
  
  // 语法高亮
  syntax: {
    keyword: string
    string: string
    comment: string
    number: string
    function: string
    type: string
  }
}
```

### 3.2 预置主题

**Phase 1: 基础主题 (5 个)**
| 主题 ID | 名称 | 风格 |
|--------|------|------|
| `dark` | Dark | 默认深色 |
| `light` | Light | 默认浅色 |
| `catppuccin` | Catppuccin | 温暖粉紫 |
| `tokyonight` | Tokyo Night | 霓虹深蓝 |
| `one-dark` | One Dark | Atom 风格 |

**Phase 2: 扩展主题 (20 个)**
- 包含 OpenCode 的 40+ 主题中的主流

### 3.3 语义 Token 系统

| Token | 用途 | 示例 |
|-------|------|------|
| `--background` | 主背景 | 聊天区域 |
| `--surface` | 面板/Header/StatusBar | 卡片 |
| `--text` | 正文 | 消息内容 |
| `--text-muted` | 次要文字 | 时间戳 |
| `--text-dim` | 弱化文字 | 折叠内容 |
| `--user-message` | 用户消息背景 | 用户区块 |
| `--assistant-message` | 助手消息背景 | 助手区块 |
| `--tool-call` | 工具调用 | 工具名/参数 |
| `--tool-result` | 工具结果 | 工具输出 |
| `--syntax-*` | 代码语法 | 代码块 |
| `--success` | 成功状态 | ✅ 成功 |
| `--warning` | 警告 | ⚠️ 注意 |
| `--error` | 错误 | ❌ 失败 |
| `--border` | 边框 | 分隔线 |
| `--focus` | 焦点 | 输入框 |

---

## 第四部分：交互设计

### 4.1 快捷键系统 + Vim 模式

**OpenCode 快捷键设计**:
```typescript
// packages/opencode/src/cli/cmd/tui/context/plugin-keybinds.ts
// 插件化快捷键系统，支持用户自定义覆盖
const ConfigKeybinds = {
  // 核心快捷键
  submit: "Enter",           // 发送消息
  newline: "Shift+Enter",    // 换行
  cancel: "Ctrl+C",          // 取消
  interrupt: "Ctrl+C",       // 中断运行

  // 导航
  sessionList: "Ctrl+L",     // 会话列表
  settings: "Ctrl+,",        // 设置
  help: "F1",             // 帮助

  // 编辑
  accept: "Tab",           // 接受建议
  next: "Tab",             // 下一个
  prev: "Shift+Tab",       // 上一个

  // 滚动
  pageUp: "PageUp",
  pageDown: "PageDown",
  home: "Home",
  end: "End",
}
```

**OpenKin 快捷键设计 (Vim 风格)**:
```typescript
const keybinds = {
  // ===== Normal Mode =====

  // 发送与中断
  submit: "Enter",           // Normal: 发送消息
  interrupt: "Ctrl+C",       // 中断响应

  // 导航
  list: "Ctrl+L",           // 会话列表
  settings: "Ctrl+O",       // 设置
  help: "Ctrl+H",           // 帮助立即
  command: ":",            // 命令行模式

  // 移动 (Vim 风格)
  up: "k",
  down: "j",
  left: "h",
  right: "l",
  pageUp: "Ctrl+B",
  pageDown: "Ctrl+F",
  top: "g",
  bottom: "G",

  // 编辑
  accept: "Tab",
  reject: "Escape",

  // ===== Insert Mode =====

  // 插入模式下
  newline: "Ctrl+Enter",    // 换行
  leave: "Escape",         // 返回 Normal 模式

  // ===== Visual Mode ===== (可选)

  // ===== Command Mode =====

  // 命令行模式命令
  commandList: "ls",        // 列出会话
  commandNew: "new",       // 新建会话
  commandHelp: "help",    // 帮助
  commandQuit: "q",       // 退出
  commandSettings: "set",  // 设置
}
```

### 4.2 Vim 模式设计

**模式定义**:
```
┌─────────────────────────────────────────────────┐
│  Mode Indicator: [NORMAL] / [INSERT] / [VISUAL]   │  ← 状态栏显示当前模式
└─────────────────────────────────────────────────┘
```

| 模式 | 进入条件 | 行为 |
|------|--------|------|
| **NORMAL** | 默认 | 查看消息，按键为快捷键 |
| **INSERT** | `i` / `a` | 输入消息，`Enter` 发送 |
| **VISUAL** | `v` | 选择文本 |
| **COMMAND** | `:` | 命令行输入 |

**模式切换**:
```
Normal → i → Insert
Normal → v → Visual
Normal → : → Command
Insert → Escape → Normal
Visual → Escape → Normal
Command → Enter/Escape → Normal
```

**Normal 模式快捷键表**:
| 按键 | 功能 |
|------|------|
| `i` | 进入 Insert 模式 |
| `a` | 进入 Insert 模式 (光标后) |
| `v` | 进入 Visual 模式 |
| `:` | 进入 Command 模式 |
| `h/j/k/l` | 左/下/上/右移动 |
| `w/b` | 词前进/后退 |
| `0/$` | 行首/行尾 |
| `gg/G` | 文件首/尾 |
| `Ctrl+D` / `Ctrl+U` | 半页下/上 |
| `Ctrl+C` | 中断响应 |
| `Ctrl+L` | 刷新/列表 |
| `Ctrl+N` | 新建会话 |

**OpenKin 快捷键设计**:
```typescript
const keybinds = {
  // 发送与中断
  submit: "Enter",
  newline: "Ctrl+Enter",    // 明确换行
  interrupt: "Ctrl+C",     // 中断响应
  
  // 导航
  list: "Ctrl+L",         // 会话列表
  settings: "Ctrl+O",     // 打开 (Open)
  help: "Ctrl+H",         // 帮助
  
  // 编辑
  accept: "Tab",
  reject: "Escape",
  
  // 滚动 (继承vim风格)
  up: "k",
  down: "j",
  pageUp: "Ctrl+B",
  pageDown: "Ctrl+F",
  top: "g",
  bottom: "G",
  
  // 模式切换
  command: ":",         // 命令行模式
  visual: "v",          // 可视模式
  insert: "i",          // 插入模式
}
```

### 4.2 状态管理

**OpenCode: Effect + Context**
```typescript
// 使用 SolidJS signals + Effect context
const useProject = () => createSignal(...)
const useSync = () => createSignal(...)
```

**OpenKin: 状态设计**
```typescript
// 设计: 使用有限状态机
type TuiState = 
  | { mode: 'idle' }
  | { mode: 'listening'; session: Session }
  | { mode: 'streaming'; stream: StreamState }
  | { mode: 'error'; error: TuiError }

// 状态转换
idle → listening: 用户输入
listening → streaming: 提交消息
streaming → listening: 接收完成
streaming → error: 发生错误
any → idle: 中断
```

### 4.3 输入组件

**OpenCode 输入设计**:
- Textarea 支持多行
- 历史命令上翻 (`ArrowUp`)
- 自动补全 (`Tab`)
- 快捷键绑定 (`Ctrl+J` 提交, etc.)

**OpenKin 输入设计**:
```
输入框规格:
- 最小行数: 1
- 最大行数: 5 (自动滚动)
- 超过 5 行显示滚动条
- 行高: 24px
- 字体: 14px monospace
- 自动聚焦

状态:
- 空: placeholder "Type your message..."
- 草稿: 暗色光标动画
- 发送中: 禁用，输入框变灰
- 错误: 红色边框 + 提示
```

---

## 第五部分：功能设计

### 5.1 会话管理

| 功能 | 描述 | 快捷键 |
|------|------|--------|
| **新建会话** | 清除当前输入新建 | `Ctrl+N` 或 `:new` |
| **继续会话** | 继续最近会话 | `Ctrl+Enter` |
| **会话列表** | 显示最近会话 | `Ctrl+L` |
| **会话选择** | 在列表中选择会话 | `j/k` 移动, `Enter` 进入 |
| **会话删除** | 删除指定会话 | `d` 在列表页 |
| **Fork 会话** | Fork 当前会话 | `:fork` |
| **分享会话** | 分享会话 | `:share` |

**会话列表页面**:
```
┌──────────────────────────────────────────────┐
│ Sessions                          [Search: _] │  ← 搜索框
├──────────────────────────────────────┬─────┤
│ > Session 1 (今天 14:30)          12 msg  │     │
│   Session 2 (今天 10:15)          28 msg  │     │
│   Session 3 (昨天)                156 msg  │     │  ← j/k 移动
│   Session 4 (周一)                 89 msg  │     │
│   Session 5 (更早)                 234 msg  │     │
├──────────────────────────────────────┴─────┤
│ [d] 删除  [Enter] 进入  [q] 退出            │  ← 提示栏
└──────────────────────────────────────────────┘
```

### 5.1.1 会话搜索

- 触发: `/` 在会话列表页
- 实时过滤: 输入关键词实时搜索会话标题/内容
- 清除: `Escape` 清除搜索

### 5.2 消息渲染

| 消息类型 | 渲染方式 | 视觉 |
|----------|----------|------|
| **User** | 文本 | 蓝色前缀 `> ` + 蓝色背景块 |
| **Assistant** | Markdown 渲染 | 默认文字 + 色块 |
| **Thinking** | 可折叠 | 紫色/灰色前缀 |
| **Tool Call** | 代码样式 | 工具名 + 参数 JSON |
| **Tool Result** | 代码样式 | 输出内容 + 语言检测 |
| **Error** | 错误样式 | 红色左边框 + 错误信息 |
| **System** | 提示样式 | 灰色前缀 |

### 5.3 工具展示

**工具调用展示**:
```
┌──────────────────────────────────────────┐
│ TOOL CALL  ──────────────────────────────── │
│ read                                   │
│ ─────────────────────────────────────── │
│ {                                     │
│   "path": "/path/to/file",             │
│   "limit": 100                        │
│ }                                     │
└──────────────────────────────────────────┘
```

**工具结果展示**:
```
┌──────────────────────────────────────────┐
│ TOOL OK    read                         │
│ ─────────────────────────────────────── │
│ [文件内容...]                          │
│                                       │
└──────────────────────────────────────────┘
```

### 5.4 流式输出

| 状态 | 视觉 |
|------|------|
| **思考中** | 思考动画 (|·/-·) |
| **输出中** | 光标动画 (▌) |
| **完成** | 光标消失 |
| **错误** | 错误块 + 重试提示 |

### 5.5 代码高亮

**语言支持**:
```typescript
const supportedLanguages = [
  'javascript', 'typescript', 'python', 
  'rust', 'go', 'java', 'c', 'cpp',
  'html', 'css', 'json', 'yaml', 'markdown',
  'sql', 'bash', 'shell'
]
```

**高亮规则**:
- 识别语言: 从文件名或代码 shebang 推断
- 降级: 无法识别时显示为纯文本
- 主题: 使用 `--syntax-*` tokens

---

## 第六部分：配置系统

### 6.1 配置文件

**OpenCode 配置结构**:
```yaml
# .opencode/tui.yaml
tui:
  theme: "catppuccin"
  scroll_speed: 0.01
  mouse: true
  keybinds:
    submit: "Enter"
```

**OpenKin 配置设计**:
```yaml
# .theworld/tui.yaml
tui:
  theme: "dark"              # 主题
  light_theme: "light"     # 浅色主题 (可选)
  mode: "auto"             # auto/dark/light
  
  # 输入
  input:
    multiline: true        # 多行输入
    submit_key: "Enter"    # 提交键
    newline_key: "Ctrl+Enter"
  
  # 显示
  display:
    show_thinking: true     # 显示思考过程
    show_timestamps: true   # 显示时间戳
    show_model: true      # 显示模型名
    syntax_highlight: true  # 语法高亮
  
  # 快捷键 (可覆盖)
  keybinds:
    # ...
```

### 6.2 配置优先级

```
命令行 --theme=dark
  > 用户配置 .theworld/tui.yaml
    > 默认配置
```

---

## 第七部分：组件设计

### 7.1 核心组件列表

| 组件 | 用途 | 状态 |
|------|------|------|
| **Header** | 标题 + 模型选择 | 固定 |
| **Transcript** | 消息流 | 核心 |
| **MessageBubble** | 单条消息 | 核心 |
| **CodeBlock** | 代码高亮 | 核心 |
| **InputBar** | 输入框 | 核心 |
| **StatusBar** | 底部状态 | 固定 |
| **Sidebar** | 侧边栏 | 可选 |
| **Toast** | 临时通知 | 浮层 |
| **Modal** | 确认对话框 | 浮层 |
| **Spinner** | 加载动画 | 状态 |

### 7.2 组件接口定义

**MessageBubble**:
```typescript
interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'tool_call' | 'tool_result' | 'error' | 'system'
  content: string
  timestamp?: Date
  metadata?: {
    model?: string
    tokens?: number
    tool_name?: string
    tool_state?: 'running' | 'completed' | 'error'
  }
  collapsed?: boolean
}
```

**CodeBlock**:
```typescript
interface CodeBlockProps {
  code: string
  language?: string
  filename?: string
  highlight?: number[]  // 行号高亮
  copyable?: boolean
  collapsible?: boolean
}
```

---

## 第八部分：页面流程设计

### 8.1 启动流程

```
启动
  ↓
检查终端能力 (颜色数/尺寸)
  ↓
加载配置 (.theworld/tui.yaml)
  ↓
加载主题
  ↓
[有最近会话?] → Yes → 询问继续
  ↓ No
显示 Home 页面
  ↓
等待用户输入
```

### 8.2 会话流程

```
Home → 用户输入 → Chat 页面
  ↓
提交消息 (Enter)
  ↓
流式响应开始
  ↓
[工具调用]
  ├─ 选择工具 → TOOL CALL 渲染
  ├─ 执行工具 → TOOL RESULT 渲染
  └─ 继续响应
  ↓
响应完成
  ↓
等待下一轮输入
```

### 8.3 导航流程

```
任意页面
  ├─ Ctrl+L → SessionList
  ├─ Ctrl+O → Settings  
  ├─ Ctrl+H → Help
  └─ Escape → 返回上级
         ↓
  [SessionList/Settings] → Escape → Chat
```

---

## 第九部分：降级与兼容性

### 9.1 终端能力检测

```typescript
const capabilities = {
  colors: 256 | 16777216,  // 16色/真彩色
  unicode: boolean,          // Unicode 支持
  mouse: boolean,          // 鼠标事件
  title: boolean,           // 标题栏
}
```

### 9.2 降级策略

| 能力 | 完整模式 | 降级模式 |
|------|----------|----------|
| **颜色** | 真彩 (16M) | 256 色 / 16 色 |
| **边框** | 色块 + 边框 | ASCII `+-|` |
| **语法高亮** | 完整 | 关键词着色 |
| **动画** | 流畅 | 静态提示 |
| **鼠标** | 支持 | 禁用 |

---

## 第十部分：实施路线图

### Phase 1: 基础体验 (2 周)

- [ ] 色块布局替代字符边框
- [ ] 基础语义 Token (5 个)
- [ ] 主题切换 (dark/light)
- [ ] 代码块基础高亮
- [ ] StatusBar 完善

### Phase 2: 功能完善 (2 周)

- [ ] 会话列表页面
- [ ] 设置页面
- [ ] 快捷键系统
- [ ] 错误处理
- [ ] 工具调用展示

### Phase 3: 视觉升级 (2 周)

- [ ] 主题系统 (5 + 预置)
- [ ] 语法高亮增强
- [ ] 代码块复制
- [ ] 代码块折叠
- [ ] Toast 通知

### Phase 4: 高级功能 (2 周)

- [ ] 插件系统
- [ ] MCP 可视化
- [ ] 性能优化
- [ ] 动画流畅化

---

## 附录

### A. 术语对照

| OpenCode | OpenKin | 说明 |
|----------|--------|------|
| `thread` | `session` | 会话 |
| `transcript` | `chat history` | 聊天记录 |
| `theme` | `theme` | 主题 |
| `keybinds` | `keybinds` | 快捷键 |
| `layer` | `context` | 上下文层 |

### B. 文件结构

```
packages/cli/src/tui/
├── art/                  # 艺术资源
│   ├── logo.ts
│   └── spinner.ts
├── components/           # 组件
│   ├── Header.tsx
│   ├── Transcript.tsx
│   ├── InputBar.tsx
│   ├── StatusBar.tsx
│   ├── CodeBlock.tsx
│   └── MessageBubble.tsx
├── pages/                 # 页面
│   ├── Home.tsx
│   ├── Chat.tsx
│   ├── SessionList.tsx
│   └── Settings.tsx
├── theme/                # 主题系统
│   ├── tokens.ts
│   ├── index.ts
│   └── themes/
│       ├── dark.json
│       ├── light.json
│       └── catppuccin.json
├── config/               # 配置
│   ├── schema.ts
│   └── load.ts
├── keybinds.ts          # 快捷键
├── state.ts             # 状态管理
├── events.ts           # 事件定义
└── index.ts            # 入口
```

### C. 待确认项

- [ ] 开屏动画逐字符间隔? (80ms)
- [ ] 开屏动画完成后到提示闪烁的等待? (500ms)
- [ ] 侧边栏最小宽度? (20 列 = 80px 约等)