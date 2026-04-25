# 067 CLI Shell Home 与 Information Architecture

## 目标

为 TheWorld CLI shell 建立一个真正的**home / empty shell**，并同步收口根 help、topic help 与 shell discoverability 的信息架构。

本单只解决：

1. home / empty shell 的产品定位
2. shell 入口与命令 discoverability
3. home shell、help、hint 之间的统一叙事

---

## 背景

- `THEWORLD_CLI_SHELL_PARITY_DESIGN.md` 已冻结：当前差距不只在 active chat pane，而是整套 shell 缺少产品级入口。
- 当前 CLI 更像“直接进入聊天的技术入口”，缺少类似 OpenCode 的 home shell 心智。
- 若不先收口入口面，后续 runtime shell、session UX、input affordance 都会继续缺少统一入口语法。

---

## 修改范围（冻结）

**允许修改：**

- `packages/cli/src/cmd-chat.ts`
- `packages/cli/src/help.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/tui/**`（仅限 home / empty shell、入口信息架构与 discoverability 所需文件）
- `scripts/test-project-cli.mjs`
- `docs/requirements/PROJECT_CLI.md`
- `docs/requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md`
- 本工单与 `active/README.md`

**禁止修改：**

- `packages/shared/contracts/**`
- `packages/sdk/**`
- `packages/server/**`
- `packages/core/**`
- `apps/web-console/**`
- session picker / thread metadata 深化（留给 `069`）
- 输入编辑与 keyboard model（留给 `070`）

---

## 单一路径设计（冻结）

1. CLI shell 必须有清晰的 home / empty shell，而不是只有“banner + 空 transcript”。
2. home shell 负责：
   - 品牌位
   - 主入口提示
   - recent/resume affordance 的位置
   - command / help discoverability
3. root help、topic help、shell hint 必须叙事一致。
4. 不引入新子命令；优先在既有 `chat` / `help` surface 上收口产品入口。
5. 仍遵守 `059` 的 human rail vs machine rail 约束。

---

## 验收标准

1. `pnpm test:project-cli` 通过。
2. `pnpm verify` 通过。
3. CLI / TUI 至少有一个明确的 home / empty shell 入口，不再只是技术性空白界面。
4. root help 与 topic help 对 shell 入口的叙事已经统一。

---

## 升级条件

命中任一即停止并升级：

- 需要新增 server 字段才能表达 home shell 基本入口
- 需要新增命令体系或解析库重写 CLI 入口
- `pnpm verify` 连续两轮不通过

---

## 必跑命令

```bash
pnpm test:project-cli
pnpm verify
```

---

## 不做什么

- 不新增子命令
- 不实现 richer thread metadata
- 不重做 active transcript runtime
- 不引入 command palette 完整能力
