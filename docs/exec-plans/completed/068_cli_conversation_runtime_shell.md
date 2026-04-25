# 068 CLI Conversation Runtime Shell

## 目标

把 TheWorld 的活跃对话界面重建为产品级 runtime shell，收口 transcript viewport、stream semantics、tool/result 呈现与 run-state shell。

本单只解决：

1. active conversation shell 的信息架构
2. transcript viewport / turn grouping / stream reducer 的产品化
3. run phase、tool/result、failure 的稳定呈现

---

## 背景

- 当前 `063`–`066` 的 TUI-only 路线已经不足以承载 shell parity 目标。
- `THEWORLD_CLI_SHELL_PARITY_DESIGN.md` 明确要求 conversation shell 成为工作主界面，而不是被美化的日志页。
- 当前实现虽然已有语义块基础，但 viewport、partial stream failure、turn grouping、runtime shell hierarchy 仍远低于目标水位。

---

## 修改范围（冻结）

**允许修改：**

- `packages/cli/src/chat-stream-sink.ts`
- `packages/cli/src/tui/**`
- `packages/cli/src/chat-status.ts`
- `packages/cli/src/cmd-chat.ts`
- `scripts/test-project-cli.mjs`
- `docs/requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md`
- 本工单与 `active/README.md`

**禁止修改：**

- `packages/shared/contracts/**`
- `packages/sdk/**`
- `packages/server/**`
- `packages/core/**`
- `apps/web-console/**`
- session/thread surface 深化（留给 `069`）
- 输入编辑模型与 command affordance（留给 `070`）

---

## 单一路径设计（冻结）

1. conversation shell 固定为：
   - `Header`
   - `TranscriptViewport`
   - `FooterAndInput`
2. transcript 必须是 viewport / scrollback 心智，而不是简单的 `string[]` 或最后若干行裁切。
3. 语义块必须稳定区分：
   - `user`
   - `assistant`
   - `tool_call`
   - `tool_result`
   - `error`
   - 其他辅助块
4. partial streamed assistant 内容在 failure path 不得丢失。
5. `run start/end` 不再作为主正文组织方式。
6. tool/result 默认展示摘要，不默认展开原始大段日志。

---

## 验收标准

1. `pnpm --filter @theworld/cli check` 通过。
2. `pnpm test:project-cli` 通过。
3. `pnpm verify` 通过。
4. 当前 runtime shell 已经不再表现为“美化日志流”，而是清晰的 conversation shell。

---

## 升级条件

命中任一即停止并升级：

- 需要新增 stream event 或 DTO 才能继续组织 transcript
- 需要新增后端 run lifecycle contract 才能继续推进本单目标
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

- 不新增 server event
- 不实现 richer session/thread metadata
- 不引入完整 command palette
- 不引入新的 mode 体系
