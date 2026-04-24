# 059 CLI 输出轨与 Help Contract

## 目标

先收口 TheWorld CLI 的**人机双轨输出 contract**，并同步整理 help / usage 信息架构。

本单只解决：

1. 人类可读输出与 `--json` 输出的轨道边界
2. root help / topic help / usage / error 的一致性
3. 非 TTY、pipe、CI 下不混入不必要的装饰文本

本单不做新的产品能力。

---

## 背景

- 参考报告已明确：热门 CLI 的核心不是“更花的 TUI”，而是 **human rail vs machine rail**。
- 当前 `packages/cli` 中 `println()`、error、help、各子命令的人类输出仍主要写向 stdout；`--json` 虽已存在，但还未冻结为统一 contract。
- 若不先收口此层，后续 session picker、visual tokens、TUI 收口会继续建立在不稳定的输出语义上。

---

## 修改范围（冻结）

**允许修改：**

- `packages/cli/src/io.ts`
- `packages/cli/src/help.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/cmd-*.ts`
- `packages/cli/src/errors.ts`
- `scripts/test-project-cli.mjs`
- `docs/requirements/PROJECT_CLI.md`
- `docs/requirements/THEWORLD_CLI_SHELL_DESIGN.md`
- 本工单与 `active/README.md`

**禁止修改：**

- `packages/shared/contracts/**`
- `packages/sdk/**`
- `packages/server/**`
- `packages/core/**`
- `apps/web-console/**`
- `packages/cli/src/tui/**` 的布局与组件逻辑（本单不处理 TUI 信息架构）

---

## 单一路径设计（冻结）

1. **`--json` 成功输出只走 stdout**。
2. **人类可读输出默认走 stderr**，包括：
   - root help / topic help
   - usage 错误
   - 非 `--json` 的 list/show/status 文本
   - chat 行模式与 slash 文本人类提示
3. `chat` 继续不支持 `--json`，但其非 JSON 叙事输出也按人类轨处理。
4. help 结构统一为：
   - what it is
   - usage
   - topics / subcommands
   - global flags
   - environment
5. 不引入新依赖，不做 yargs 重写。

---

## 验收标准

1. `pnpm test:project-cli` 覆盖：
   - `help` / topic help 可读
   - `--json` 输出仍可被稳定 `JSON.parse`
   - 人类输出不污染 JSON stdout
2. `pnpm verify` 通过。

---

## 升级条件

命中任一即停止并升级：

- 需要改 SDK / server 才能定义输出语义
- 需要引入命令解析库重写 CLI 入口
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
- 不改变现有 Service / SDK surface
- 不做 Session picker
- 不做 TUI 视觉重构
