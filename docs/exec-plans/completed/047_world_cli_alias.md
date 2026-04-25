# 047 `world` CLI Alias

## 目标

把 CLI 启动命令从 `pnpm theworld` 同时支持 `pnpm world`（更短、更好记）。

**不改现有命令，只加别名。** `pnpm theworld` 仍然有效。

---

## 背景

`docs/requirements/cli命令设计.md` 第二批计划中明确：

> `theworld` 太长，且不好记忆，将启动命令简写为 `world`

当前 CLI 入口是 `packages/cli/src/index.ts`，通过 `package.json` 的 `bin` 字段注册为 `theworld`。

---

## 修改范围（冻结）

**允许修改：**

- `packages/cli/package.json` — 在 `bin` 中新增 `"world": "dist/index.js"` 与 `"theworld": "dist/index.js"` 并存（保持向后兼容）
- `package.json`（根）— 新增 `"world": "pnpm theworld"` script 别名
- `scripts/test-project-cli.mjs`（如果存在）或 `apps/dev-console` 相关 smoke — 补充 `world help` 的基础 smoke 验证
- `docs/requirements/PROJECT_CLI.md` — 更新 §0 快速开始，说明 `world` 别名

**禁止修改：**

- CLI 逻辑代码（`packages/cli/src/` 无需改动，只是增加 bin 入口）
- shared contract、server、sdk、core

---

## 验收标准

1. `pnpm world` 与 `pnpm theworld` 行为完全一致
2. `pnpm world help` 可正常输出帮助
3. `pnpm check` 通过
4. `pnpm verify` 通过（现有 test:project-cli smoke 覆盖即可）

---

## 升级条件

如遇以下情况停止升级：

- 需要改 CLI 实现逻辑
- `pnpm verify` 连续两轮不通过

---

## 必跑命令

```bash
pnpm check
pnpm verify
```

---

## 不做什么

- 不做 binary 安装（`npm link` / `npm publish`）
- 不删除 `pnpm theworld` 入口
- 不改 CLI 子命令名（子命令仍保持 `chat`, `sessions`, `inspect`, `tasks`）
