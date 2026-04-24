# 072 CLI Shell Validation 与 Acceptance Harness

## 目标

重建 TheWorld CLI shell 的验收模型，使其不再主要依赖 `test:project-cli` 的线性 smoke，而是形成：

- 自动化 shell checks
- 手工 TTY / product review matrix
- benchmark screenshot / review 对照

---

## 背景

- 当前自动化主要证明“line-mode CLI 没坏”，不能证明 shell parity 已达标。
- `THEWORLD_CLI_SHELL_PARITY_DESIGN.md` 已明确：验收必须升级为“自动化 + 手工 TTY/product review + benchmark 对照”。
- 若没有独立 validation harness，前面的 `067`–`071` 即使部分实现，也很容易在验收时回到主观描述。

---

## 修改范围（冻结）

**允许修改：**

- `scripts/test-project-cli.mjs`
- `package.json`
- `packages/cli/src/**`（仅当为测试可观测性或小型 harness 接口所必需）
- `docs/requirements/PROJECT_CLI.md`
- `docs/requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md`
- `docs/exec-plans/active/THEWORLD_CLI_BUDGET_MODE_HANDOFF.md`
- 本工单与 `active/README.md`

**禁止修改：**

- `packages/shared/contracts/**`
- `packages/sdk/**`
- `packages/server/**`
- `packages/core/**`
- `apps/web-console/**`
- 为了测试而新造 shell contract

---

## 单一路径设计（冻结）

1. 验收必须至少分成两条线：
   - 自动化
   - 手工 TTY / product review
2. 自动化至少应覆盖：
   - help / topic help / shell discoverability
   - session / thread flows
   - degraded-mode 基本断言
   - conversation shell 的关键 smoke
3. 手工 review matrix 至少覆盖：
   - wide terminal
   - narrow terminal
   - `NO_COLOR`
   - failed run
   - completed run
   - session switching / picker
   - empty shell vs active shell
4. 验收汇报必须包含 benchmark comparison，而不是只说“看起来更好了”。

---

## 验收标准

1. `pnpm test:project-cli` 通过。
2. `pnpm verify` 通过。
3. 仓库内已经存在可复用的 shell acceptance 模型，而不再只依赖主观描述。
4. handoff 与工单验收口径已同步升级到 shell parity 标准。

---

## 升级条件

命中任一即停止并升级：

- 需要新的 contract 才能完成 acceptance harness
- 需要引入新的外部终端测试框架且超出本轮预算
- `pnpm verify` 连续两轮不通过

---

## 必跑命令

```bash
pnpm test:project-cli
pnpm verify
```

---

## 不做什么

- 不为测试发明新的 server DTO
- 不把 benchmark comparison 变成“完全复制参考项目截图”
- 不用自动化替代必要的手工 TTY / product review
