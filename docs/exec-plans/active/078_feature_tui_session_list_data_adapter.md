# 078 功能：TUI 用会话列表数据适配器（无全屏 UI）

> **类型**：**功能/数据面**；**不**包含 Ink 全屏页、不新增组件 `.tsx`（**除** 纯 `.ts` 中类型导出）。  
> **设计依据**：[TUI_DESKTOP_DESIGN_SPEC.md §5.1](../../requirements/TUI_DESKTOP_DESIGN_SPEC.md)。

## 范围

- 在 `packages/cli` 中新增**薄适配层**（如 `tui/tui-session-list.ts` 或 `chat-session-for-tui.ts`），对 `@theworld/client-sdk` 已有 `listSessions` / 等价能力做：
  - 统一错误包装为 `TuiListError` 风格（或复用 `formatCliError`）。  
  - 将 `MessageDto`/`Session` 等转为 **TUI 无关** 的 DTO：至少 `id`、`label`（displayName/alias/shortId 规则与 `packages/cli/src/chat-status.ts` 或现有 **line UI** 一致）、`updatedAt` 可选。  
- 可附加 `limit` 默认 20，与稿「最近 5 条」不冲突时可配置常量。  
- **不**在 078 中绑定 `useInput`、不 `render` 任何列表行。

## 验收

- 单元或轻量 `node` 脚本级调用（可 mock baseUrl 若仓库已有方式）；`pnpm test:project-cli` 仍过。  
- 无对 `packages/server` 的新增 HTTP 路径需求。

## 不做什么

- 不实现 `Ctrl+L` 全屏 UI、搜索 `/`、删除 `d`（→ **079** 及之后独立工单）。  
- 不增加 operator contract 字段。
