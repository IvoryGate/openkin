# 079 TUI：全屏会话列表层（j/k/Enter，消费 078 数据）

> **类型**：**仅 TUI**；依赖 **078** 提供的数据 DTO/加载函数。  
> **设计依据**：[TUI_DESKTOP_DESIGN_SPEC.md §5.1、§4.1](../../requirements/TUI_DESKTOP_DESIGN_SPEC.md)。

## 前提

- **078** 已合入，可从 CLI 层调用到「会话列表条目的纯数据」。

## 范围

- 在 `chat` TUI 中增加**全屏/覆盖**「会话列表」态（**非**新 HTTP）：  
  - 默认 `Ctrl+L` 打开（与稿一致；若与现全局快捷键冲突，在实现 PR 的 `help` 中声明**迁移**并保留一期兼容）。  
  - `j`/`k` 或上下键移动高亮；`Enter` 选中后**切换**当前 `sessionId` 并**关闭**覆盖层、回到主 Chat/Transcript（需触发与 `--session` 切换等价的 in-app 行为）。  
  - `q` 或 `Escape` 关闭列表**不**切换会话。  
- **不**实现：搜索栏、`d` 删除、`:fork`（各留后续独立 TUI+功能 小单）。

## 验收

- 手工：Server 有 ≥2 会话时，列表可切换且 transcript 与 session 对齐。  
- `pnpm --filter @theworld/cli check`；`pnpm test:project-cli` 通过。  
- 不引入新 DTO 于 `packages/shared/contracts`（用已有 session id 字符串即可）。

## 不做什么

- 不实现 Settings 面板、主题 JSON、Vim 全模式。  
- 不重复实现 078 的数据拉取（仅 import 调用）。
