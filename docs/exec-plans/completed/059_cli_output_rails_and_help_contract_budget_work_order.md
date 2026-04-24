# 059 Budget-Mode Work Order

本文件不是新的 exec-plan，而是对 [`059_cli_output_rails_and_help_contract.md`](./059_cli_output_rails_and_help_contract.md) 的**弱模型执行工作单**。

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
实现 `docs/exec-plans/completed/059_cli_output_rails_and_help_contract.md`。

任务范围：
- 允许修改的目录：
  - `packages/cli/src/`
  - `scripts/test-project-cli.mjs`
  - `docs/requirements/PROJECT_CLI.md`
  - `docs/requirements/THEWORLD_CLI_SHELL_DESIGN.md`
  - `docs/exec-plans/completed/059_cli_output_rails_and_help_contract.md`
- 不允许修改的目录：
  - `packages/shared/contracts/`
  - `packages/sdk/`
  - `packages/server/`
  - `packages/core/`
  - `apps/web-console/`
  - `packages/cli/src/tui/`

你开始前必须先读：
- `AGENTS.md`
- `docs/index.md`
- `docs/governance/MODEL_OPERATING_MODES.md`
- `docs/exec-plans/completed/059_cli_output_rails_and_help_contract.md`
- 与任务直接相关的实现文件：
  - `packages/cli/src/io.ts`
  - `packages/cli/src/help.ts`
  - `packages/cli/src/index.ts`
  - `packages/cli/src/errors.ts`
  - `packages/cli/src/cmd-sessions.ts`
  - `packages/cli/src/cmd-inspect.ts`
  - `packages/cli/src/cmd-tasks.ts`
  - `packages/cli/src/cmd-chat.ts`
  - `scripts/test-project-cli.mjs`

你必须遵守以下冻结决策：
1. `--json` 成功输出只走 stdout。
2. 人类可读输出默认走 stderr，包括：
   - root help / topic help
   - usage 错误
   - 非 `--json` 的 list/show/status 文本
   - chat 行模式与 slash 文本人类提示
3. `chat` 继续不支持 `--json`，但它的人类叙事输出也按人类轨处理。
4. help 结构统一为：
   - what it is
   - usage
   - topics / subcommands
   - global flags
   - environment
5. 不引入新依赖，不重写为 yargs，不新增子命令。

建议执行顺序：
1. 先梳理 `packages/cli/src/io.ts`，明确 stdout / stderr 的最小辅助函数边界。
2. 再统一 `help.ts` 与 `errors.ts` 的输出轨。
3. 再检查 `cmd-sessions.ts`、`cmd-inspect.ts`、`cmd-tasks.ts` 中 `--json` 与非 JSON 的输出路径，保证 JSON 不被人类文本污染。
4. 最后检查 `cmd-chat.ts` 和 slash 相关人类提示，确保仍走人类轨。
5. 更新 `scripts/test-project-cli.mjs`，至少断言：
   - help 文本仍可读
   - `--json` 输出仍可 `JSON.parse`
   - 人类输出不会污染 JSON stdout

不做什么：
- 不新增子命令
- 不改现有 Service / SDK surface
- 不做 Session picker
- 不做 TUI 视觉重构
- 不改 `packages/cli/src/tui/**`
- 不自行扩展到 `060` 或 `067`–`072`

验收标准：
- `pnpm test:project-cli`
- `pnpm verify`

升级条件：
- 需要改 SDK / server 才能定义输出语义
- 需要引入命令解析库重写 CLI 入口
- `pnpm verify` 连续两轮不通过
- 无法明确判断某段输出应属于 stdout 还是 stderr，且会影响既有 JSON contract

你的输出方式：
- 先说明你理解的任务范围
- 再说明你准备修改哪些文件
- 修改后汇报 `pnpm test:project-cli` 与 `pnpm verify` 的结果
- 如果停止，明确说明停止原因和需要升级的点
```

---

## 使用说明

- 若 budget-mode 模型开始讨论新的 CLI 模式、主题系统、TUI 布局或 Service contract，说明它已经偏离本单，应立即停止。
- 若 `059` 落地后需要继续推进 session picker 或新的 shell parity 路线，请切换到 `060`、`067`–`072` 对应工单，不要在本单内继续扩张。
