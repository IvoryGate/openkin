# 069 Budget-Mode Work Order

本文件不是新的 exec-plan，而是对 [`069_cli_session_and_thread_ux.md`](./069_cli_session_and_thread_ux.md) 的**弱模型执行工作单**。

---

## 可直接使用的提示词

```text
你当前处于 budget mode。

当前任务：
实现 `docs/exec-plans/completed/069_cli_session_and_thread_ux.md`。

允许修改：
- `packages/cli/src/chat-session-resolve.ts`
- `packages/cli/src/cmd-chat.ts`
- `packages/cli/src/cmd-sessions.ts`
- `packages/cli/src/chat-status.ts`
- `packages/cli/src/session-alias.ts`
- `packages/cli/src/help.ts`
- `packages/cli/src/tui/`
- `scripts/test-project-cli.mjs`
- `docs/requirements/PROJECT_CLI.md`
- `docs/requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md`
- `docs/exec-plans/completed/069_cli_session_and_thread_ux.md`

禁止修改：
- `packages/shared/contracts/`
- `packages/sdk/`
- `packages/server/`
- `packages/core/`
- `apps/web-console/`

开始前必须先读：
- `AGENTS.md`
- `docs/index.md`
- `docs/governance/MODEL_OPERATING_MODES.md`
- `docs/requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md`
- `docs/exec-plans/completed/069_cli_session_and_thread_ux.md`
- 与任务直接相关的实现文件：
  - `packages/cli/src/chat-session-resolve.ts`
  - `packages/cli/src/cmd-sessions.ts`
  - `packages/cli/src/cmd-chat.ts`
  - `scripts/test-project-cli.mjs`

冻结决策：
1. session identity 统一为 displayName -> alias -> shortId。
2. home shell、picker、header、footer、sessions list、--resume/--continue/error hints 必须叙事一致。
3. `--pick` 继续是 TTY-only，但必须像产品入口而不是临时技术分支。
4. 若现有 `listSessions` 数据不足以支撑更深 thread UX，应停止并升级，而不是自己发明 metadata。

不做什么：
- 不新增 session/thread DTO
- 不实现 richer thread preview contract
- 不把本地 alias 提升为服务端 contract

验收标准：
- `pnpm test:project-cli`
- `pnpm verify`

升级条件：
- 需要 richer thread metadata
- 需要新增搜索/排序 API
- `pnpm verify` 连续两轮不通过
```
