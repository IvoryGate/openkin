# 062 CLI TUI 信息架构与展示密度收口

> **状态：已被 supersede（2026-04-24）。** 本文档对应旧的增量路线；当前新的主实施路径已提升为 shell parity 的 `067`–`072`，以上游设计 [`docs/requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md`](../../requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md) 为准。

## 目标

在 056–058 已有 Ink TUI 的基础上，进一步收口 TUI 的信息架构，使其更接近成熟 CLI 的“壳层分区 + 状态聚合”，但仍严格停留在既有 contract 内。

本单只做 TUI 内部展示组织，不做新的 server / sdk 能力。

---

## 背景

- 当前 TUI 已有品牌区、满屏布局、状态栏、转录区、输入区与流式光标。
- 但转录区中仍带有较多行模式遗留叙事（如 `--- run start ---` / `--- run end ---`），信息层次还可以继续产品化。
- 参考项目的启发是：TUI 的关键不是更多动画，而是**把状态、身份、正文、输入分区组织清楚**。

---

## 修改范围（冻结）

**允许修改：**

- `packages/cli/src/tui/**`
- `packages/cli/src/chat-stream-sink.ts`（仅当需抽离 TUI 专用 sink 行为）
- `packages/cli/src/chat-status.ts`
- `packages/cli/src/help.ts`
- `scripts/test-project-cli.mjs`
- `docs/requirements/THEWORLD_CLI_SHELL_DESIGN.md`
- 本工单与 `active/README.md`

**禁止修改：**

- `packages/shared/contracts/**`
- `packages/sdk/**`
- `packages/server/**`
- `packages/core/**`
- `apps/web-console/**`
- 行模式 `cmd-chat.ts` 主流程（除非为共享纯函数导出所必需）

---

## 单一路径设计（冻结）

1. TUI 内部不再把 run 生命周期主要表达为 `--- run start ---` / `--- run end ---` 字面分隔线。
2. run 状态、思考中、失败提示、resume 提示等，优先进入：
   - header / banner 下的状态位
   - status bar
   - transcript 中的更紧凑事件块
3. transcript 保持“用户 / agent / tool / note”可区分，但减少纯实现性噪音行。
4. 继续只使用现有数据：
   - `sessionId`
   - `displayName` / alias / `agentId`
   - `getMessages()` 近似上下文统计
   - 既有 `streamRun` 事件
5. 不新增 token 计数、不新增实时成本、不新增服务端模式字段。

---

## 验收标准

1. `pnpm --filter @theworld/cli check` 通过。
2. `pnpm test:project-cli` 继续通过，且非 TTY 路径不回退。
3. `pnpm verify` 通过。
4. 手工 TTY 验证：
   - 新会话
   - `--resume`
   - tool call / tool result
   - 失败态
   - `NO_COLOR=1`

---

## 升级条件

- 需要新增服务端状态字段才能完成 TUI 分区
- 需要改变 line mode stdout/stderr contract
- `pnpm verify` 连续两轮不通过

---

## 必跑命令

```bash
pnpm --filter @theworld/cli check
pnpm test:project-cli
pnpm verify
```

---

## 不做什么

- 不新增新的 TUI 模式（plan/build/permission）
- 不做多 pane 调试控制台
- 不做成本/上下文精确 token 统计
- 不改 Server / SDK surface
