# 106 · L4 Terminal Product Shell Polish

## 目标

在 `099`–`105` 的产品语义稳定后，收口 CLI/TUI 的 terminal-first 产品壳体验，使本地工程产品不只是功能可用，而是可发现、可理解、可持续使用。

本单是 L4 末端 polish，不应提前替代前面子单的语义建设。

## 背景

此前 TUI 已经历多轮视觉与交互改造，但第四层真正需要的是把语义能力统一呈现：

- home / conversation / inspect / task / logs / session surfaces
- context / memory / approval / background 状态
- command discoverability
- degradation / narrow terminal / no color
- shell consistency

## 已冻结决策

1. 本单只在 `099`–`105` 已完成后执行。
2. polish 必须服务产品语义，不做无边界视觉重写。
3. CLI 与 TUI 的术语、状态、快捷键提示应一致。
4. 任何布局调整都必须保持窄终端和非 TTY 降级。

## 允许修改

- `packages/cli/src/`
- `packages/cli/package.json`
- `scripts/`
- `docs/architecture-docs-for-agent/fourth-layer/`
- `docs/architecture-docs-for-human/backend-plan/layer4-design/`
- `docs/exec-plans/active/`
- 根 `package.json`（仅脚本）

## 禁止修改

- L3 service contract
- `packages/sdk/client/`
- `packages/channel-core/`
- Web / Desktop / channel UI
- L6 orchestration
- 大量引入新 UI 依赖，除非先升级确认

## 低能力模型执行前必须先读

- `AGENTS.md`
- `docs/index.md`
- `docs/governance/MODEL_OPERATING_MODES.md`
- `098_l4_engineering_product_shell_parent.md`
- `099`–`105` 已完成工单
- 当前 TUI 组件、help、chat、slash command、statusbar 相关文件

## 本轮范围

1. 统一 L4 产品术语在 CLI/TUI 中的显示。
2. 整合 context / memory / approval / background / plan 状态到 shell。
3. 改善 command discoverability、help、空态、错误态。
4. 完成 narrow terminal / `NO_COLOR` / non-TTY 降级验收。
5. 增加或更新 CLI/TUI smoke，防止产品壳关键输出漂移。

## 本轮不做

- 不新增 L4 大能力。
- 不重做 TUI 架构。
- 不做 Desktop/Web parity。
- 不做 remote / channel presentation。
- 不做多 agent team UI。

## 验收标准

1. 本地 CLI/TUI 能一致展示 L4 关键状态。
2. 新用户能从 home/help/status 找到主要能力。
3. 窄终端、无颜色、非 TTY 场景有可接受降级。
4. 关键 shell 输出有自动化或快照式 smoke 覆盖。
5. `pnpm check` 通过。
6. `pnpm verify` 通过。

## 必跑命令

```bash
pnpm check
pnpm verify
```

## 升级条件

1. 需要重新设计整套 TUI 架构。
2. 需要新增重大 UI 依赖。
3. 发现前置 `099`–`105` 语义未完成，导致无法 polish。
4. `pnpm verify` 连续两轮不通过。
