# 074 TUI：开屏 Splash — Phase 1（逐行/逐区显现）

> **类型**：**仅 TUI 展示层**（Ink 组件/状态机），不新增 HTTP/SDK。  
> **设计依据**：[`TUI_DESKTOP_DESIGN_SPEC.md`](../../requirements/TUI_DESKTOP_DESIGN_SPEC.md) §2.2.1「Phase 1: Logo 逐行出现」及逐字符方案二选一。  
> **与功能工单关系**：不依赖 076 配置文件；可依赖环境变量**单行**关闭 Splash（如 `THEWORLD_TUI_SPLASH=0`）若实现时确有调试需要——若需解析 YAML 优先等 **076** 后再接，本单优先纯默认 ON + 简单 env。

## 范围

- 在 **进入现有 Home/Chat 主 TUI 之前**（或全屏最外层包一层短生命周期组件），实现 **仅 Phase 1**：
  - 使用既有 ASCII/字符资源或 `chat-tui-art` 中抽出的**最少**行组（不必一次上齐设计稿 6 行大 Logo，可先用简化 THEWORLD 字标行块，**行为**与稿一致：自上而下或定时逐行追加）。
  - 定时步进（如 ~100ms/行，可配置常量放在组件文件顶部；**不**要求远程配置）。
- **不实现**：呼吸闪烁、CTA 文案「Press any key」、自动 3s 进入——留给 **075**。

## 验收

- TTY 下 `pnpm theworld chat --tui`（或等价）可看到开屏在短时段内**逐行**出现，结束后进入**当前**已存在的后续界面（与今天行为一致，仅多前置 Splash 阶段 1）。  
- `pnpm --filter @theworld/cli check` 通过。  
- 窄终端/无彩（`NO_COLOR`）不崩溃，降载为无 ANSI 或静态文本（与 `style` 能力一致即可）。

## 不做什么

- 不实现 Phase 2/3（→ **075**）。  
- 不实现 SessionList、设置、Vim 模式。  
- 不增加 server contract 或新 SDK 方法。

---

## 落库备注（验收后）

- 实现：`packages/cli/src/tui/chat-tui-splash.tsx`（`SPLASH_LINE_STEP_MS=100`）；`run-chat-tui.tsx` 中以 `ChatTuiRoot` 包裹 `ChatTuiApp`；`buildSplashPhase1Lines` 复用 `buildLazyvimLogoLines`。  
- 首条 logo 行立即显示，其后每 100ms 多一行。  
- `THEWORLD_TUI_SPLASH=0` 或提供 `initialText` 时跳过开屏。  
- `help` 与 `test:project-cli` 已登记 `THEWORLD_TUI_SPLASH`。
