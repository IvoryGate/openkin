# 105 · L4 Single-Agent Plan Review Execute

## 目标

建立单 agent 的本地 `plan -> review -> execute` 工程工作流，使 TheWorld 不只是聊天壳，而能承接可审查、可执行、可恢复的工程任务。

本单不做多 agent / subagent / team orchestration。

## 背景

L4 的 single-agent workflow 应先成立，然后 L6 才能在此基础上做 team / workflow / business app。当前已有 CLI/TUI 与 run/session 能力，但缺少：

- plan artifact
- review / revise
- approve to execute
- execution observation
- audit trail
- failure recovery

## 已冻结决策

1. 本单只做 single-agent workflow，不引入 subagent。
2. Plan artifact 应落在本地 workspace / session 可追踪位置，不依赖 remote service。
3. Review gate 可以先是本地交互与显式命令，不等同于 L3 approval protocol。
4. 执行阶段应复用现有 run / tool / context / approval product surfaces。

## 允许修改

- `packages/cli/src/`
- `scripts/`
- `workspace/` 示例文件（如需要，必须避免覆盖用户已有内容）
- `docs/architecture-docs-for-agent/fourth-layer/`
- `docs/architecture-docs-for-human/backend-plan/layer4-design/`
- `docs/exec-plans/active/`
- 根 `package.json`（仅脚本）

## 禁止修改

- `packages/core/src/` 多 agent / orchestrator 抽象
- L6 orchestration 文档与实现
- `packages/channel-core/`
- Web / Desktop workflow UI
- 自动创建 git commit / branch / worktree
- 大规模改写 CLI TUI 视觉系统

## 低能力模型执行前必须先读

- `AGENTS.md`
- `docs/index.md`
- `docs/governance/MODEL_OPERATING_MODES.md`
- `098_l4_engineering_product_shell_parent.md`
- `104_l4_background_resume_recover.md`
- 当前 CLI chat / slash command / session 文件

## 本轮范围

1. 定义 single-agent plan artifact 格式与本地保存位置。
2. 增加 plan / review / execute 的 CLI/TUI 命令或 flow。
3. 定义 review gate：accept / revise / cancel。
4. 执行阶段接入 run/session/status/context/approval 可见性。
5. 增加自动化验证覆盖至少一条 plan/review/execute 本地流程。

## 本轮不做

- 不做 subagent / team。
- 不做 L6 workflow run 对象。
- 不做自动 git 操作。
- 不做长期后台多任务调度。
- 不做 business app 场景。

## 验收标准

1. 用户能让单 agent 生成可查看的 plan artifact。
2. 用户能 review 并显式 approve / revise / cancel。
3. 用户能从 approved plan 进入 execute flow。
4. 执行后的结果与 session/run/audit 能关联。
5. `pnpm check` 通过。
6. `pnpm verify` 通过。

## 必跑命令

```bash
pnpm check
pnpm verify
```

## 升级条件

1. 需要引入 subagent 或多 agent 协调。
2. 需要定义 L6 workflow run schema。
3. 需要自动修改 git 历史或工作树策略。
4. `pnpm verify` 连续两轮不通过。
