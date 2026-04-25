# 071 CLI Shell Design System 与 Degradation

## 目标

为 TheWorld CLI shell 建立一层真正共享的设计系统，统一 line UI / TUI 的 token、panel chrome、rail grammar 与 degraded-mode 逻辑。

本单只解决：

1. shell 级 semantic tokens
2. panel / rail / footer / transcript 的视觉层级
3. `NO_COLOR` / `TERM=dumb` / narrow terminal / motion fallback 的一致规则

---

## 背景

- 当前视觉系统虽然已开始收 token，但仍不足以支撑 shell parity。
- `THEWORLD_CLI_SHELL_PARITY_DESIGN.md` 已把设计系统提升为 shell 级能力，而非局部 TUI 色表。
- 参考项目的差距不仅在颜色，更在组件层级、rail grammar、degraded-mode 与 motion discipline。

---

## 修改范围（冻结）

**允许修改：**

- `packages/cli/src/style.ts`
- `packages/cli/src/help.ts`
- `packages/cli/src/chat-banner.ts`
- `packages/cli/src/chat-status.ts`
- `packages/cli/src/tui/**`
- `scripts/test-project-cli.mjs`
- `docs/requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md`
- `docs/requirements/THEWORLD_CLI_SHELL_DESIGN.md`
- 本工单与 `active/README.md`

**禁止修改：**

- `packages/shared/contracts/**`
- `packages/sdk/**`
- `packages/server/**`
- `packages/core/**`
- `apps/web-console/**`
- 多主题 / auto theme / daltonized 主题矩阵

---

## 单一路径设计（冻结）

1. line UI 与 TUI 必须从同一 shell token 来源派生。
2. 不允许继续在组件里散写与 token 无关的临时颜色。
3. shell 组件必须形成一致语法：
   - brand zone
   - panel border
   - status rail
   - transcript role color
   - footer focus / busy / blocked grammar
4. `NO_COLOR` / `TERM=dumb` 下：
   - 去掉颜色
   - 去掉不必要动效
   - 保留层级、标签、顺序
5. 窄终端下优先保留高优先级信息，次级信息先收缩。

---

## 验收标准

1. `pnpm --filter @theworld/cli check` 通过。
2. `pnpm test:project-cli` 通过。
3. `pnpm verify` 通过。
4. shell 设计系统已从“局部配色收口”升级为“line UI / TUI 共享视觉语法”。

---

## 升级条件

命中任一即停止并升级：

- 需要完整 ThemeProvider 或多主题矩阵
- 需要新的 contract 才能表达设计系统目标
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

- 不引入完整主题系统
- 不引入 auto theme
- 不把设计系统需求反向变成 server contract
