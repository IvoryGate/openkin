# 076 功能：`.theworld/tui.yaml` 最小加载层（无 TUI 组件）

> **类型**：**功能/基础设施**（Node 层解析 + 默认回退），**不**改 Ink 布局/页面。  
> **设计依据**：[TUI_DESKTOP_DESIGN_SPEC.md §6.1、6.2](../../requirements/TUI_DESKTOP_DESIGN_SPEC.md)。

## 范围

- 在 `packages/cli` 内新增**独立模块**（建议路径如 `src/tui-config.ts` 或 `src/config/tui-yaml.ts`），责任仅限：
  - 从**当前工作区**或约定路径读取 `.theworld/tui.yaml`（若存在）；**不存在**时返回内存默认对象。  
  - 支持字段（**最小**）：`tui.theme`（字符串 id，如 `dark`）、`tui.display.show_sidebar` 或稿中等价布尔（若与现有 env 重复，**优先级**在模块内写清：CLI flag > 本文件 > 默认）。  
  - **严禁**在 076 中修改 `render()`、不新增 `*.tsx`。
- 导出纯函数供后续 **TUI 工单** 调用，例如 `loadTuiConfig(): TuiFileConfig`。
- 在 `help` 或 `PROJECT_CLI.md` 增加**一行**说明配置文件路径（可放进本 PR 的 docs 小改，**本工单允许** 仅 `docs` + `src` 非 UI 文件）。

## 验收

- 单测或 `test-project-cli` 中可缺省无文件、有文件时解析不抛错（YAML 可用现成轻量依赖，若新增依赖须更新根 `package.json` 并过 `pnpm verify`）。  
- 无 tui 文件时，现有 `chat` 行为**不变**。  
- `packages/cli` 下无新增 `.tsx` 文件。

## 不做什么

- 不实现 5+ 色板主题 JSON、不渲染 Sidebar。  
- 不扩张 `@theworld/client-sdk` 的对外 API。

---

## 落库备注

- `packages/cli/src/tui-config.ts`：`loadTuiFileConfig(cwd)`、`DEFAULT_TUI_THEME`、依赖 `yaml`。  
- `scripts/verify-tui-file-config.mjs` + `test:project-cli` 中 `assertTuiFileConfig()` 烟测。  
- `help` 与 `PROJECT_CLI.md` 已各一行说明 `.theworld/tui.yaml`。
