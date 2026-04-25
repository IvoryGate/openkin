# 080 — TUI 对齐《TUI 详细设计方案》收口径与分阶段实施

## 元信息

- **状态**: active（本工单为唯一执行入口，开发按阶段验收后再扩 scope）
- **权威设计**: `docs/requirements/TUI_DESKTOP_DESIGN_SPEC.md`（与 Desktop `docs/TUI_DESIGN.md` 同步；**最低层产品约束**）
- **并行约束**（不得突破）: `docs/requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md`、`docs/requirements/THEWORLD_TUI_PRODUCT_DESIGN.md`；**不扩张** server / SDK / HTTP contract，除非另开工单显式批准

## 目标（收口表述）

在现有 Ink TUI 上，使 **区域布局、语义色、交互规范** 与《TUI 详细设计方案》**一致可验收**：

1. **色块优先**（§2.3）: 用背景色块区分 Header / Transcript / Input / StatusBar 与消息角色区；**不以** 圆角 ASCII 边框为主结构。
2. **语义 Token**（§3.3）: 单一主题层提供 `--background` / `--surface` / `--user-message` / `--assistant-message` / `--tool-*` / `--error` / `--border` / `--text*` / `--focus` 等，并与 `.theworld/tui.yaml` 的 `tui.theme` 联动（`packages/cli/src/tui-config.ts`）。
3. **布局**（§2.1、§2.2.3）: 四带结构（Header → Main[Transcript ± 侧栏] → Input → Status）；**宽度 ≥ 80 列** 时侧栏 **20 列**（与 `TUI_SIDEBAR_*` 常数一致）；行高在 TTY 用**行**近似文档中的 **px** 预算。

## 已存在的代码基线（本工单内继续完成，不重复造轮子）

| 项 | 路径 / 说明 |
|----|-------------|
| 主题 ID 与 `tui.yaml` | `packages/cli/src/tui-config.ts`（`theme`、`tui.display.show_sidebar`） |
| 语义色预设与 `getTuiPalette` | `packages/cli/src/tui/tui-ink-palette.ts` |
| React Context | `packages/cli/src/tui/tui-theme-context.tsx`（`TuiThemeProvider` / `useTuiPalette`） |

**缺省**: 上述模块若尚未在 **根级 TUI 树**（含 Splash / SessionList / 主壳）**统一包裹并接线**，则仍算本工单待办。

## 分阶段实施（按顺序关账）

### Phase A — 主题层收口

- [ ] 在 TUI 入口（如 `run-chat-tui.tsx` 的 `ChatTuiRoot` 或等价单根）用 `TuiThemeProvider` 包裹，主题 ID 来自 `loadTuiFileConfig().theme`；`NO_COLOR` / `dumb` 与现有 `colorEnabled` 行为一致（无背色时回退为 dim/标签）。
- [ ] 预置 **Phase 1 五主题 ID**（§3.2）: `dark` / `light` / `catppuccin` / `tokyonight`（及别名 `tokyo-night`）/ `one-dark`（及别名 `onedark`）；未知 ID 回退 `dark`。
- [ ] **验收**: `pnpm --filter @theworld/cli check`；手动切换 `tui.theme` 可见前景/底对比变化（有颜色终端）。

### Phase B — 区域与 Transcript

- [ ] `ChatTuiHeader` / 主内容列 / `ChatTuiInputBar` / `ChatTuiStatusBar` 使用 Token 的 **surface / background / statusBar** 等，Header **底部分隔**（色带或 1 行 `border` 色，避免「圆角框」成主视觉）。
- [ ] 主 Transcript 容器背景 `--background`；**移除** 主对话区大盒子的 `round` 外框，改为与文档一致的扁平分区。
- [ ] `ChatTuiTranscript` 内按块类型套 **user / assistant / tool / error** 背景；错误块 **左侧色带**（文档 3px；TTY 用 1–3 列近似）。
- [ ] 用户消息前缀与 §5.2 一致时（如行首 `> ` 与主色强调），在宽足够时实现；极窄可降级。
- [ ] **验收**: 同 A + 目视对照 §2.3 示意；流式/ERROR 与静态块均可见分色。

### Phase C — 侧栏与全屏层

- [ ] 侧栏（§2.2.3）: 在 **宽 ≥ 80** 且未配置隐藏时，展示 **最近会话（约 5 条）**、**新建/切换说明**、**设置入口或快捷键说明**；数据复用 `fetchTuiSessionList` / 现有 `listSessions` 路径，不新增 API。
- [ ] `ChatTuiSessionPicker`（Ctrl+L）与 `ChatTuiSplash`：背景与字色与主题 Token 一致，避免与主壳风格割裂；**不强制**重做 Splash 动画，但须不违背「色块优先」。
- [ ] **Settings（Ctrl+,）**（§2.2.2、§4）: 至少 **全屏或覆盖层** 占位，展示当前主题/配置文件路径/退出键；不依赖新服务端点。

### Phase D — 质量闸

- [ ] `pnpm verify`（或仓库约定下的 CLI 子集至少 `pnpm --filter @theworld/cli check` + `pnpm test:project-cli`）
- [ ] 若仅动 CLI：除非架构边界变化，**不** 要求改 `ARCHITECTURE.md`；若 `help`/环境变量有新增，再补 `help` 与相关一句说明。

## 非目标（另工单）

- 完整 Vim 模式、40+ 主题、任务详情全屏、代码语法高亮管线（可引用 §3.x 作为未来工单）。
- 修改 Desktop 非仓库副本的设计稿源文件（本仓库以 `TUI_DESKTOP_DESIGN_SPEC.md` 为准即可）。

## 回滚与风险

- 真彩色/hex 在部分终端不生效时，以「无背景 + 语义色名」降级；不得因此阻塞无 TTY CI。
- 侧栏与会话拉取失败时：静默降级为提示行，不抛未捕获异常。

## 参考 PR / 关账

- 本工单关账时：在 `docs/exec-plans/completed/README.md` 增加索引，并将本文档移至 `docs/exec-plans/completed/080_*.md`；`active/README.md` 的 **080+** 队列指向下一张工单。
