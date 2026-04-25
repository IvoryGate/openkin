# 068 Budget-Mode Work Order

本文件不是新的 exec-plan，而是对 [`068_cli_conversation_runtime_shell.md`](./068_cli_conversation_runtime_shell.md) 的**弱模型执行工作单**。

---

## 可直接使用的提示词

```text
你当前处于 budget mode。

当前任务：
实现 `docs/exec-plans/completed/068_cli_conversation_runtime_shell.md`。

允许修改：
- `packages/cli/src/chat-stream-sink.ts`
- `packages/cli/src/tui/`
- `packages/cli/src/chat-status.ts`
- `packages/cli/src/cmd-chat.ts`
- `scripts/test-project-cli.mjs`
- `docs/requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md`
- `docs/exec-plans/completed/068_cli_conversation_runtime_shell.md`

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
- `docs/exec-plans/completed/068_cli_conversation_runtime_shell.md`
- 与任务直接相关的实现文件：
  - `packages/cli/src/chat-stream-sink.ts`
  - `packages/cli/src/tui/run-chat-tui.tsx`
  - `packages/cli/src/tui/chat-tui-transcript.tsx`
  - `scripts/test-project-cli.mjs`

冻结决策：
1. conversation shell 固定为 Header / TranscriptViewport / FooterAndInput。
2. transcript 必须是 viewport / scrollback 心智，而不是最后若干行裁切。
3. 语义块必须稳定区分 user / assistant / tool_call / tool_result / error 等类型。
4. partial streamed assistant 内容在 failure path 不得丢失。
5. 不再靠 `run start/end` 组织主正文。

不做什么：
- 不新增 stream event
- 不实现 richer session/thread metadata
- 不引入新的 mode 体系

验收标准：
- `pnpm --filter @theworld/cli check`
- `pnpm test:project-cli`
- `pnpm verify`

升级条件：
- 需要新增 stream event 或 DTO
- 需要新增后端 run lifecycle contract
- `pnpm verify` 连续两轮不通过
```
