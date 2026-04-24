# 063 TUI Transcript Model 与 Stream Reducer 重建

> **状态：已被 supersede（2026-04-24）。** 本文对应较窄的 TUI-local 路线；新的主实施路径已升级为 shell parity 的 `067`–`072`，以上游设计 [`docs/requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md`](../../requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md) 为准。

## 目标

重建 TheWorld TUI 的 transcript 数据模型与 stream reducer，使全屏 TUI 以**语义块**而不是 `string[]` 为核心渲染单位。

本单只解决：

1. TUI transcript 的 block model
2. stream 事件到 transcript block 的 reducer
3. 去除 `run start/end` 之类调试型叙事对 TUI 主正文的污染

本单不负责最终 shell layout、视觉 token 大收口或输入 polish。

---

## 背景

- `THEWORLD_TUI_PRODUCT_DESIGN.md` 已冻结：新的 TUI 主体必须基于 `user / assistant / tool_call / tool_result / note / error / system_hint` 语义块。
- 当前 `chat-stream-sink.ts` 与 `run-chat-tui.tsx` 仍偏向把事件尽快压成字符串，这让 UI 很难达到产品级层次。
- 若不先重建 transcript model，后续 header / footer / status / tokens 都会继续建立在脆弱表示上。

---

## 修改范围（冻结）

**允许修改：**

- `packages/cli/src/chat-stream-sink.ts`
- `packages/cli/src/tui/run-chat-tui.tsx`
- `packages/cli/src/tui/**`（仅限 transcript model / reducer / transcript rendering 所需文件）
- `packages/cli/src/chat-status.ts`（仅当需要对齐 run 状态映射）
- `scripts/test-project-cli.mjs`
- `docs/requirements/THEWORLD_TUI_PRODUCT_DESIGN.md`
- 本工单与 `active/README.md`

**禁止修改：**

- `packages/shared/contracts/**`
- `packages/sdk/**`
- `packages/server/**`
- `packages/core/**`
- `apps/web-console/**`
- `packages/cli/src/style.ts` 的视觉 token 大重构（留给 `065`）
- 输入模型、键盘策略与窄终端收缩（留给 `066`）

---

## 单一路径设计（冻结）

1. TUI transcript 主模型不再以 `string[]` 为核心。
2. 冻结 block 类型为：
   - `user`
   - `assistant`
   - `tool_call`
   - `tool_result`
   - `note`
   - `error`
   - `system_hint`
3. `streamRun` 既有事件只能被**重组**，不能要求新增 server event。
4. TUI 主正文不再插入 `--- run start ---` / `--- run end ---` 这类调试型边界行。
5. tool 相关内容默认呈现**摘要块**，不是原始大段日志回放。

---

## 验收标准

1. `pnpm --filter @theworld/cli check` 通过。
2. `pnpm test:project-cli` 通过。
3. `pnpm verify` 通过。
4. TUI 主 transcript 代码中已经能区分至少 `assistant`、`tool_call`、`tool_result`、`error` 四类块，而不是统一字符串流。

---

## 升级条件

命中任一即停止并升级：

- 需要新增 server / sdk event 才能表达 transcript 语义
- 需要在本单内重做 shell layout 或视觉系统才能推进
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

- 不新增 server fields / event / DTO
- 不实现新的 header / footer 信息架构
- 不做完整视觉 token 系统
- 不做输入框行为重写
