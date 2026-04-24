# 070 CLI Input 与 Command Affordances

## 目标

把 TheWorld CLI 的输入区、draft editing、slash discoverability 与 command affordance 收口为产品级 shell 交互。

本单只解决：

1. input/footer 的状态层级
2. draft editing model 与基本 keyboard grammar
3. slash / command affordance 的 discoverability

---

## 背景

- 当前 CLI line UI 与 TUI 在输入体验上仍明显落后于参考项目。
- `THEWORLD_CLI_SHELL_PARITY_DESIGN.md` 已冻结：输入区必须成为 shell footer 的一部分，而不是正文附加。
- 若不单独收口输入与命令 affordance，shell 即便视觉更像参考项目，交互完成度仍会明显落后。

---

## 修改范围（冻结）

**允许修改：**

- `packages/cli/src/chat-input.ts`
- `packages/cli/src/cmd-chat.ts`
- `packages/cli/src/slash-chat.ts`
- `packages/cli/src/slash-complete.ts`
- `packages/cli/src/help.ts`
- `packages/cli/src/tui/**`
- `scripts/test-project-cli.mjs`
- `docs/requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md`
- 本工单与 `active/README.md`

**禁止修改：**

- `packages/shared/contracts/**`
- `packages/sdk/**`
- `packages/server/**`
- `packages/core/**`
- `apps/web-console/**`
- 完整 command palette 后端 / mode contract

---

## 单一路径设计（冻结）

1. 输入态必须显式区分：
   - `idle`
   - `busy`
   - `blocked`
2. input/footer 应明确告诉用户：
   - 现在能否输入
   - 现在输入会发生什么
   - 现在有哪些高价值命令入口
3. slash discoverability 必须成为 shell affordance，而不是用户记忆测试。
4. 本单可增强 draft editing 与 keyboard grammar，但不引入新的终端框架。
5. command affordance 的目标是“更像产品入口”，不要求一次实现完整 OpenCode 级命令面。

---

## 验收标准

1. `pnpm --filter @theworld/cli check` 通过。
2. `pnpm test:project-cli` 通过。
3. `pnpm verify` 通过。
4. CLI shell 的输入与命令入口已经不再只是“原始文本框 + 零散 hint”。

---

## 升级条件

命中任一即停止并升级：

- 需要新的终端框架才能推进输入模型
- 需要新的 capability/mode contract 才能推进 command affordance
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

- 不新增 fake `plan/build/permission` 模式
- 不引入完整 command palette contract
- 不引入新的终端框架
