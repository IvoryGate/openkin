# 060 Budget-Mode Work Order

本文件不是新的 exec-plan，而是对 [`060_cli_session_identity_and_tty_attach.md`](./060_cli_session_identity_and_tty_attach.md) 的**弱模型执行工作单**。

用途：

- 直接复制给 budget-mode / 低能力模型
- 减少其二次做方向判断
- 强制其在冻结边界内推进

---

## 可直接使用的提示词

```text
你当前处于 budget mode。

你的职责不是重新设计系统，而是在现有仓库规则、执行计划和验证脚本约束下，完成小范围、低风险、可验证的实现任务。

当前任务：
实现 `docs/exec-plans/completed/060_cli_session_identity_and_tty_attach.md`。

任务范围：
- 允许修改的目录：
  - `packages/cli/src/`
  - `scripts/test-project-cli.mjs`
  - `docs/requirements/PROJECT_CLI.md`
  - `docs/requirements/THEWORLD_CLI_SHELL_DESIGN.md`
  - `docs/exec-plans/completed/060_cli_session_identity_and_tty_attach.md`
- 不允许修改的目录：
  - `packages/shared/contracts/`
  - `packages/sdk/`
  - `packages/server/`
  - `packages/core/`
  - `packages/cli/src/tui/`

你开始前必须先读：
- `AGENTS.md`
- `docs/index.md`
- `docs/governance/MODEL_OPERATING_MODES.md`
- `docs/exec-plans/completed/060_cli_session_identity_and_tty_attach.md`
- 与任务直接相关的实现文件：
  - `packages/cli/src/chat-args.ts`
  - `packages/cli/src/chat-session-resolve.ts`
  - `packages/cli/src/cmd-chat.ts`
  - `packages/cli/src/cmd-sessions.ts`
  - `packages/cli/src/chat-status.ts`
  - `packages/cli/src/session-alias.ts`
  - `packages/cli/src/help.ts`
  - `scripts/test-project-cli.mjs`

你必须遵守以下冻结决策：
1. 新增 **TTY-only** 入口：`theworld chat --pick`。
2. `--pick` 只能基于现有 `listSessions({ kind: 'chat' })` 做最近会话选择。
3. 非 TTY 下调用 `--pick` 必须直接报错，并提示改用 `--resume <id>`。
4. session 展示优先级冻结为：
   - 主标题：`displayName`
   - 次级提示：本地 alias（若与 `displayName` 不同）
   - 保底标识：短 id
5. `--resume <alias>` 与 `--resume <id>` 语义不变；`--pick` 只是更顺手的 TTY 入口。
6. 不新增 `sessions pick`，不新增 fuzzy search，不做全屏选择器。

建议执行顺序：
1. 先扩展 `chat-args.ts`，仅新增 `--pick` 解析，不顺手扩张其他 flag。
2. 再修改 `chat-session-resolve.ts`，把“continue latest / explicit resume / pick recent”三条路径分清。
3. 再修改 `cmd-chat.ts` 与 `chat-status.ts`，统一 session identity 展示顺序。
4. 需要时再微调 `cmd-sessions.ts` / `help.ts` 的叙事，让用户能理解 `displayName`、alias、短 id 的关系。
5. 最后更新 `scripts/test-project-cli.mjs`，至少覆盖：
   - `chat --pick` 的非 TTY 报错路径
   - `--resume` / `--continue` 现有行为不回退
   - banner / status / session 展示不冲突

不做什么：
- 不新增 Session 搜索 API
- 不把本地 alias 提升为服务端 contract
- 不做 GUI 风 session chooser
- 不做 message 预览 / rewind / rollback
- 不改 `packages/cli/src/tui/**`
- 不自行扩展到 `067`–`072`

验收标准：
- `pnpm test:project-cli`
- `pnpm verify`

升级条件：
- 需要改 Session API 返回结构
- 需要新增服务端搜索/排序接口
- 需要把 picker 做成全屏 TUI
- `pnpm verify` 连续两轮不通过
- 无法在现有返回数据内稳定区分 `displayName`、alias、短 id 的展示层级

你的输出方式：
- 先说明你理解的任务范围
- 再说明你准备修改哪些文件
- 修改后汇报 `pnpm test:project-cli` 与 `pnpm verify` 的结果
- 如果停止，明确说明停止原因和需要升级的点
```

---

## 使用说明

- 若 budget-mode 模型开始讨论新的 session API、服务端搜索、全屏 session picker 或 rewind/rollback，说明它已经偏离本单，应立即停止。
- 若本单落地后需要继续推进 shell home、conversation shell、thread UX、input affordance 或设计系统，请切换到 `067`–`072` 对应工作单，不要在本单继续扩张。
