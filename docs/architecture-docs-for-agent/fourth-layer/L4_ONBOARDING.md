# L4 Onboarding, Setup, Discoverability（100）

## 目标

不引入 Web/账号体系的前提下，让 **仅使用本地 CLI/TUI** 的新用户能回答：

- 服务是否在跑、连到哪
- 工作区/密钥/（可选）TUI 标签等本地配置是否就绪
- 下一步可执行的命令（`inspect`、空态 `chat`、工具/Skill 发现）
- 出错了应执行什么（`pnpm dev:server`、`theworld inspect health`、API key）

## 首次 / 空态检查项（冻结）

| 检查项 | 如何呈现 | 不可用时 |
|--------|----------|----------|
| 服务端点 | 行模式 welcome、TUI home「Local profile」 | `theworld inspect health` 失败 → 见 `l4-onboarding` 恢复行 |
| 工作区目录 | `THEWORLD_WORKSPACE_DIR` 或默认 `cwd/workspace` | 只影响 server 与 Skill 路径；CLI 只展示标签 |
| API key | 显示已设置 / 未设置 | 401/403 → 恢复行 |
| 工具与 Skill 发现 | `theworld inspect tools|skills`、聊天内 `/skills`、help / First run 段 | 无 |
| 危险与审批 | 一行风险说明，指向 L3 093 | 无新协议 |

## 实现落点

- `packages/cli/src/l4-onboarding.ts` — 恢复行与 profile 文案
- `packages/cli/src/help.ts` — `First run` 段
- `packages/cli/src/chat-banner.ts` — 行模式欢迎后 L4 块
- `packages/cli/src/tui/chat-tui-home-shell.tsx` — TUI 空态 profile
- `pnpm test:l4-onboarding` — help 中关键句稳定存在；与 **104–106** 交叉的 discoverability 由 `test:l4-background` / `test:l4-plan` / `test:l4-polish` 间接守护

## 与 099 的关系

在 [L4_PRODUCT_SHELL_MAP.md](./L4_PRODUCT_SHELL_MAP.md) 的 surface 名与命令归属之上，本单只增加 **可发现性文案与错误恢复路径**，不新增 surface 名。
